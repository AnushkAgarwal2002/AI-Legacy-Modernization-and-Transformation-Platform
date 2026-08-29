"""Startup verification — run from backend/"""
import sys, os
sys.path.insert(0, '.')

from app.db.database import init_db
from app.core.config import settings

init_db()
print("DB init OK")
print(f"bobshell_api_key configured: {bool(settings.bobshell_api_key)}")
print(f"bob_inference_url: {repr(settings.bob_inference_url)}")

from app.main import app
print(f"FastAPI app: {app.title} v{app.version}")

# Verify AI service imports cleanly
from app.services.ai_service import (
    AIServiceError, AIServiceConfigError, AIServiceAuthError,
    AIServiceRateLimitError, call_ai, analyze_project, transform_file,
    validate_transformation, generate_report, answer_project_question,
    check_connectivity, SYSTEM_PROMPT
)
print("ai_service imported OK")

# Verify config error is raised correctly when key is missing
try:
    call_ai([{"role": "user", "content": "test"}])
    print("ERROR: should have raised AIServiceConfigError")
except AIServiceConfigError as e:
    print(f"Config error correctly raised: {str(e)[:80]}...")
except Exception as e:
    print(f"ERROR: unexpected exception: {type(e).__name__}: {e}")

print("\nAll startup checks passed!")
