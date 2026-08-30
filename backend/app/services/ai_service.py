"""
IBM Bob Inference AI Service.

Calls the Bob inference endpoint directly via HTTP using the Inference-scoped
API key.  The endpoint is the Bob LiteLLM proxy at:
  https://api.us-east.bob.ibm.com/inference/v1/chat/completions

Authentication
--------------
Bob's ApiKeyAuthStrategy sends the key as:
  Authorization: apikey <key>

The Cloudflare WAF in front of the gateway enforces a specific User-Agent:
  User-Agent: IBM Bob/<version>

Both are set on every request.  No JWT exchange is needed for Inference keys.

Configuration
-------------
Set BOBSHELL_API_KEY in backend/.env to an Inference-scoped key created at
bob.ibm.com -> Account -> API Keys.

Optionally override BOB_INFERENCE_URL if your subscription is in a different
region.  Default: https://api.us-east.bob.ibm.com/inference/v1
"""
from __future__ import annotations

import json
import logging
import re
import concurrent.futures
from typing import Any, Dict, List, Optional

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

# Bob Shell version string used as User-Agent (required by Cloudflare WAF)
_BOB_VERSION = "2.0.1"
_USER_AGENT = f"IBM Bob/{_BOB_VERSION}"

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an expert software architect and legacy modernization specialist.

Your role is to:
1. Analyze legacy codebases thoroughly and honestly
2. Identify technical debt, architectural issues, and modernization opportunities
3. Recommend practical improvements based on the actual code
4. Propose modernized implementations that preserve behavior
5. Generate actionable migration plans

IMPORTANT RULES:
- Base all findings on the actual code provided — never fabricate issues
- If information is unclear or missing, say "Unknown / Requires Further Investigation"
- Never claim AI-generated code is automatically correct — always flag for developer review
- Be specific: cite file names, function names, line numbers where possible
- Prioritize practical, achievable recommendations
- Distinguish between automated assistance and items requiring human judgment

Always respond with valid JSON when instructed to do so."""


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class AIServiceError(Exception):
    """Raised when the AI service cannot complete a request."""
    def __init__(self, message: str, cause: Optional[Exception] = None):
        super().__init__(message)
        self.cause = cause


class AIServiceConfigError(AIServiceError):
    """Raised when required configuration (e.g. API key) is missing."""


class AIServiceAuthError(AIServiceError):
    """Raised when the Bob API key is rejected."""


class AIServiceRateLimitError(AIServiceError):
    """Raised when the Bob inference endpoint rate-limits this client."""


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------

def _get_api_key() -> str:
    """Return the API key, preferring BOBSHELL_API_KEY (copied to BOB_API_KEY by bob v2)."""
    key = settings.bobshell_api_key
    if not key:
        raise AIServiceConfigError(
            "BOBSHELL_API_KEY is not configured. "
            "Create an Inference-scoped API key at bob.ibm.com -> Account -> API Keys "
            "and set BOBSHELL_API_KEY in backend/.env."
        )
    return key


def _inference_url() -> str:
    """Return the base inference URL (without /chat/completions suffix)."""
    url = settings.bob_inference_url
    if not url:
        # Default: us-east gateway inference path
        url = "https://api.us-east.bob.ibm.com/inference/v1"
    return url.rstrip("/")


def _make_client(api_key: str, read_timeout: float = 240.0) -> httpx.Client:
    """Build an httpx client with Bob's required auth headers."""
    return httpx.Client(
        headers={
            # Bob ApiKeyAuthStrategy format
            "Authorization": f"apikey {api_key}",
            "Content-Type": "application/json",
            # Required by Cloudflare WAF in front of the Bob gateway
            "User-Agent": _USER_AGENT,
            "X-Platform-Name": "IBM Bob",
            "X-Platform-Version": _BOB_VERSION,
        },
        timeout=httpx.Timeout(connect=10.0, read=read_timeout, write=30.0, pool=5.0),
    )


# ---------------------------------------------------------------------------
# Core call wrapper
# ---------------------------------------------------------------------------

