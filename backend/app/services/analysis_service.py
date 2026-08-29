"""
Analysis orchestration service.
"""
import json
import re
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from ..db.database import get_db
from ..services.file_service import get_project_files
from ..services.project_service import get_project
from . import ai_service


def get_or_create_analysis(project_id: str, force: bool = False) -> Dict[str, Any]:
    """Get existing analysis or kick off a new one."""
    conn = get_db()
    try:
        if not force:
            existing = conn.execute(
                "SELECT * FROM analyses WHERE project_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
                [project_id]
            ).fetchone()
            if existing:
                cols = [d[0] for d in conn.description]
                row = dict(zip(cols, existing))
                _deserialize_analysis(row)
                return row
        # create pending record
        analysis_id = str(uuid.uuid4())
        now = datetime.utcnow()
        conn.execute("""
            INSERT INTO analyses (id, project_id, status, created_at)
            VALUES (?, ?, 'running', ?)
        """, [analysis_id, project_id, now])
        conn.commit()
        return {"id": analysis_id, "project_id": project_id, "status": "running", "created_at": now}
    finally:
        conn.close()


def run_analysis(project_id: str, analysis_id: str) -> Dict[str, Any]:
    """Run the AI analysis synchronously and persist results."""
    project = get_project(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    files = get_project_files(project_id, include_content=True)
    if not files:
        _fail_analysis(analysis_id, "No files found in project")
        return get_analysis(analysis_id)

    try:
        result = ai_service.analyze_project(files, project)
    except Exception as e:
        _fail_analysis(analysis_id, str(e))
        return get_analysis(analysis_id)

    now = datetime.utcnow()
    conn = get_db()
    try:
        tech = result.get("technology_summary", {})
        structure = result.get("code_structure", {})
        deps = result.get("dependencies", {})
        arch = result.get("architecture", {})
        debt = result.get("technical_debt", [])

        conn.execute("""
            UPDATE analyses SET
                status = 'completed',
                technology_summary = ?,
                code_structure = ?,
                dependencies = ?,
                architecture = ?,
                technical_debt = ?,
                raw_analysis = ?,
                completed_at = ?
            WHERE id = ?
        """, [
            json.dumps(tech),
            json.dumps(structure),
            json.dumps(deps),
            json.dumps(arch),
            json.dumps(debt),
            json.dumps(result),
            now,
            analysis_id
        ])
        conn.commit()

        # Persist issues
        _save_issues(conn, project_id, analysis_id, debt)

        # Persist recommendations
        recs = result.get("modernization_opportunities", [])
        _save_recommendations(conn, project_id, analysis_id, recs)

        # Persist architecture models
        arch_model = result.get("architecture_model", {})
        _save_architecture_models(conn, project_id, analysis_id, arch_model)

        # Persist modernization plan
        plan_data = result.get("modernization_plan", {})
        _save_modernization_plan(conn, project_id, analysis_id, plan_data)

        # Update project status, scores, and tech fields
        scores = result.get("assessment_scores", {})
        target_rec = result.get("target_tech_recommendation", "")
        meta = project.get("metadata") or {}
        meta["assessment_scores"] = scores
        meta["executive_summary"] = result.get("executive_summary", "")
        meta["target_tech_recommendation"] = target_rec

        # ── Back-fill legacy_tech and target_tech on the project row ─────────
        # If the user left these blank at project creation, populate them from
        # the AI analysis so every project card shows an accurate tech stack.
        tech_summary = result.get("technology_summary", {})
        derived_legacy = _derive_legacy_tech_label(project, tech_summary)
        derived_target = _derive_target_tech_label(project, target_rec)

        update_fields = ["status = 'analyzed'", "updated_at = ?", "metadata = ?"]
        update_values = [now, json.dumps(meta)]

        if derived_legacy:
            update_fields.append("legacy_tech = ?")
            update_values.append(derived_legacy)
        if derived_target:
            update_fields.append("target_tech = ?")
            update_values.append(derived_target)

        update_values.append(project_id)

        conn.execute(
            f"UPDATE projects SET {', '.join(update_fields)} WHERE id = ?",
            update_values
        )
        conn.commit()

    finally:
        conn.close()

    return get_analysis(analysis_id)


# Data-format / markup strings that the AI misclassifies as programming languages.
# These should not appear in the legacy tech label.
_NOISE_LANGUAGES = frozenset({
    "json", "yaml", "yml", "xml", "markdown", "md", "html", "css", "svg",
    "dockerfile", "makefile", "toml", "ini", "properties", "env", "text",
    "plain text", "shell script", "bash script",
})

# Prose prefixes that indicate the AI returned a how-to paragraph rather than
# a tech name.  If a target_rec starts with any of these we cannot extract a
# useful short label from it.
_PROSE_PREFIXES = (
    "recommended", "maintain", "consider", "the recommended", "modernize",
    "migrate", "upgrade", "refactor", "primary", "we recommend", "this",
    "based on", "given", "for this", "note", "overall",
)


def _clean_lang(lang: str) -> str:
    """Strip parenthetical version/detail suffixes to produce a short name.

    'JavaScript (ES Modules)' -> 'JavaScript'
    'Java 21'                -> 'Java 21'   (keep version numbers)
    'Jakarta EE (CDI 4.1.0)' -> 'Jakarta EE'
    """
    lang = lang.strip()
    # Remove everything inside first parenthesis
    lang = re.sub(r'\s*\([^)]*\)', '', lang).strip()
    # Collapse multiple spaces
    lang = re.sub(r'\s+', ' ', lang)
    return lang


def _clean_framework(fw: str) -> str:
    """Strip version strings from framework names for brevity.

    'Spring Boot 3.2.x' -> 'Spring Boot 3'
    'Hibernate 4.3.11.Final' -> 'Hibernate'
    'Jakarta EE (CDI 4.1.0, Servlet 6.1.0)' -> 'Jakarta EE'
    """
    fw = fw.strip()
    fw = re.sub(r'\s*\([^)]*\)', '', fw).strip()   # remove parentheticals
    # Remove trailing patch version like ".11.Final" but keep major.minor
    fw = re.sub(r'(\d+\.\d+)\.\S+', r'\1', fw)
    fw = re.sub(r'\s+', ' ', fw)
    return fw


def _derive_legacy_tech_label(project: Dict, tech_summary: Dict) -> Optional[str]:
    """
    Build a short, human-readable legacy tech label from the AI-detected
    technology summary.  Only fills in when the project row does not already
    have a user-supplied value.

    Strategy: language(s) + primary framework + database, cleaned and filtered.
    Capped at 60 characters.
    """
    existing = (project.get("legacy_tech") or "").strip()
    if existing and existing not in ("", "Unknown", "Other", "Let AI recommend"):
        return None

    languages  = tech_summary.get("languages") or []
    frameworks = tech_summary.get("frameworks") or []
    databases  = tech_summary.get("databases") or []
    runtime    = tech_summary.get("runtime_platform") or ""

    parts: List[str] = []

    # Languages — skip pure data/markup formats, take first 2 real ones
    for raw_lang in languages:
        cleaned = _clean_lang(str(raw_lang))
        if cleaned.lower() not in _NOISE_LANGUAGES and cleaned:
            parts.append(cleaned)
        if len(parts) >= 2:
            break

    # Primary framework — first one, cleaned
    for raw_fw in frameworks[:1]:
        fw = _clean_framework(str(raw_fw))
        if fw and fw not in parts:
            parts.append(fw)
            break

    # Database — first one only
    for raw_db in databases[:1]:
        db = _clean_framework(str(raw_db))  # same cleaning
        if db and db not in parts:
            parts.append(db)
            break

    # Fallback: runtime platform if nothing else identified
    if not parts and runtime:
        parts.append(_clean_lang(str(runtime)))

    if not parts:
        return None

    label = ", ".join(parts)
    if len(label) > 60:
        label = label[:57] + "…"
    return label


def _derive_target_tech_label(project: Dict, target_rec: str) -> Optional[str]:
    """
    Extract a short target tech label from the AI recommendation string.
    Only fills in when the project row does not already have a user-supplied value.

    The AI often returns a long prose paragraph.  We detect that pattern and
    try to extract a concise tech name.  If we cannot, we return None (leaving
    the target field blank is better than showing misleading prose).
    """
    existing = (project.get("target_tech") or "").strip()
    if existing and existing not in ("", "Unknown", "Let AI recommend", "Other"):
        return None

    rec = (target_rec or "").strip()
    if not rec:
        return None

    # Split into candidate sentences/clauses
    sentences = re.split(r'\.\s+|\n+|;\s*', rec)
    first = sentences[0].strip() if sentences else rec.strip()

    # Detect prose paragraphs — if the text starts with an action verb or
    # transitional phrase it is a how-to paragraph, not a tech name.
    first_lower = first.lower()
    if any(first_lower.startswith(p) for p in _PROSE_PREFIXES):
        # Try to find a tech name embedded in the prose text.
        # Pattern priority (highest first):
        # 1. Explicit "Target stack:" label — most reliable
        # 2. "Maintain current X" — the current stack IS already the target
        # 3. "migrate/move/transition/adopt/use X"
        # 4. "X is recommended/suggested/preferred"
        patterns = [
            # "Target stack: Spring Boot 3.x with ..." → capture up to next comma or period
            r'[Tt]arget\s+stack[:\s]+([A-Z][^\n.]{4,60})',
            # "Maintain current X foundation/approach" → X is the recommended target
            r'[Mm]aintain\s+current\s+([A-Za-z0-9][^\n(,]{4,50}?)(?:\s+foundation|\s+approach|\s+architecture|\s+stack|\s+\()',
            # "migrate/move/transition/switch/adopt/use X" (tech name may start lowercase like "python")
            r'(?:migrate(?:\s+to)?|adopt|move\s+to|transition\s+to|switch\s+to|use)\s+([A-Za-z][^\.,\n;(]{3,40})',
            # "X is recommended/suggested/preferred"
            r'([A-Z][a-zA-Z0-9 .+#\-]{3,35})\s+(?:is\s+)?(?:recommended|suggested|preferred)',
        ]
        for pat in patterns:
            for m in re.finditer(pat, rec):
                candidate = m.group(1).strip()
                # Trim at comma or "with"/"and" if it's just elaboration
                candidate = re.split(r',|\swith\s|\sand\s', candidate)[0].strip()
                # Strip trailing noise words
                candidate = re.sub(r'\s+(for|to|as|in|of|the|a|an)$', '', candidate, flags=re.I).strip()
                # Reject generic sentences — a real tech name contains at least one
                # word that starts with an uppercase letter or a digit
                if not re.search(r'(?:[A-Z]|\d)', candidate):
                    continue
                # Reject if it looks like a generic verb phrase
                generic_starts = ('complex', 'business', 'monolithic', 'existing', 'legacy',
                                  'the ', 'a ', 'an ', 'all ', 'any ')
                if any(candidate.lower().startswith(g) for g in generic_starts):
                    continue
                if 5 <= len(candidate) <= 55:
                    return candidate
        # Could not find a clean tech name — return None rather than bad data
        return None

    # The first clause is already a tech name (not prose)
    # Trim at comma if the pre-comma part is long enough to be a full name
    if ',' in first and len(first.split(',')[0]) >= 10:
        first = first.split(',')[0].strip()

    if len(first) > 55:
        first = first[:52] + "…"

    return first if len(first) >= 3 else None


def _save_issues(conn, project_id: str, analysis_id: str, debt_items: List[Dict]):
    # Clear ALL previous issues for this project so re-analysis starts fresh.
    conn.execute("DELETE FROM issues WHERE project_id = ?", [project_id])
    for item in debt_items:
        issue_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO issues
            (id, project_id, analysis_id, title, description, category, severity, file_path,
             evidence, why_matters, recommended_action, complexity, risk, priority, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
        """, [
            issue_id, project_id, analysis_id,
            item.get("title", "Unknown Issue"),
            item.get("description"),
            item.get("category"),
            item.get("severity", "medium"),
            item.get("file_path"),
            item.get("evidence"),
            item.get("why_matters"),
            item.get("recommended_action"),
            item.get("complexity", "medium"),
            item.get("risk", "medium"),
            item.get("priority", 3),
            datetime.utcnow()
        ])
    conn.commit()


def _save_recommendations(conn, project_id: str, analysis_id: str, recs: List[Dict]):
    # Clear ALL previous recommendations for this project so re-analysis starts fresh.
    conn.execute("DELETE FROM recommendations WHERE project_id = ?", [project_id])
    for rec in recs:
        rec_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO recommendations
            (id, project_id, analysis_id, title, problem, evidence, proposed_solution,
             category, priority, risk, expected_benefit, related_files, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        """, [
            rec_id, project_id, analysis_id,
            rec.get("title", ""),
            rec.get("problem"),
            rec.get("evidence"),
            rec.get("proposed_solution"),
            rec.get("category"),
            rec.get("priority", "medium"),
            rec.get("risk", "medium"),
            rec.get("expected_benefit"),
            json.dumps(rec.get("related_files", [])),
            datetime.utcnow()
        ])
    conn.commit()


def _save_architecture_models(conn, project_id: str, analysis_id: str, arch_model: Dict):
    # Delete ALL previous models for this project (not just current analysis_id) so
    # that get_architecture_models never returns a mix of old + new models.
    conn.execute("DELETE FROM architecture_models WHERE project_id = ?", [project_id])
    for model_type in ("current", "recommended"):
        model_data = arch_model.get(model_type, {})
        if not model_data:
            continue
        model_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO architecture_models
            (id, project_id, analysis_id, model_type, nodes, edges, description, pattern, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            model_id, project_id, analysis_id, model_type,
            json.dumps(model_data.get("nodes", [])),
            json.dumps(model_data.get("edges", [])),
            model_data.get("description"),
            model_data.get("pattern"),
            datetime.utcnow()
        ])
    conn.commit()


