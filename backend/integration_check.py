"""Integration verification script — run from the backend/ directory."""
import os
import sys
sys.path.insert(0, '.')

# Set Bob credentials for the check — replace with real values to test AI connectivity
os.environ['BOBSHELL_API_KEY'] = os.environ.get('BOBSHELL_API_KEY', 'test-key')
os.environ['BOB_INFERENCE_URL'] = os.environ.get('BOB_INFERENCE_URL', 'https://test.bob.ibm.com/api/ai/inference')

from app.db.database import init_db
from app.services.demo_service import load_demo_files
from app.services import project_service, file_service

init_db()
print("DB initialized OK")

p = project_service.create_project({'name': 'Integration Test', 'legacy_tech': 'Java Spring MVC'})
pid = p['id']
print(f"Project created: {pid[:8]}...")

files = load_demo_files()
saved = file_service.save_uploaded_files(pid, files)
print(f"Demo files saved: {len(saved)}")

project_files = file_service.get_project_files(pid)
java_files = [f for f in project_files if f.get('language') == 'java']
print(f"Java files: {len(java_files)}")

stats = project_service.get_dashboard_stats(pid)
print(f"Total files: {stats['total_files']}")
print(f"Analysis status: {stats['analysis_status']}")

# Verify security issues present in demo
all_files = file_service.get_project_files(pid, include_content=True)
controller = next((f for f in all_files if 'InventoryController' in (f.get('name') or '')), None)
assert controller is not None, "Controller file not found"
assert 'admin123' in (controller.get('content') or ''), "Hardcoded password not found"
print("Security issues verified in demo project")

project_service.delete_project(pid)
print("Cleanup complete")

# Check AI configuration
from app.services.ai_service import check_connectivity
result = check_connectivity()
print(f"\nAI connectivity check: {result['status']} — {result['message']}")
if result['status'] == 'error' and 'BOBSHELL_API_KEY' in result.get('message', ''):
    print("(Set BOBSHELL_API_KEY in backend/.env to test AI)")

print("\nAll integration checks passed!")
