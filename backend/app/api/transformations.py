"""
API routes for transformations and validation.
"""
from fastapi import APIRouter, HTTPException
from ..models.schemas import TransformationRequest
from ..services import transformation_service
from ..services.project_service import get_project

router = APIRouter(prefix="/projects/{project_id}/transformations", tags=["transformations"])


@router.post("")
def create_transformation(project_id: str, request: TransformationRequest):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        result = transformation_service.create_transformation(
            project_id=project_id,
            file_path=request.file_path,
            task_id=request.task_id,
            instruction=request.instruction,
            target_tech=request.target_tech,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformation failed: {str(e)}")


@router.get("")
def list_transformations(project_id: str):
    return transformation_service.get_project_transformations(project_id)


@router.get("/validation/all")
def get_all_validations(project_id: str):
    return transformation_service.get_project_validations(project_id)


@router.get("/{transformation_id}")
def get_transformation(project_id: str, transformation_id: str):
    t = transformation_service.get_transformation(transformation_id)
    if not t or t["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Transformation not found")
    return t


@router.patch("/{transformation_id}")
def update_transformation_status(project_id: str, transformation_id: str, data: dict):
    status = data.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="status required")
    result = transformation_service.update_transformation_status(transformation_id, status)
    if not result:
        raise HTTPException(status_code=404, detail="Transformation not found")
    return result


@router.post("/{transformation_id}/validate")
def validate_transformation(project_id: str, transformation_id: str):
    t = transformation_service.get_transformation(transformation_id)
    if not t or t["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Transformation not found")
    try:
        result = transformation_service.run_validation(project_id, transformation_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")