def _save_modernization_plan(conn, project_id: str, analysis_id: str, plan_data: Dict):
    conn.execute("DELETE FROM modernization_plans WHERE project_id = ?", [project_id])
    conn.execute("DELETE FROM plan_tasks WHERE project_id = ?", [project_id])

    if not plan_data:
        return

    plan_id = str(uuid.uuid4())
    stages = plan_data.get("stages", [])
    now = datetime.utcnow()

    conn.execute("""
        INSERT INTO modernization_plans
        (id, project_id, analysis_id, title, description, stages, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        plan_id, project_id, analysis_id,
        "Modernization Plan",
        "AI-generated modernization plan",
        json.dumps(stages),
        now, now
    ])

    order = 0
    for stage in stages:
        stage_name = stage.get("name", "")
        for task in stage.get("tasks", []):
            task_id = str(uuid.uuid4())
            order += 1
            conn.execute("""
                INSERT INTO plan_tasks
                (id, plan_id, project_id, stage_name, title, description,
                 related_files, priority, complexity, risk, dependencies,
                 suggested_order, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_started', ?, ?)
            """, [
                task_id, plan_id, project_id, stage_name,
                task.get("title", "Task"),
                task.get("description"),
                json.dumps(task.get("related_files", [])),
                task.get("priority", "medium"),
                task.get("complexity", "medium"),
                task.get("risk", "medium"),
                json.dumps(task.get("dependencies", [])),
                task.get("suggested_order", order),
                now, now
            ])
    conn.commit()


def _fail_analysis(analysis_id: str, error: str):
    conn = get_db()
    try:
        conn.execute("""
            UPDATE analyses SET status = 'failed', error_message = ?, completed_at = ?
            WHERE id = ?
        """, [error, datetime.utcnow(), analysis_id])
        conn.commit()
    finally:
        conn.close()


def get_analysis(analysis_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        result = conn.execute(
            "SELECT * FROM analyses WHERE id = ?", [analysis_id]
        ).fetchone()
        if not result:
            return None
        cols = [d[0] for d in conn.description]
        row = dict(zip(cols, result))
        _deserialize_analysis(row)
        return row
    finally:
        conn.close()


def get_project_analysis(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        result = conn.execute(
            "SELECT * FROM analyses WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
            [project_id]
        ).fetchone()
        if not result:
            return None
        cols = [d[0] for d in conn.description]
        row = dict(zip(cols, result))
        _deserialize_analysis(row)
        return row
    finally:
        conn.close()


def _dep_status_from_signals(name: str, deprecated_list: List[str], risky_list: List[str]) -> str:
    """Derive a status label by fuzzy-matching the dependency name against the
    deprecated[] and risky[] string arrays the AI returned.

    Priority: deprecated > risky > unknown (caller may override with 'current'
    when the AI already labelled it explicitly).
    """
    name_lower = name.lower()
    # Tokenise the name to the shortest meaningful fragment for matching.
    # e.g. "jakarta.servlet-api" → tokens {"jakarta", "servlet", "api"}
    #      "Log4j"               → {"log4j"}
    tokens = set(re.split(r'[\s\-_.:]+', name_lower)) - {"", "the", "a", "an"}

    def _matches(haystack: str) -> bool:
        h = haystack.lower()
        # Exact substring
        if name_lower in h:
            return True
        # Any token from the name appears as a whole word in the haystack
        for tok in tokens:
            if len(tok) >= 3 and re.search(r'\b' + re.escape(tok) + r'\b', h):
                return True
        return False

    for entry in deprecated_list:
        if _matches(entry):
            return "deprecated"

    for entry in risky_list:
        if _matches(entry):
            return "outdated"   # "risky" maps to outdated — closest standard status

    return "unknown"


def _normalize_deps_external(deps: Dict) -> None:
    """Normalize deps.external so every element is {name, version, status}.

    Two problems to solve:
    1. The AI often returns plain strings instead of {name, version, status} objects.
    2. Even when it returns objects, 'status' is frequently wrong ('current' for
       everything) because the AI doesn't cross-reference its own deprecated/risky lists.

    Strategy:
    - Parse each item into {name, version}.
    - If the item already has an explicit non-'current'/'unknown' status, keep it.
    - Otherwise derive status by matching the name against deprecated[] and risky[].
    """
    raw = deps.get("external")
    if not isinstance(raw, list):
        return

    deprecated_list: List[str] = deps.get("deprecated") or []
    risky_list:      List[str] = deps.get("risky") or []

    normalized: List[Dict] = []
    for item in raw:
        if isinstance(item, dict):
            name    = item.get("name") or item.get("dependency") or str(item)
            version = item.get("version") or ""
            status  = (item.get("status") or "").lower().strip()
            # If the AI said 'current' or 'unknown', re-derive from signals —
            # the AI rarely fills these correctly.
            if status not in ("deprecated", "outdated"):
                status = _dep_status_from_signals(name, deprecated_list, risky_list)
                if status == "unknown" and item.get("status") in ("current",):
                    # Only trust 'current' if there were no signals at all
                    status = "current"
            normalized.append({"name": name, "version": version, "status": status})
        elif isinstance(item, str) and item.strip():
            name, version = _parse_dep_string(item.strip())
            status = _dep_status_from_signals(name, deprecated_list, risky_list)
            normalized.append({"name": name, "version": version, "status": status})
    deps["external"] = normalized


def _parse_dep_string(s: str) -> tuple:
    """Parse a dependency string into (name, version).

    Handles several common formats the AI uses:
      "Spring Boot 3.2.1"
      "hibernate-validator 6.0.18.Final"
      "org.apache.derby:derby:10.17.1.0"
      "jakarta.servlet:jakarta.servlet-api:6.1.0 (compileOnly)"
      "Ajv (JSON Schema validation - appears in ...)"
    Returns (name, version) as strings; version may be "".
    """
    # Strip parenthetical qualifiers like "(compileOnly)" or "(JSON Schema validation ...)"
    # but only when they follow a version number — so "Ajv (desc)" stays as name-only
    s_clean = re.sub(r'\s*\([^)]*\)\s*$', '', s).strip()

    # Maven / Gradle coordinate: group:artifact:version
    maven_m = re.match(r'^[\w.\-]+:[\w.\-]+:([\d][\d.\w\-]+)$', s_clean)
    if maven_m:
        # Use just the artifact name as the display name
        parts = s_clean.split(':')
        return parts[1], parts[2]

    # "Name X.Y.Z" — version at end
    ver_m = re.match(r'^(.*?)\s+([\d][\d.\w\-]+)$', s_clean)
    if ver_m:
        return ver_m.group(1).strip(), ver_m.group(2).strip()

    # No version found; return the original (with parenthetical if it didn't look like a qualifier)
    return s_clean, ""


def _deserialize_analysis(row: Dict):
    for field in ["technology_summary", "code_structure", "dependencies", "architecture",
                  "technical_debt", "raw_analysis"]:
        val = row.get(field)
        if isinstance(val, str):
            try:
                row[field] = json.loads(val)
            except Exception:
                pass
    # Normalize deps.external strings → objects (handles older stored analyses)
    deps = row.get("dependencies")
    if isinstance(deps, dict):
        _normalize_deps_external(deps)


def get_project_issues(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        results = conn.execute(
            "SELECT * FROM issues WHERE project_id = ? ORDER BY priority ASC, severity DESC",
            [project_id]
        ).fetchall()
        cols = [d[0] for d in conn.description]
        return [dict(zip(cols, r)) for r in results]
    finally:
        conn.close()


def get_project_recommendations(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        results = conn.execute(
            "SELECT * FROM recommendations WHERE project_id = ? ORDER BY created_at",
            [project_id]
        ).fetchall()
        cols = [d[0] for d in conn.description]
        rows = []
        for r in results:
            row = dict(zip(cols, r))
            if isinstance(row.get("related_files"), str):
                try:
                    row["related_files"] = json.loads(row["related_files"])
                except Exception:
                    row["related_files"] = []
            rows.append(row)
        return rows
    finally:
        conn.close()


def get_architecture_models(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        results = conn.execute(
            "SELECT * FROM architecture_models WHERE project_id = ? ORDER BY created_at",
            [project_id]
        ).fetchall()
        cols = [d[0] for d in conn.description]
        rows = []
        for r in results:
            row = dict(zip(cols, r))
            for field in ["nodes", "edges"]:
                if isinstance(row.get(field), str):
                    try:
                        row[field] = json.loads(row[field])
                    except Exception:
                        row[field] = []
            rows.append(row)
        return rows
    finally:
        conn.close()


def get_modernization_plan(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        plan_row = conn.execute(
            "SELECT * FROM modernization_plans WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
            [project_id]
        ).fetchone()
        if not plan_row:
            return None
        cols = [d[0] for d in conn.description]
        plan = dict(zip(cols, plan_row))
        if isinstance(plan.get("stages"), str):
            try:
                plan["stages"] = json.loads(plan["stages"])
            except Exception:
                plan["stages"] = []

        task_rows = conn.execute(
            "SELECT * FROM plan_tasks WHERE plan_id = ? ORDER BY suggested_order",
            [plan["id"]]
        ).fetchall()
        tcols = [d[0] for d in conn.description]
        tasks = []
        for tr in task_rows:
            task = dict(zip(tcols, tr))
            for f in ["related_files", "dependencies"]:
                if isinstance(task.get(f), str):
                    try:
                        task[f] = json.loads(task[f])
                    except Exception:
                        task[f] = []
            tasks.append(task)

        plan["tasks"] = tasks
        return plan
    finally:
        conn.close()


def update_task_status(task_id: str, status: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        conn.execute(
            "UPDATE plan_tasks SET status = ?, updated_at = ? WHERE id = ?",
            [status, datetime.utcnow(), task_id]
        )
        conn.commit()
        result = conn.execute("SELECT * FROM plan_tasks WHERE id = ?", [task_id]).fetchone()
        if not result:
            return None
        cols = [d[0] for d in conn.description]
        return dict(zip(cols, result))
    finally:
        conn.close()
