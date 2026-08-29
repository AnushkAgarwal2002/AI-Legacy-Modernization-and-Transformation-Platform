"""
API routes for file management and upload.
"""
import os
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
from ..services import file_service
from ..services.project_service import get_project

router = APIRouter(prefix="/projects/{project_id}/files", tags=["files"])

MAX_SIZE = 50 * 1024 * 1024  # 50MB


@router.get("")
def list_files(project_id: str):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    files = file_service.get_project_files(project_id, include_content=False)
    return files


@router.get("/{file_id}")
def get_file(project_id: str, file_id: str):
    f = file_service.get_file(file_id)
    if not f or f["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="File not found")
    return f


@router.post("/upload")
async def upload_files(
    project_id: str,
    files: List[UploadFile] = File(...),
    replace: bool = Form(default=False)
):
    """Upload individual files to a project."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    files_data = []
    errors = []

    for upload in files:
        try:
            raw = await upload.read()
            if len(raw) > MAX_SIZE:
                errors.append(f"{upload.filename}: File too large (max 50MB)")
                continue

            filename = os.path.basename(upload.filename or "unknown")
            is_binary = file_service.is_binary_file(filename)
            is_supported = file_service.is_supported_file(filename) and not is_binary
            content = None
            if is_supported:
                try:
                    content = raw.decode("utf-8", errors="replace")
                except Exception:
                    is_binary = True
                    is_supported = False

            files_data.append({
                "path": upload.filename or filename,
                "name": filename,
                "content": content,
                "size_bytes": len(raw),
                "is_binary": is_binary,
                "is_supported": is_supported,
            })
        except Exception as e:
            errors.append(f"{upload.filename}: {str(e)}")

    saved = file_service.save_uploaded_files(project_id, files_data, replace=replace)
    return {
        "saved": len(saved),
        "files": saved,
        "errors": errors
    }


@router.post("/upload-zip")
async def upload_zip(
    project_id: str,
    file: UploadFile = File(...),
    replace: bool = Form(default=True)
):
    """Upload a ZIP archive containing an entire project."""
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    raw = await file.read()
    if len(raw) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Archive too large (max 50MB)")

    try:
        files_data = file_service.extract_zip_contents(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not extract ZIP: {str(e)}")

    saved = file_service.save_uploaded_files(project_id, files_data, replace=replace)
    return {
        "saved": len(saved),
        "files": [{"path": f["path"], "name": f["name"], "is_binary": f.get("is_binary")} for f in saved],
    }


@router.post("/upload-demo")
def load_demo_project(project_id: str):
    """Load the built-in demo legacy project."""
    from ..services.demo_service import load_demo_files
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    files_data = load_demo_files()
    saved = file_service.save_uploaded_files(project_id, files_data, replace=True)
    return {
        "saved": len(saved),
        "message": "Demo project loaded successfully",
        "files": [{"path": f["path"], "name": f["name"]} for f in saved],
    }
