"""
API routes for chat/AI interaction.
"""
from fastapi import APIRouter, HTTPException
from ..models.schemas import ChatRequest
from ..services import chat_service
from ..services.project_service import get_project

router = APIRouter(prefix="/projects/{project_id}/chat", tags=["chat"])


@router.post("")
def send_message(project_id: str, request: ChatRequest):
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        response = chat_service.chat(
            project_id=project_id,
            message=request.message,
            context_file=request.context_file,
            context_type=request.context_type,
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.get("/history")
def get_history(project_id: str):
    return chat_service.get_chat_history(project_id)


@router.delete("/history")
def clear_history(project_id: str):
    chat_service.clear_chat_history(project_id)
    return {"message": "Chat history cleared"}
