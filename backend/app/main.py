"""
Legacy Application Modernization Platform — FastAPI Backend
"""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .db.database import init_db
from .core.config import settings
from .api import projects, files, analysis, transformations, chat, reports
from .services.ai_service import (
    AIServiceConfigError,
    AIServiceAuthError,
    AIServiceRateLimitError,
    AIServiceError,
    check_connectivity,
)


# Initialize DB on startup
init_db()

# Create data directories
os.makedirs(settings.uploads_dir, exist_ok=True)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-Assisted Legacy Application Modernization and Transformation Platform",
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global error handlers for Bob AI errors ──────────────────────────────────

@app.exception_handler(AIServiceConfigError)
async def ai_config_error_handler(request: Request, exc: AIServiceConfigError):
    return JSONResponse(status_code=503, content={
        "error": "ai_not_configured",
        "detail": str(exc),
    })


@app.exception_handler(AIServiceAuthError)
async def ai_auth_error_handler(request: Request, exc: AIServiceAuthError):
    return JSONResponse(status_code=503, content={
        "error": "ai_auth_failed",
        "detail": str(exc),
    })


@app.exception_handler(AIServiceRateLimitError)
async def ai_rate_limit_handler(request: Request, exc: AIServiceRateLimitError):
    return JSONResponse(status_code=429, content={
        "error": "ai_rate_limited",
        "detail": str(exc),
    })


@app.exception_handler(AIServiceError)
async def ai_error_handler(request: Request, exc: AIServiceError):
    return JSONResponse(status_code=502, content={
        "error": "ai_error",
        "detail": str(exc),
    })

# Register API routers
prefix = settings.api_prefix
app.include_router(projects.router, prefix=prefix)
app.include_router(files.router, prefix=prefix)
app.include_router(analysis.router, prefix=prefix)
app.include_router(transformations.router, prefix=prefix)
app.include_router(chat.router, prefix=prefix)
app.include_router(reports.router, prefix=prefix)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": settings.app_version,
        "ai_configured": bool(settings.bobshell_api_key),
    }


@app.get("/api/ai/status")
def ai_status():
    """
    Check IBM Bob Shell connectivity.
    Returns configuration status without exposing secret values.
    """
    if not settings.bobshell_api_key:
        return {
            "configured": False,
            "missing": ["BOBSHELL_API_KEY"],
            "message": "Missing required environment variable: BOBSHELL_API_KEY",
        }
    result = check_connectivity()
    return {"configured": True, **result}


# Serve React frontend (after build)
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        index = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index):
            return FileResponse(index)
        return {"error": "Frontend not built"}
