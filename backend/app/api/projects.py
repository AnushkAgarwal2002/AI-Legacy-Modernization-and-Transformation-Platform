"""
API routes for project management.
"""
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List
from ..models.schemas import ProjectCreate, ProjectUpdate, Project, DashboardStats
from ..services import project_service, analysis_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=dict)
def create_project(data: ProjectCreate):
    try:
        project = project_service.create_project(data.model_dump())
        return project
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=list)
def list_projects():
    return project_service.list_projects()


@router.get("/{project_id}")
def get_project(project_id: str):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}")
def update_project(project_id: str, data: ProjectUpdate):
    project = project_service.update_project(project_id, data.model_dump(exclude_none=True))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}")
def delete_project(project_id: str):
    ok = project_service.delete_project(project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}


@router.get("/{project_id}/dashboard")
def get_dashboard(project_id: str):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    stats = project_service.get_dashboard_stats(project_id)
    meta = project.get("metadata") or {}
    stats["assessment_scores"] = meta.get("assessment_scores")
    stats["executive_summary"] = meta.get("executive_summary")
    return stats
