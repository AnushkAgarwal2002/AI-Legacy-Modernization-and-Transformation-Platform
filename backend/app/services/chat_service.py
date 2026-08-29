"""
Chat/AI interaction service.
"""
import uuid
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from ..db.database import get_db
from ..services.project_service import get_project
from ..services.file_service import get_project_files, get_file_by_path
from ..services.analysis_service import get_project_analysis
from . import ai_service


def _build_project_context(project_id: str) -> str:
    project = get_project(project_id)
    if not project:
        return "Project context unavailable."

    analysis = get_project_analysis(project_id)
    ctx_parts = [
        f"Project: {project['name']}",
        f"Legacy Tech: {project.get('legacy_tech', 'Unknown')}",
        f"Target Tech: {project.get('target_tech', 'Unknown')}",
        f"Objective: {project.get('objective', 'Not specified')}",
    ]

    if analysis and analysis.get("status") == "completed":
        tech = analysis.get("technology_summary") or {}
        arch = analysis.get("architecture") or {}
        ctx_parts += [
            f"Detected Languages: {', '.join(tech.get('languages', ['Unknown']))}",
            f"Frameworks: {', '.join(tech.get('frameworks', ['Unknown']))}",
            f"Architecture Pattern: {arch.get('pattern', 'Unknown')}",
            f"Architecture Description: {arch.get('description', '')}",
        ]

    return "\n".join(ctx_parts)


def chat(
    project_id: str,
    message: str,
    context_file: Optional[str] = None,
    context_type: Optional[str] = None
) -> str:
    """Send a chat message and return the AI response."""
    project_context = _build_project_context(project_id)

    file_context = None
    if context_file:
        file_data = get_file_by_path(project_id, context_file)
        if file_data and file_data.get("content"):
            file_context = f"File: {context_file}\n```\n{file_data['content'][:4000]}\n```"

    response = ai_service.answer_project_question(
        question=message,
        project_context=project_context,
        file_context=file_context,
        context_type=context_type
    )

    # Persist the exchange
    conn = get_db()
    try:
        now = datetime.utcnow()
        for role, content in [("user", message), ("assistant", response)]:
            msg_id = str(uuid.uuid4())
            conn.execute("""
                INSERT INTO chat_messages
                (id, project_id, role, content, context_file, context_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [msg_id, project_id, role, content, context_file, context_type, now])
        conn.commit()
    finally:
        conn.close()

    return response


def get_chat_history(project_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        results = conn.execute(
            "SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at DESC LIMIT ?",
            [project_id, limit]
        ).fetchall()
        cols = [d[0] for d in conn.description]
        rows = [dict(zip(cols, r)) for r in results]
        return list(reversed(rows))
    finally:
        conn.close()


def clear_chat_history(project_id: str):
    conn = get_db()
    try:
        conn.execute("DELETE FROM chat_messages WHERE project_id = ?", [project_id])
        conn.commit()
    finally:
        conn.close()