def call_ai(
    messages: List[Dict[str, str]],
    *,
    response_format: str = "text",
    temperature: float = 0.2,
    max_tokens: int = 8192,
) -> str:
    """
    POST a chat-completions request to the Bob inference endpoint and return
    the text of the first choice.

    Parameters
    ----------
    messages:        List of {"role": ..., "content": ...} dicts.
    response_format: "json" to request a JSON object, "text" otherwise.
    temperature:     Sampling temperature (0 = deterministic).
    max_tokens:      Maximum tokens in the completion.

    Raises
    ------
    AIServiceConfigError    – BOBSHELL_API_KEY missing or inference URL wrong.
    AIServiceAuthError      – Key rejected (401/403).
    AIServiceRateLimitError – Rate limit exceeded (429).
    AIServiceError          – Any other HTTP or parsing failure.
    """
    api_key = _get_api_key()
    base_url = _inference_url()
    endpoint = f"{base_url}/chat/completions"

    payload: Dict[str, Any] = {
        "model": "premium",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format == "json":
        payload["response_format"] = {"type": "json_object"}

    try:
        with _make_client(api_key) as client:
            resp = client.post(endpoint, json=payload)
    except httpx.ConnectError as exc:
        raise AIServiceConfigError(
            f"Cannot connect to Bob inference endpoint at {endpoint}. "
            f"Check BOB_INFERENCE_URL in backend/.env. Detail: {exc}"
        ) from exc
    except httpx.TimeoutException as exc:
        raise AIServiceError(
            f"Bob inference request timed out after 120 seconds at {endpoint}."
        ) from exc
    except Exception as exc:
        raise AIServiceError(
            f"Unexpected error calling Bob inference: {type(exc).__name__}: {exc}"
        ) from exc

    if resp.status_code == 401:
        try:
            detail = resp.json().get("message", resp.text[:200])
        except Exception:
            detail = resp.text[:200]
        raise AIServiceAuthError(
            f"IBM Bob rejected the API key (401): {detail}. "
            "Verify BOBSHELL_API_KEY is a valid, active Inference-scoped key at bob.ibm.com -> API Keys."
        )

    if resp.status_code == 403:
        raise AIServiceAuthError(
            f"IBM Bob inference access denied (403). "
            "The key may not have access to the inference endpoint, or the endpoint URL is incorrect. "
            f"Endpoint: {endpoint}"
        )

    if resp.status_code == 429:
        raise AIServiceRateLimitError(
            "IBM Bob inference rate limit exceeded (429). Please wait and try again."
        )

    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text[:300]
        raise AIServiceError(
            f"Bob inference request failed with HTTP {resp.status_code}: {detail}"
        )

    try:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        if content is None:
            raise AIServiceError("Bob inference returned an empty response.")
        return content
    except (KeyError, IndexError) as exc:
        raise AIServiceError(
            f"Unexpected response structure from Bob inference: {resp.text[:300]}"
        ) from exc


def _extract_json_from_text(text: str) -> str:
    """
    Robustly extract a JSON object from a model response that may be wrapped
    in markdown code fences or prefixed with prose text.

    Handles all of:
      - Raw JSON (no wrapper)
      - ```json\\n{...}\\n```
      - ```\\n{...}\\n```
      - "Here is the result:\\n```json\\n{..."   (prose before fence)
      - "Here is the result:\\n{"                 (prose before bare JSON)
      - Truncated fence (closing ``` missing)
    """
    text = text.strip()

    # Fast path: already starts with a JSON object or array
    if text and text[0] in ('{', '['):
        return text

    # Look for a fenced code block anywhere in the text
    fence_match = re.search(r'```(?:json)?\s*\n([\s\S]*?)(?:\n```|$)', text)
    if fence_match:
        return fence_match.group(1).strip()

    # No fence found — find the first '{' or '[' and return from there
    for i, ch in enumerate(text):
        if ch in ('{', '['):
            return text[i:]

    # Give up and return the original; json.loads will report the real error
    return text


def _walk_json(text: str):
    """
    Generator that yields (index, char, in_string) for each character in
    *text*, correctly tracking JSON string state including escape sequences.

    Callers that only care about structural characters outside strings can
    filter by ``not in_string``.
    """
    in_string = False
    escape_next = False
    for i, ch in enumerate(text):
        if escape_next:
            escape_next = False
            yield i, ch, in_string
            continue
        if ch == '\\' and in_string:
            escape_next = True
            yield i, ch, in_string
            continue
        if ch == '"':
            yield i, ch, in_string
            in_string = not in_string
            continue
        yield i, ch, in_string


def _sanitize_json_strings(text: str) -> str:
    """
    Walk a JSON text and escape any bare control characters (0x00-0x1F) that
    appear inside string values without a preceding backslash.

    JSON strings must not contain literal newlines, tabs, carriage-returns, or
    other control characters — they must be escaped as \\n, \\t, \\r, etc.
    IBM Bob sometimes emits literal newlines inside string values when the
    response is long, producing a 'Expecting ,  delimiter' parse error at the
    corrupt character rather than at the end of the text.

    This sanitizer fixes those interior corruption cases so that the repaired
    text can be parsed cleanly.  It does NOT fix structural issues (mismatched
    braces) — _repair_truncated_json handles those.
    """
    CONTROL_ESCAPES = {
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t',
        '\b': '\\b',
        '\f': '\\f',
    }

    out: List[str] = []
    for _i, ch, in_string in _walk_json(text):
        if in_string and ch in CONTROL_ESCAPES:
            out.append(CONTROL_ESCAPES[ch])
        else:
            out.append(ch)

    return ''.join(out)


def _remove_trailing_commas(text: str) -> str:
    """
    Remove trailing commas before '}' or ']' that make JSON invalid.

    IBM Bob occasionally emits a comma after the last member of an object or
    the last element of an array (e.g. ``{"key": "value",}``), which is legal
    JavaScript/Python but invalid JSON and causes:
        Expecting property name enclosed in double quotes

    Strategy: use _walk_json to correctly identify structural chars outside
    strings.  Track the output index of the most-recently emitted comma.  When
    a closing bracket is reached while that index is still live (only whitespace
    has been seen since the comma), blank out the comma.
    """
    out: List[str] = []
    pending_comma_idx = -1   # index in `out` of a potentially-trailing comma

    for _i, ch, in_string in _walk_json(text):
        if not in_string and ch != '"':
            # Structural character outside a string
            if ch == ',':
                pending_comma_idx = len(out)
            elif ch in ('}', ']'):
                if pending_comma_idx >= 0:
                    out[pending_comma_idx] = ''   # erase the trailing comma
                    pending_comma_idx = -1
            elif ch not in (' ', '\t', '\n', '\r'):
                # Any non-whitespace, non-comma structural char resets the tracker
                pending_comma_idx = -1
        elif in_string or ch == '"':
            # Inside or delimiting a string — a comma before a string value is
            # never trailing, so reset only when we encounter the *opening* quote
            # (in_string is still False at that point per _walk_json yield order)
            if ch == '"' and not in_string:
                # Opening quote of a string — comma before it is not trailing
                pending_comma_idx = -1

        out.append(ch)

    return ''.join(out)


def _string_spans(text: str) -> List[tuple]:
    """
    Return a list of (start, end) byte ranges for every JSON string literal
    in *text*, where start is the position of the opening '"' and end is the
    position just after the closing '"'.

    Uses its own escape-aware loop so that a backslash-escaped quote inside a
    string value (\\") is never mistaken for a closing delimiter.
    """
    spans: List[tuple] = []
    in_str = False
    esc = False
    str_start = -1
    for i, ch in enumerate(text):
        if esc:
            esc = False
            continue
        if ch == '\\' and in_str:
            esc = True
            continue
        if ch == '"':
            if in_str:
                spans.append((str_start, i + 1))
                in_str = False
            else:
                str_start = i
                in_str = True
    return spans


def _replace_python_literals(text: str) -> str:
    """
    Replace Python/JavaScript literal tokens that are invalid in JSON.

    IBM Bob occasionally writes Python-style ``None``, ``True``, ``False`` or
    JavaScript's ``undefined`` when producing JSON inside a large response.
    These all cause "Expecting value" errors because the JSON parser does not
    recognise them.

    Replacements (only outside string values):
        None      → null
        True      → true
        False     → false
        undefined → null
    """
    if not text:
        return text

    spans = _string_spans(text)

    _REPLACEMENTS = {
        'None':      'null',
        'True':      'true',
        'False':     'false',
        'undefined': 'null',
    }
    _PATTERN = re.compile(r'\b(None|True|False|undefined)\b')

    def _replace(m: re.Match) -> str:
        pos = m.start()
        for start, end in spans:
            if start <= pos < end:
                return m.group(0)   # inside a string — leave untouched
        return _REPLACEMENTS[m.group(0)]

    return _PATTERN.sub(_replace, text)


def _insert_missing_commas(text: str) -> str:
    """
    Insert commas that IBM Bob omitted between adjacent JSON values.

    IBM Bob occasionally emits array elements or object members without the
    separating comma, e.g.:

        [{"id": "a"} {"id": "b"}]          <- missing comma between objects
        {"k1": "v1" "k2": "v2"}            <- missing comma between members

    Strategy: collect structural tokens (using _string_spans + _walk_json) then
    find positions where a value-end is directly followed by a value-start with
    no intervening separator, and insert a comma before the value-start.
    """
    if not text:
        return text

    # ── Pass 1: identify complete string spans ───────────────────────────────
    string_spans = _string_spans(text)
    str_starts = {start for start, _ in string_spans}
    str_ends   = {end   for _, end   in string_spans}

    # Build a set of all positions that belong to a string literal
    in_string_pos: set = set()
    for start, end in string_spans:
        for p in range(start, end):
            in_string_pos.add(p)

    # ── Pass 2: collect structural tokens ────────────────────────────────────
    tokens: List[tuple] = []  # (original_pos, kind)
    i = 0
    while i < len(text):
        if i in str_starts:
            tokens.append((i, 'S'))
            end = next(e for s, e in string_spans if s == i)
            i = end
            continue
        if i not in in_string_pos and text[i] in ('{', '}', '[', ']', ',', ':'):
            tokens.append((i, text[i]))
        i += 1

    # ── Pass 3: find missing commas ──────────────────────────────────────────
    VALUE_END   = frozenset(('S', '}', ']'))
    VALUE_START = frozenset(('S', '{', '['))
    CLEARS_NEED = frozenset((',', ':', '{', '['))

    insert_before: List[int] = []
    need_comma = False

    for orig_pos, kind in tokens:
        if kind in VALUE_START and need_comma:
            insert_before.append(orig_pos)
            need_comma = False
        if kind in CLEARS_NEED:
            need_comma = False
        elif kind in VALUE_END:
            need_comma = True

    # ── Pass 4: rebuild with inserted commas ─────────────────────────────────
    if not insert_before:
        return text

    insert_set = set(insert_before)
    result: List[str] = []
    for i, ch in enumerate(text):
        if i in insert_set:
            result.append(',')
        result.append(ch)

    return ''.join(result)


def _fix_unescaped_inner_quotes(text: str) -> str:
    """
    Detect and escape bare double-quotes that the model placed *inside* a JSON
    string value without a preceding backslash.

    IBM Bob occasionally emits text like:

        "evidence": "See "application-context.xml" for details"
        "description": "Uses ("app-context.xml", "app-security.xml") here"

    Strategy — structural-context forward scan:
    ────────────────────────────────────────────
    Walk the text maintaining a full JSON structural stack (inside object key,
    inside object value, inside array element).  A ``"`` that closes what the
    stack says is a *value* string needs to be validated: peek forward past
    whitespace and check that the next character is a legitimate value-end token
    (``,``, ``}``, ``]``).

    If the next character is NOT one of those and we are definitely inside a
    value string (not a key), the ``"`` is a false close from an unescaped inner
    quote.  Replace it with ``\\"`` and stay inside the string.

    To disambiguate ``,`` (which can follow either a genuine string close OR an
    inner quoted phrase like ``"foo.xml", "bar.xml"``), we additionally check:
    when a ``,`` follows the presumed close, look at what comes after the ``,``
    to decide if we're still inside a value:

      - ``,`` then ``"`` then eventually ``:`` → the ``,``-separated token is a
        new key-value pair → the close was genuine.
      - ``,`` then ``"`` with NO ``:`` before the next ``"`` closes → the token
        after ``,`` is an inner quoted phrase, not a key → the close was false.

    This check is O(N²) in the worst case but N is bounded by the response size
    and the number of inner quotes is small in practice.
    """
    if '"' not in text:
        return text

    n = len(text)
    MAX_ITERATIONS = 30

    def _has_colon_after_next_string(start: int) -> bool:
        """
        Starting just after a ``,`` that followed a presumed string-close,
        skip whitespace, then read the next complete string literal, then
        check if the very next non-whitespace character is ``:``.

        If yes → the string we skipped is a JSON object key → the preceding
        string-close was genuine (it ended a value, and the ``,`` separates
        key-value pairs).

        If no → the string after the comma is a continuation of an inner
        quoted phrase, not a new key → the preceding close was a false close.
        """
        j = start
        while j < n and text[j] in (' ', '\t', '\n', '\r'):
            j += 1
        if j >= n or text[j] != '"':
            # Not a string after the comma → this comma is between array elements
            # or before a non-string value; treat as genuine close.
            return True
        # Skip the complete string literal with proper escape handling
        j += 1  # skip opening quote
        esc2 = False
        while j < n:
            c = text[j]
            if esc2:
                esc2 = False
                j += 1
                continue
            if c == '\\':
                esc2 = True
                j += 1
                continue
            if c == '"':
                j += 1  # closing quote — move past it
                break
            j += 1
        # Now j is just after the closing quote; skip whitespace
        while j < n and text[j] in (' ', '\t', '\n', '\r'):
            j += 1
        return j < n and text[j] == ':'

    for _ in range(MAX_ITERATIONS):
        # Walk text tracking: are we inside a string that is a VALUE (not a key)?
        # JSON structure alternates: after ``{`` comes a key, after ``:`` comes a
        # value, after ``,`` inside an object comes a key again, etc.
        # We track this with a simple state machine.
        #
        # States: EXPECT_KEY, EXPECT_COLON, EXPECT_VALUE, IN_VALUE_STRING,
        #         IN_KEY_STRING, EXPECT_COMMA_OR_CLOSE

        out: List[str] = []
        # Stack of container types: 'O' (object) or 'A' (array)
        containers: List[str] = []
        # True when the current position is inside a value string (not key)
        in_value_str = False
        in_key_str = False
        expect_value = False   # True immediately after ':'
        after_open = True      # True at doc start or just after '{' / '[' or ','
        esc = False
        changed = False

        i = 0
        while i < n:
            ch = text[i]

            if esc:
                esc = False
                out.append(ch)
                i += 1
                continue

            if ch == '\\' and (in_value_str or in_key_str):
                esc = True
                out.append(ch)
                i += 1
                continue

            if ch == '"':
                if in_key_str:
                    # Closing key string
                    in_key_str = False
                    expect_value = False  # will flip to True when we see ':'
                    out.append(ch)
                    i += 1
                    continue

                if in_value_str:
                    # Potential close of a value string — validate
                    j = i + 1
                    while j < n and text[j] in (' ', '\t', '\n', '\r'):
                        j += 1
                    next_ch = text[j] if j < n else ''

                    genuine_close = False
                    if next_ch in ('}', ']', ''):
                        genuine_close = True
                    elif next_ch == ':':
                        genuine_close = True
                    elif next_ch == ',':
                        # Comma could follow a genuine close or an inner phrase.
                        # Check if what comes after the comma is a JSON key.
                        if containers and containers[-1] == 'O':
                            # Inside an object: after comma we expect a key (has colon)
                            genuine_close = _has_colon_after_next_string(j + 1)
                        else:
                            # Inside an array: comma always precedes the next element
                            genuine_close = True
                    elif next_ch == '"':
                        # Quote immediately after close — start of next string
                        # This is genuine only if we're in an array context
                        genuine_close = bool(containers and containers[-1] == 'A')

                    if genuine_close:
                        in_value_str = False
                        expect_value = False
                        after_open = False
                        out.append(ch)
                        i += 1
                        continue
                    else:
                        # Inner quote — escape it
                        out.append('\\')
                        out.append('"')
                        changed = True
                        i += 1
                        continue

                # Not in any string — this is an opening quote
                if expect_value or (containers and containers[-1] == 'A' and after_open):
                    in_value_str = True
                    expect_value = False
                    after_open = False
                else:
                    in_key_str = True
                    after_open = False
                out.append(ch)
                i += 1
                continue

            if not in_value_str and not in_key_str:
                if ch == '{':
                    containers.append('O')
                    after_open = True
                    expect_value = False
                elif ch == '[':
                    containers.append('A')
                    after_open = True
                    expect_value = False
                elif ch in ('}', ']'):
                    if containers:
                        containers.pop()
                    after_open = False
                    expect_value = False
                elif ch == ':':
                    expect_value = True
                    after_open = False
                elif ch == ',':
                    after_open = True
                    expect_value = False

            out.append(ch)
            i += 1

        if not changed:
            break
        text = ''.join(out)

    return text


def _call_json(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = 8192,
) -> Dict[str, Any]:
    """
    Call Bob inference expecting a JSON response.

    Does NOT set response_format=json — Bob's premium model honours the
    prompt instruction more reliably without that flag, and omitting it
    avoids the aggressive mid-token truncation that the constrained mode
    triggers.  Markdown fences and any prose preamble are stripped by
    _extract_json_from_text before parsing.

    Recovery pipeline (each stage only runs if the previous parse fails):
      1.   Direct parse of extracted text.
      2.   _sanitize_json_strings   — fixes literal control chars inside strings.
      2.5  _remove_trailing_commas  — strips trailing commas before } or ].
      2.7  _replace_python_literals — replaces None/True/False/undefined.
      3.   _insert_missing_commas   — inserts omitted commas between values.
      4.   _repair_truncated_json   — closes unbalanced braces/brackets.

    Each stage propagates its output to the next only when it changed
    something, so a stage that makes things worse is never the base for
    subsequent stages.
    """
    raw = call_ai(messages, response_format="text", temperature=temperature, max_tokens=max_tokens)
    text = _extract_json_from_text(raw)

    def _try(t: str) -> Optional[Dict]:
        try:
            return json.loads(t)
        except json.JSONDecodeError:
            return None

    # Stage 1
    result = _try(text)
    if result is not None:
        return result

    # Stage 2: sanitize bare control characters inside string values
    s2 = _sanitize_json_strings(text)
    result = _try(s2)
    if result is not None:
        return result
    base = s2 if s2 != text else text

    # Stage 2.3: escape bare double-quotes inside string values
    s23 = _fix_unescaped_inner_quotes(base)
    result = _try(s23)
    if result is not None:
        return result
    base = s23 if s23 != base else base

    # Stage 2.5: remove trailing commas
    s25 = _remove_trailing_commas(base)
    result = _try(s25)
    if result is not None:
        return result
    base = s25 if s25 != base else base

    # Stage 2.7: replace Python/JS literals
    s27 = _replace_python_literals(base)
    result = _try(s27)
    if result is not None:
        return result
    base = s27 if s27 != base else base

    # Stage 3: insert missing commas
    s3 = _insert_missing_commas(base)
    result = _try(s3)
    if result is not None:
        return result
    base = s3 if s3 != base else base

    # Stage 4: repair truncated JSON (close open brackets/braces)
    s4 = _repair_truncated_json(base)
    result = _try(s4)
    if result is not None:
        return result

    # All stages failed — log enough context to diagnose and raise
    try:
        json.loads(s4)
    except json.JSONDecodeError as exc:
        logger.error(
            "JSON repair failed after all stages. Error: %s | "
            "Raw preview (first 400 chars): %.400s",
            exc, raw,
        )
        raise AIServiceError(
            f"IBM Bob returned malformed JSON that could not be repaired: {exc}. "
            f"Response preview: {raw[:200]}"
        ) from exc
    raise AIServiceError("JSON repair failed")  # pragma: no cover


def _repair_truncated_json(text: str) -> str:
    """
    Attempt to produce valid JSON from a response that was cut off mid-output.

    Strategy
    --------
    1. Use a dedicated _json_stack() helper (escape-sequence-aware, built on
       the same _walk_json generator used by every other repair stage) to walk
       the text and compute:
         - the open-container stack
         - whether we ended inside a string
         - the last fully balanced top-level boundary (last_safe_pos)
         - the position just after the last '}' at any depth (last_obj_end)
    2. If already balanced, return text[:last_safe_pos].
    3. If truncated mid-string, trim back to last_obj_end so we don't leave
       a half-written string in an incomplete array element, then recompute.
    4. Close any remaining open containers in reverse order.
    """
    def _json_stack(t: str):
        """Return (stack, in_string, last_safe_pos, last_obj_end) for text t."""
        stack: List[str] = []
        last_safe_pos = 0
        last_obj_end = 0
        # Track in_string via a simple escape-aware counter (not via _walk_json
        # because we also need the final in_string state after the last char).
        in_str = False
        esc = False
        for i, ch in enumerate(t):
            if esc:
                esc = False
                continue
            if ch == '\\' and in_str:
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch in ('{', '['):
                stack.append(ch)
            elif ch == '}':
                if stack and stack[-1] == '{':
                    stack.pop()
                last_obj_end = i + 1
                if not stack:
                    last_safe_pos = i + 1
            elif ch == ']':
                if stack and stack[-1] == '[':
                    stack.pop()
                if not stack:
                    last_safe_pos = i + 1
        return stack, in_str, last_safe_pos, last_obj_end

    stack, in_string, last_safe_pos, last_obj_end = _json_stack(text)

    # Already balanced
    if not stack and not in_string:
        return text[:last_safe_pos] if last_safe_pos else text

    # Truncated mid-string: trim to the last complete object boundary
    if in_string and last_obj_end > 0:
        text = text[:last_obj_end]
        stack, in_string, last_safe_pos, last_obj_end = _json_stack(text)

    # Close all open containers in reverse order
    closing = ''
    if in_string:
        closing += '"'
    for opener in reversed(stack):
        closing += '}' if opener == '{' else ']'
    return text + closing


# ---------------------------------------------------------------------------
# Domain-level AI functions
# ---------------------------------------------------------------------------

def analyze_project(files: List[Dict[str, Any]], project_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Comprehensive legacy-project analysis.

    Split into THREE focused passes run concurrently to keep each response
    well within the token budget and avoid mid-string truncation:

      Pass 1 — technology, code structure, dependencies, architecture,
               executive summary, assessment scores, target tech recommendation.
               (~4 000 output tokens)

      Pass 2a — technical debt items + modernization opportunities only.
               (~3 500 output tokens)

      Pass 2b — architecture diagram model + modernization plan stages.
               (~3 500 output tokens)

    Code samples are capped at 1 500 chars/file × 8 files to keep the input
    prompt under ~5 000 tokens, leaving headroom for the output.
    """
    file_listing = "\n".join(
        f"- {f['path']} ({f.get('language', 'unknown')}, {f.get('size_bytes', 0)} bytes)"
        for f in files[:100]
    )

    # Tighter per-file cap (1 500 chars) and fewer files (8) to keep prompt small
    code_samples: List[str] = []
    for f in files[:15]:
        if f.get("content") and not f.get("is_binary") and f.get("is_supported"):
            code_samples.append(f"=== {f['path']} ===\n{f['content'][:1500]}\n")
        if len(code_samples) >= 8:
            break

    code_context = "\n".join(code_samples)

    project_header = f"""PROJECT INFO:
- Name: {project_info.get('name', 'Unknown')}
- Known Legacy Tech: {project_info.get('legacy_tech', 'Unknown — detect from code')}
- Target Tech: {project_info.get('target_tech', 'Unknown — recommend appropriate target')}
- Objective: {project_info.get('objective', 'Modernize the application')}

FILE STRUCTURE:
{file_listing}

CODE SAMPLES:
{code_context}"""

    # ── Pass 1: overview, scores, summary ────────────────────────────────────
    pass1_prompt = f"""Analyze this legacy application. Return ONLY raw JSON (no markdown, no fences).

{project_header}

Return exactly this JSON structure:
{{
  "technology_summary": {{
    "languages": [],
    "frameworks": [],
    "libraries": [],
    "runtime_platform": null,
    "build_tools": [],
    "databases": [],
    "external_services": [],
    "apis": [],
    "deployment_assumptions": []
  }},
  "code_structure": {{
    "entry_points": [],
    "modules": [],
    "key_classes": [],
    "key_functions": [],
    "config_files": [],
    "important_files": []
  }},
  "dependencies": {{
    "internal": [],
    "external": [
      {{"name": "example-lib", "version": "1.0.0", "status": "current"}},
      {{"name": "old-framework", "version": "2.3.1", "status": "outdated"}},
      {{"name": "eol-library", "version": "1.2.17", "status": "deprecated"}}
    ],
    "deprecated": ["eol-library 1.x (EOL since 2015)"],
    "risky": ["old-framework 2.x has known CVEs"],
    "coupling_issues": []
  }},
  "architecture": {{
    "pattern": "",
    "description": "",
    "components": [],
    "issues": []
  }},
  "assessment_scores": {{
    "maintainability": {{"score": 0, "rationale": ""}},
    "architecture": {{"score": 0, "rationale": ""}},
    "technology_currency": {{"score": 0, "rationale": ""}},
    "dependency_health": {{"score": 0, "rationale": ""}},
    "security_posture": {{"score": 0, "rationale": ""}},
    "testability": {{"score": 0, "rationale": ""}},
    "documentation": {{"score": 0, "rationale": ""}},
    "coupling": {{"score": 0, "rationale": ""}},
    "migration_complexity": {{"score": 0, "rationale": ""}},
    "modernization_risk": {{"score": 0, "rationale": ""}}
  }},
  "executive_summary": "",
  "target_tech_recommendation": ""
}}

For external dependencies: set "status" to "deprecated" if EOL/abandoned, "outdated" if behind a current major version or has known CVEs, "current" if actively maintained and up-to-date, or "unknown" if unsure. Each name listed in "deprecated" or "risky" MUST also appear in "external" with the matching status.
All scores are AI-assisted heuristics (0-100, higher = better health). Be accurate; base everything strictly on the provided code."""

    # ── Pass 2a: technical debt + modernization opportunities ─────────────────
    pass2a_prompt = f"""Analyze this legacy application for technical debt and modernization opportunities. Return ONLY raw JSON (no markdown, no fences).

{project_header}

Return exactly this JSON structure:
{{
  "technical_debt": [
    {{
      "title": "",
      "description": "",
      "category": "",
      "severity": "critical|high|medium|low",
      "file_path": null,
      "evidence": "",
      "why_matters": "",
      "recommended_action": "",
      "complexity": "high|medium|low",
      "risk": "high|medium|low",
      "priority": 1
    }}
  ],
  "modernization_opportunities": [
    {{
      "title": "",
      "problem": "",
      "evidence": "",
      "proposed_solution": "",
      "category": "Architecture|Dependencies|Security|Performance|Testing|Documentation|Framework|Database|Deployment",
      "priority": "critical|high|medium|low",
      "risk": "high|medium|low",
      "expected_benefit": "",
      "related_files": []
    }}
  ]
}}

Provide exactly 5-7 technical debt items and exactly 5-6 modernization opportunities. Keep each description under 120 words. Base everything strictly on the provided code."""

    # ── Pass 2b: architecture diagram + modernization plan ────────────────────
    pass2b_prompt = f"""Analyze this legacy application and produce an architecture diagram model and a migration plan. Return ONLY raw JSON (no markdown, no fences).

{project_header}

Return exactly this JSON structure:
{{
  "architecture_model": {{
    "current": {{
      "pattern": "",
      "description": "",
      "nodes": [{{"id": "", "label": "", "type": "entrypoint|controller|service|model|database|config|external|frontend|backend|util", "description": ""}}],
      "edges": [{{"source": "", "target": "", "label": "", "type": "dependency|calls|inherits|uses"}}]
    }},
    "recommended": {{
      "pattern": "",
      "description": "",
      "nodes": [{{"id": "", "label": "", "type": "entrypoint|controller|service|model|database|config|external|frontend|backend|util|api|repository|event", "description": ""}}],
      "edges": [{{"source": "", "target": "", "label": "", "type": "dependency|calls|inherits|uses"}}]
    }}
  }},
  "modernization_plan": {{
    "stages": [
      {{
        "name": "",
        "description": "",
        "order": 1,
        "tasks": [
          {{
            "title": "",
            "description": "",
            "related_files": [],
            "priority": "high|medium|low",
            "complexity": "high|medium|low",
            "risk": "high|medium|low",
            "dependencies": [],
            "suggested_order": 1
          }}
        ]
      }}
    ]
  }}
}}

Provide 6-10 nodes per architecture diagram, 4-5 migration stages with 2-4 tasks each. Keep all descriptions under 80 words. Base everything strictly on the provided code."""

    messages1  = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": pass1_prompt}]
    messages2a = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": pass2a_prompt}]
    messages2b = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": pass2b_prompt}]

    # Run all three passes concurrently.
    # Pass 2b (architecture model + plan) gets 4 500 tokens — it carries the
    # two largest structures and was the most frequent truncation victim.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        future1  = executor.submit(_call_json, messages1,  0.2, 4096)
        future2a = executor.submit(_call_json, messages2a, 0.2, 4500)
        future2b = executor.submit(_call_json, messages2b, 0.2, 4500)
        result1  = future1.result(timeout=300)
        result2a = future2a.result(timeout=300)
        result2b = future2b.result(timeout=300)

    # Merge all three passes into a single analysis result
    merged = {**result1, **result2a, **result2b}
    return merged


def transform_file(
    file_path: str,
    original_code: str,
    language: str,
    target_tech: str,
    instruction: Optional[str],
    project_context: str,
) -> Dict[str, Any]:
    """Generate a modernized version of a single source file."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"""Transform this legacy code to a modern implementation.

PROJECT CONTEXT:
{project_context}

FILE: {file_path}
LANGUAGE: {language}
TARGET TECHNOLOGY: {target_tech}
SPECIFIC INSTRUCTION: {instruction or 'Apply best-practice modernization for the target technology'}

ORIGINAL CODE:
```{language}
{original_code[:8000]}
```

Return raw JSON (no markdown fences):
{{
  "transformed_code": "the complete modernized code",
  "explanation": "detailed explanation of what was changed and why",
  "risks": "potential behavior changes, incompatibilities, or things that may break",
  "review_items": "specific items requiring developer review before accepting this transformation",
  "assumptions": "assumptions made during transformation",
  "validation_notes": "what should be tested/validated"
}}

IMPORTANT:
- Preserve the original behavior unless explicitly asked to change it
- Flag any assumptions you cannot verify from the code alone
- This is a proposal for developer review, not production-ready code
- Do not remove error handling or validation logic"""},
    ]
    return _call_json(messages, temperature=0.1)


def explain_code(
    file_path: str,
    code: str,
    language: str,
    question: Optional[str] = None,
) -> str:
    """Explain what a piece of code does, optionally answering a specific question."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"""Explain this legacy code clearly and technically.

FILE: {file_path}
LANGUAGE: {language}

CODE:
```{language}
{code[:6000]}
```

{f'SPECIFIC QUESTION: {question}' if question else 'Provide a comprehensive explanation of what this code does, its structure, and any notable issues.'}

Be specific, technical, and honest about any problems you identify."""},
    ]
    return call_ai(messages)


def answer_project_question(
    question: str,
    project_context: str,
    file_context: Optional[str] = None,
    context_type: Optional[str] = None,
) -> str:
    """Answer a contextual question about the modernization project."""
    context_section = ""
    if file_context:
        context_section = f"\nRELEVANT CODE/CONTEXT:\n{file_context[:4000]}\n"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"""Answer this question about the legacy modernization project.

PROJECT CONTEXT:
{project_context}
{context_section}
QUESTION: {question}

Provide a specific, technical, actionable answer grounded in the project context.
If you don't have enough information to answer definitively, say so clearly and explain what additional information would help."""},
    ]
    return call_ai(messages, temperature=0.3)


def validate_transformation(
    file_path: str,
    original_code: str,
    transformed_code: str,
) -> Dict[str, Any]:
    """AI-assisted review of a proposed code transformation."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"""Review this code transformation for correctness and issues.

ORIGINAL ({file_path}):
```
{original_code[:3000]}
```

TRANSFORMED:
```
{transformed_code[:3000]}
```

Return raw JSON (no markdown fences):
{{
  "errors": ["list of definite errors or breaking changes"],
  "warnings": ["list of potential issues or concerns"],
  "manual_review_items": ["specific items that need human review"],
  "static_analysis": [{{"rule": "rule name", "message": "message", "severity": "error|warning|info"}}],
  "overall_assessment": "ready_for_review|issues_detected|requires_significant_rework",
  "notes": "brief overall assessment note"
}}"""},
    ]
    return _call_json(messages)


def _safe_serialize(obj: Any) -> Any:
    """Recursively replace datetime/non-JSON types with strings."""
    from datetime import datetime, date
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _safe_serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_serialize(i) for i in obj]
    return obj


def generate_report(
    project: Dict[str, Any],
    analysis: Dict[str, Any],
    issues: List[Dict[str, Any]],
    recommendations: List[Dict[str, Any]],
    transformations: List[Dict[str, Any]],
    plan: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Synthesize all analysis findings into a comprehensive modernization report."""
    # Strip datetime objects that DuckDB returns
    project = _safe_serialize(project)
    analysis = _safe_serialize(analysis)
    issues = _safe_serialize(issues)
    recommendations = _safe_serialize(recommendations)
    transformations = _safe_serialize(transformations)
    plan = _safe_serialize(plan) if plan else None

    summary_data = json.dumps(
        {
            "project": {k: v for k, v in project.items() if k not in ("content", "created_at", "updated_at")},
            "analysis_summary": {
                "technology": analysis.get("technology_summary"),
                "architecture": analysis.get("architecture"),
                "technical_debt_count": len(analysis.get("technical_debt") or []),
            },
            "issues_count": len(issues),
            "high_priority_issues": sum(
                1 for i in issues if i.get("severity") in ("critical", "high")
            ),
            "recommendations_count": len(recommendations),
            "transformations_count": len(transformations),
            "plan_stages": len((plan or {}).get("stages") or []),
        },
        indent=2,
        default=str,
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"""Generate a comprehensive modernization report for this project.

DATA:
{summary_data}

TOP ISSUES:
{json.dumps(issues[:10], indent=2, default=str)}

TOP RECOMMENDATIONS:
{json.dumps(recommendations[:10], indent=2, default=str)}

Return raw JSON (no markdown fences):
{{
  "executive_summary": "2-3 paragraph executive summary",
  "architecture_assessment": "current architecture assessment paragraph",
  "technical_debt_summary": "technical debt narrative",
  "target_architecture": "recommended modern architecture description",
  "migration_plan_summary": "migration approach summary",
  "transformation_summary": "summary of transformations done/proposed",
  "validation_summary": "validation status summary",
  "risks": ["key risk 1", "key risk 2"],
  "manual_review_items": ["item requiring human decision 1", "item 2"]
}}"""},
    ]
    return _call_json(messages)


# ---------------------------------------------------------------------------
# Health / connectivity check
# ---------------------------------------------------------------------------

def check_connectivity() -> Dict[str, Any]:
    """
    Verify that the Bob inference endpoint is reachable and the API key works.
    Returns a dict with 'status' ('ok' or 'error') and 'message'.
    Never exposes the API key value.
    """
    endpoint = f"{_inference_url()}/chat/completions"
    try:
        result = call_ai(
            [{"role": "user", "content": "Reply with the single word: ready"}],
            temperature=0,
            max_tokens=10,
        )
        return {
            "status": "ok",
            "message": f"Bob inference reachable. Response: {result.strip()[:100]}",
            "endpoint": endpoint,
        }
    except AIServiceConfigError as exc:
        return {"status": "error", "message": str(exc), "endpoint": endpoint}
    except AIServiceAuthError as exc:
        return {"status": "error", "message": str(exc), "endpoint": endpoint}
    except AIServiceError as exc:
        return {"status": "error", "message": str(exc), "endpoint": endpoint}
    except Exception as exc:
        return {
            "status": "error",
            "message": f"Unexpected error: {type(exc).__name__}: {exc}",
            "endpoint": endpoint,
        }
