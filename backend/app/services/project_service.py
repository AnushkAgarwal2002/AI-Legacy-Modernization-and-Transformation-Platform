"""
Project management service.
"""
import os
import json
import uuid
import shutil
from datetime import datetime
from typing import Optional, List, Dict, Any
from ..db.database import get_db
from ..core.config import settings


def create_project(data: Dict[str, Any]) -> Dict[str, Any]:
    project_id = str(uuid.uuid4())
    now = datetime.utcnow()
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO projects (id, name, description, legacy_tech, target_tech, objective, status, created_at, updated_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, 'created', ?, ?, ?)
        """, [
            project_id,
            data["name"],
            data.get("description"),
            data.get("legacy_tech"),
            data.get("target_tech"),
            data.get("objective"),
            now,
            now,
            json.dumps(data.get("metadata") or {})
        ])
        conn.commit()
        return get_project(project_id)
    finally:
        conn.close()


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        result = conn.execute(
            "SELECT * FROM projects WHERE id = ?", [project_id]
        ).fetchone()
        if not result:
            return None
        cols = [d[0] for d in conn.description]
        row = dict(zip(cols, result))
        if isinstance(row.get("metadata"), str):
            try:
                row["metadata"] = json.loads(row["metadata"])
            except Exception:
                row["metadata"] = {}
        return row
    finally:
        conn.close()


def list_projects() -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        results = conn.execute(
            "SELECT * FROM projects ORDER BY updated_at DESC"
        ).fetchall()
        cols = [d[0] for d in conn.description]
        rows = []
        for r in results:
            row = dict(zip(cols, r))
            if isinstance(row.get("metadata"), str):
                try:
                    row["metadata"] = json.loads(row["metadata"])
                except Exception:
                    row["metadata"] = {}
            rows.append(row)
        return rows
    finally:
        conn.close()


def update_project(project_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    now = datetime.utcnow()
    conn = get_db()
    try:
        fields = []
        values = []
        for key in ["name", "description", "legacy_tech", "target_tech", "objective", "status"]:
            if key in data and data[key] is not None:
                fields.append(f"{key} = ?")
                values.append(data[key])
        if "metadata" in data:
            fields.append("metadata = ?")
            values.append(json.dumps(data["metadata"] or {}))
        fields.append("updated_at = ?")
        values.append(now)
        values.append(project_id)

        if fields:
            conn.execute(
                f"UPDATE projects SET {', '.join(fields)} WHERE id = ?",
                values
            )
            conn.commit()
        return get_project(project_id)
    finally:
        conn.close()


def delete_project(project_id: str) -> bool:
    conn = get_db()
    try:
        conn.execute("DELETE FROM projects WHERE id = ?", [project_id])
        conn.execute("DELETE FROM project_files WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM analyses WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM issues WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM recommendations WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM modernization_plans WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM plan_tasks WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM transformations WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM validation_results WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM architecture_models WHERE project_id = ?", [project_id])
        conn.execute("DELETE FROM chat_messages WHERE project_id = ?", [project_id])
        conn.commit()
        # remove upload directory
        upload_dir = os.path.join(settings.uploads_dir, project_id)
        if os.path.exists(upload_dir):
            shutil.rmtree(upload_dir)
        return True
    finally:
        conn.close()


def get_dashboard_stats(project_id: str) -> Dict[str, Any]:
    conn = get_db()
    try:
        total_files = conn.execute(
            "SELECT COUNT(*) FROM project_files WHERE project_id = ?", [project_id]
        ).fetchone()[0]

        total_issues = conn.execute(
            "SELECT COUNT(*) FROM issues WHERE project_id = ?", [project_id]
        ).fetchone()[0]

        high_issues = conn.execute(
            "SELECT COUNT(*) FROM issues WHERE project_id = ? AND severity IN ('critical', 'high')",
            [project_id]
        ).fetchone()[0]

        total_recs = conn.execute(
            "SELECT COUNT(*) FROM recommendations WHERE project_id = ?", [project_id]
        ).fetchone()[0]

        total_tasks = conn.execute(
            "SELECT COUNT(*) FROM plan_tasks WHERE project_id = ?", [project_id]
        ).fetchone()[0]

        completed_tasks = conn.execute(
            "SELECT COUNT(*) FROM plan_tasks WHERE project_id = ? AND status = 'completed'",
            [project_id]
        ).fetchone()[0]

        total_transforms = conn.execute(
            "SELECT COUNT(*) FROM transformations WHERE project_id = ?", [project_id]
        ).fetchone()[0]

        # Get latest analysis status
        analysis_row = conn.execute(
            "SELECT status FROM analyses WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
            [project_id]
        ).fetchone()
        analysis_status = analysis_row[0] if analysis_row else "not_started"

        return {
            "total_files": total_files,
            "analyzed_files": total_files,
            "total_issues": total_issues,
            "high_priority_issues": high_issues,
            "total_recommendations": total_recs,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "transformations_performed": total_transforms,
            "validation_status": "pending",
            "remaining_risks": high_issues,
            "analysis_status": analysis_status,
        }
    finally:
        conn.close()
