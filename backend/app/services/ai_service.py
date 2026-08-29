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
    in_string = False
    escape_next = False

    for ch in text:
        if escape_next:
            escape_next = False
            out.append(ch)
            continue

        if ch == '\\' and in_string:
            escape_next = True
            out.append(ch)
            continue

        if ch == '"':
            in_string = not in_string
            out.append(ch)
            continue

        if in_string and ch in CONTROL_ESCAPES:
            # Replace bare control char with its JSON escape sequence
            out.append(CONTROL_ESCAPES[ch])
            continue

        out.append(ch)

    return ''.join(out)


def _insert_missing_commas(text: str) -> str:
    """
    Insert commas that IBM Bob omitted between adjacent JSON values.

    IBM Bob occasionally emits array elements or object members without the
    separating comma, e.g.:

        [{"id": "a"} {"id": "b"}]          <- missing comma between objects
        {"k1": "v1" "k2": "v2"}            <- missing comma between members

    Strategy
    --------
    Reduce the text to a *structural skeleton* — replace every string literal
    with a fixed placeholder S (one character), and strip whitespace — then
    apply a simple regex to insert commas wherever:

        (} or ] or S)  followed by  ({ or [ or S)

    without an intervening separator (, : { [).

    After inserting commas into the skeleton, map the insertion positions back
    to the original text and rebuild it.

    This avoids all state-machine subtleties because we never try to insert
    commas "inline" during a single character walk.
    """
    if not text:
        return text

    # ── Pass 1: identify string-literal spans ────────────────────────────────
    # string_spans: list of (start, end) positions of complete string literals
    # (start = position of opening ", end = position just after closing ")
    string_spans: List[tuple] = []
    in_string = False
    escape_next = False
    str_start = -1

    for i, ch in enumerate(text):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"':
            if in_string:
                # Closing quote
                string_spans.append((str_start, i + 1))
                in_string = False
            else:
                # Opening quote
                str_start = i
                in_string = True
            continue

    # ── Pass 2: collect structural tokens outside strings ────────────────────
    # Token types that matter: VALUE_END = } ] str_literal
    #                          VALUE_START = { [ str_literal
    #                          SEPARATOR = , : { [
    # We emit "S" for a complete string literal, and the raw char for { } [ ] , :

    # Build a set of positions that are inside string literals
    in_string_pos: set = set()
    for start, end in string_spans:
        for p in range(start, end):
            in_string_pos.add(p)
    # Add positions of opening quotes (str_start values)
    # Already included above.

    # Collect (original_pos, token_char) for all structural tokens + string starts
    # We treat each complete string as a single token at its opening-quote position.
    tokens: List[tuple] = []  # (original_pos, kind)  kind ∈ 'S', '{', '}', '[', ']', ',', ':'
    i = 0
    while i < len(text):
        if text[i] == '"' and i not in in_string_pos:
            # Should not happen — all " are either opening or inside strings
            i += 1
            continue
        # Is this the start of a string span?
        is_str_start = any(start == i for start, _ in string_spans)
        if is_str_start:
            tokens.append((i, 'S'))
            # Skip to end of this string span
            end = next(end for start, end in string_spans if start == i)
            i = end
            continue
        ch = text[i]
        if ch in ('{', '}', '[', ']', ',', ':'):
            tokens.append((i, ch))
        i += 1

    # ── Pass 3: find positions where commas need to be inserted ───────────────
    VALUE_END   = frozenset(('S', '}', ']'))
    VALUE_START = frozenset(('S', '{', '['))
    CLEARS_NEED = frozenset((',', ':', '{', '['))

    insert_before: List[int] = []  # original positions to insert ',' before
    need_comma = False  # True if last meaningful token was a value-end

    for orig_pos, kind in tokens:
        if kind in VALUE_START and need_comma:
            insert_before.append(orig_pos)
            need_comma = False
        if kind in CLEARS_NEED:
            need_comma = False
        elif kind in VALUE_END:
            need_comma = True
        # ',' and ':' already handled by CLEARS_NEED above

    # ── Pass 4: rebuild text with inserted commas ─────────────────────────────
    if not insert_before:
        return text

    insert_set = set(insert_before)
    result: List[str] = []
    for i, ch in enumerate(text):
        if i in insert_set:
            result.append(',')
        result.append(ch)

    return ''.join(result)


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
      1. Direct parse of extracted text.
      2. _sanitize_json_strings  — fixes literal control chars inside strings
         (bare newlines / tabs in string values).
      3. _insert_missing_commas  — inserts commas IBM Bob dropped between
         adjacent array elements or object members.
      4. _repair_truncated_json  — closes unbalanced braces/brackets caused by
         response truncation.
    """
    # Plain text mode — rely on the prompt's "Return ONLY raw JSON" instruction
    raw = call_ai(messages, response_format="text", temperature=temperature, max_tokens=max_tokens)
    text = _extract_json_from_text(raw)

    # Stage 1: direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Stage 2: sanitize bare control characters inside string values
    sanitized = _sanitize_json_strings(text)
    try:
        return json.loads(sanitized)
    except json.JSONDecodeError:
        pass

    # Stage 3: insert missing commas between adjacent values
    comma_fixed = _insert_missing_commas(sanitized)
    try:
        return json.loads(comma_fixed)
    except json.JSONDecodeError:
        pass

    # Stage 4: attempt to close truncated JSON by balancing braces/brackets
    repaired = _repair_truncated_json(comma_fixed)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError as exc:
        raise AIServiceError(
            f"IBM Bob returned malformed JSON that could not be repaired: {exc}. "
            f"Response preview: {raw[:200]}"
        ) from exc


def _repair_truncated_json(text: str) -> str:
    """
    Attempt to produce valid JSON from a response that was cut off mid-output.

    Strategy
    --------
    1. Walk the text tracking string state and a *stack* of open containers
       ({ and [), so we know the exact nesting order and can close them in
       the correct reverse order.
    2. Record the position after every fully balanced top-level close, so we
       can fall back to the last known-good point.
    3. If truncated mid-string, close the string first, then pop and close
       every open container in reverse order.
    """
    stack: List[str] = []   # '{' or '[' for each currently open container
    in_string = False
    escape_next = False
    last_safe_pos = 0
    last_obj_end = 0   # position just after the last '}' at any depth

    for i, ch in enumerate(text):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in ("{", "["):
            stack.append(ch)
        elif ch == "}":
            if stack and stack[-1] == "{":
                stack.pop()
            last_obj_end = i + 1
            if not stack:
                last_safe_pos = i + 1
        elif ch == "]":
            if stack and stack[-1] == "[":
                stack.pop()
            if not stack:
                last_safe_pos = i + 1

    # Already balanced
    if not stack and not in_string:
        return text[:last_safe_pos] if last_safe_pos else text

    # Truncated mid-string: trim to the last complete object boundary so we
    # don't leave a half-written string value in an incomplete array element.
    if in_string and last_obj_end > 0:
        text = text[:last_obj_end]
        # Recompute stack for the trimmed text
        stack = []
        in_string = False
        escape_next = False
        for ch in text:
            if escape_next:
                escape_next = False
                continue
            if ch == "\\" and in_string:
                escape_next = True
                continue
            if ch == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch in ("{", "["):
                stack.append(ch)
            elif ch == "}" and stack and stack[-1] == "{":
                stack.pop()
            elif ch == "]" and stack and stack[-1] == "[":
                stack.pop()

    # Build the closing suffix in reverse-stack order
    closing = ""
    if in_string:
        closing += '"'
    for opener in reversed(stack):
        closing += "}" if opener == "{" else "]"
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
        future2a = executor.submit(_call_json, messages2a, 0.2, 3500)
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
