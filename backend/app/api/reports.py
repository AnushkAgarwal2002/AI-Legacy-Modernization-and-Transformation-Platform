"""
API routes for report generation.
"""
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime, date
from ..models.schemas import ReportRequest
from ..services import analysis_service, transformation_service
from ..services.project_service import get_project
from ..services import ai_service

router = APIRouter(prefix="/projects/{project_id}/report", tags=["report"])


def _jsonify(obj):
    """Recursively convert non-serializable types to strings."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _jsonify(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonify(i) for i in obj]
    return obj


@router.post("")
def generate_report(project_id: str, request: ReportRequest = ReportRequest()):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    analysis = analysis_service.get_project_analysis(project_id)
    issues = analysis_service.get_project_issues(project_id)
    recommendations = analysis_service.get_project_recommendations(project_id)
    transformations = transformation_service.get_project_transformations(project_id)
    plan = analysis_service.get_modernization_plan(project_id)
    arch_models = analysis_service.get_architecture_models(project_id)

    if not analysis or analysis.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail="Analysis must be completed before generating a report."
        )

    try:
        report_content = ai_service.generate_report(
            project=project,
            analysis=analysis,
            issues=issues,
            recommendations=recommendations,
            transformations=transformations,
            plan=plan
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

    meta = project.get("metadata") or {}

    return JSONResponse(content=_jsonify({
        "project_id": project_id,
        "project_name": project["name"],
        "generated_at": datetime.utcnow().isoformat(),
        "executive_summary": report_content.get("executive_summary") or meta.get("executive_summary", ""),
        "technology_inventory": (analysis.get("technology_summary") or {}),
        "architecture_assessment": report_content.get("architecture_assessment", ""),
        "technical_debt_summary": report_content.get("technical_debt_summary", ""),
        "recommendations_summary": [{
            "title": r.get("title"),
            "category": r.get("category"),
            "priority": r.get("priority"),
            "proposed_solution": r.get("proposed_solution"),
        } for r in recommendations[:20]],
        "target_architecture": report_content.get("target_architecture", ""),
        "migration_plan_summary": report_content.get("migration_plan_summary", ""),
        "transformation_summary": report_content.get("transformation_summary", ""),
        "validation_summary": report_content.get("validation_summary", ""),
        "risks": report_content.get("risks", []),
        "manual_review_items": report_content.get("manual_review_items", []),
        "assessment_scores": meta.get("assessment_scores", {}),
        "issues_count": len(issues),
        "high_priority_issues": sum(1 for i in issues if i.get("severity") in ["critical", "high"]),
        "transformations_count": len(transformations),
        "architecture_models": [{"model_type": m["model_type"], "pattern": m.get("pattern")} for m in arch_models],
    }))
