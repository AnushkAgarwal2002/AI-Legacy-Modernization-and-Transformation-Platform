"""
API routes for analysis.
"""
import threading
from fastapi import APIRouter, HTTPException, BackgroundTasks
from ..models.schemas import AnalysisRequest
from ..services import analysis_service
from ..services.project_service import get_project

router = APIRouter(prefix="/projects/{project_id}/analysis", tags=["analysis"])


@router.post("/start")
def start_analysis(project_id: str, request: AnalysisRequest = AnalysisRequest()):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    analysis = analysis_service.get_or_create_analysis(project_id, force=request.force_reanalyze)

    # Run in background thread
    if analysis.get("status") == "running":
        thread = threading.Thread(
            target=analysis_service.run_analysis,
            args=(project_id, analysis["id"]),
            daemon=True
        )
        thread.start()

    return {"analysis_id": analysis["id"], "status": analysis.get("status")}


@router.get("/status")
def get_analysis_status(project_id: str):
    analysis = analysis_service.get_project_analysis(project_id)
    if not analysis:
        return {"status": "not_started"}
    return {
        "analysis_id": analysis.get("id"),
        "status": analysis.get("status"),
        "error_message": analysis.get("error_message"),
        "completed_at": str(analysis.get("completed_at")) if analysis.get("completed_at") else None,
    }


@router.get("")
def get_analysis(project_id: str):
    analysis = analysis_service.get_project_analysis(project_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found. Run analysis first.")
    return analysis


@router.get("/issues")
def get_issues(project_id: str):
    return analysis_service.get_project_issues(project_id)


@router.patch("/issues/{issue_id}")
def update_issue(project_id: str, issue_id: str, data: dict):
    from ..db.database import get_db
    from datetime import datetime
    conn = get_db()
    try:
        status = data.get("status")
        priority = data.get("priority")
        if status:
            conn.execute(
                "UPDATE issues SET status = ? WHERE id = ? AND project_id = ?",
                [status, issue_id, project_id]
            )
        if priority is not None:
            conn.execute(
                "UPDATE issues SET priority = ? WHERE id = ? AND project_id = ?",
                [priority, issue_id, project_id]
            )
        conn.commit()
        result = conn.execute("SELECT * FROM issues WHERE id = ?", [issue_id]).fetchone()
        cols = [d[0] for d in conn.description]
        return dict(zip(cols, result)) if result else {}
    finally:
        conn.close()


@router.get("/recommendations")
def get_recommendations(project_id: str):
    return analysis_service.get_project_recommendations(project_id)


@router.get("/architecture")
def get_architecture(project_id: str):
    models = analysis_service.get_architecture_models(project_id)
    return models


@router.get("/plan")
def get_plan(project_id: str):
    plan = analysis_service.get_modernization_plan(project_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No modernization plan found.")
    return plan


@router.patch("/plan/tasks/{task_id}")
def update_task(project_id: str, task_id: str, data: dict):
    status = data.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="status field required")
    result = analysis_service.update_task_status(task_id, status)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return result
