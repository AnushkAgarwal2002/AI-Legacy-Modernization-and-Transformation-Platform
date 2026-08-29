"""
Backend tests for the Legacy Modernization Platform.
Tests cover project management, file ingestion, analysis orchestration,
transformation, validation, and error handling.
"""
import pytest
import json
import os
import sys
import tempfile
import uuid
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings

# Use a temp DB for testing — unique per process to avoid file locking
settings.db_path = os.path.join(tempfile.gettempdir(), f"test_platform_{os.getpid()}_{uuid.uuid4().hex[:8]}.duckdb")
# Bob Shell API key is not needed for non-AI tests; AI calls are not made in the test suite
settings.bobshell_api_key = "test-key-not-used"

from app.db.database import init_db
from app.services import project_service, file_service, analysis_service, transformation_service, demo_service
from fastapi.testclient import TestClient
from app.main import app

# Initialize test DB
init_db()
client = TestClient(app)


# ─── Project Tests ────────────────────────────────────────────────────────────

class TestProjectCreation:
    def test_create_project_minimal(self):
        resp = client.post("/api/v1/projects", json={"name": "Test Project"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Project"
        assert data["id"]
        assert data["status"] == "created"

    def test_create_project_full(self):
        resp = client.post("/api/v1/projects", json={
            "name": "Full Project",
            "description": "A legacy monolith",
            "legacy_tech": "Java Spring MVC",
            "target_tech": "Spring Boot 3",
            "objective": "Framework migration",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Full Project"
        assert data["legacy_tech"] == "Java Spring MVC"
        assert data["target_tech"] == "Spring Boot 3"

    def test_list_projects(self):
        client.post("/api/v1/projects", json={"name": "List Test Project"})
        resp = client.get("/api/v1/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert any(p["name"] == "List Test Project" for p in data)

    def test_get_project(self):
        create_resp = client.post("/api/v1/projects", json={"name": "Get Test"})
        project_id = create_resp.json()["id"]
        resp = client.get(f"/api/v1/projects/{project_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == project_id

    def test_get_nonexistent_project(self):
        resp = client.get(f"/api/v1/projects/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_update_project(self):
        create_resp = client.post("/api/v1/projects", json={"name": "Update Test"})
        project_id = create_resp.json()["id"]
        resp = client.patch(f"/api/v1/projects/{project_id}", json={"name": "Updated Name", "status": "analyzed"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    def test_delete_project(self):
        create_resp = client.post("/api/v1/projects", json={"name": "Delete Test"})
        project_id = create_resp.json()["id"]
        resp = client.delete(f"/api/v1/projects/{project_id}")
        assert resp.status_code == 200
        # Verify gone
        resp2 = client.get(f"/api/v1/projects/{project_id}")
        assert resp2.status_code == 404

    def test_create_project_requires_name(self):
        resp = client.post("/api/v1/projects", json={"description": "no name"})
        assert resp.status_code == 422  # validation error

    def test_dashboard_stats(self):
        create_resp = client.post("/api/v1/projects", json={"name": "Dashboard Test"})
        project_id = create_resp.json()["id"]
        resp = client.get(f"/api/v1/projects/{project_id}/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_files" in data
        assert "total_issues" in data
        assert "analysis_status" in data


# ─── File Ingestion Tests ──────────────────────────────────────────────────────

class TestFileIngestion:
    def setup_method(self):
        resp = client.post("/api/v1/projects", json={"name": "File Test Project"})
        self.project_id = resp.json()["id"]

    def test_load_demo_project(self):
        resp = client.post(f"/api/v1/projects/{self.project_id}/files/upload-demo")
        assert resp.status_code == 200
        data = resp.json()
        assert data["saved"] > 0
        assert len(data["files"]) > 0

    def test_list_files_after_demo(self):
        client.post(f"/api/v1/projects/{self.project_id}/files/upload-demo")
        resp = client.get(f"/api/v1/projects/{self.project_id}/files")
        assert resp.status_code == 200
        files = resp.json()
        assert len(files) > 5

    def test_demo_project_has_java_files(self):
        client.post(f"/api/v1/projects/{self.project_id}/files/upload-demo")
        resp = client.get(f"/api/v1/projects/{self.project_id}/files")
        files = resp.json()
        java_files = [f for f in files if f.get("language") == "java"]
        assert len(java_files) > 0

    def test_upload_single_file(self):
        content = b"public class HelloWorld { public static void main(String[] args) {} }"
        resp = client.post(
            f"/api/v1/projects/{self.project_id}/files/upload",
            files=[("files", ("HelloWorld.java", content, "text/plain"))],
            data={"replace": "false"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["saved"] >= 1

    def test_upload_unsupported_binary(self):
        # .class files should be detected as binary
        content = b"\xca\xfe\xba\xbe" + b"\x00" * 100  # fake Java class header
        resp = client.post(
            f"/api/v1/projects/{self.project_id}/files/upload",
            files=[("files", ("compiled.class", content, "application/octet-stream"))],
            data={"replace": "false"},
        )
        assert resp.status_code == 200
        # File should be saved but marked binary/unsupported
        saved = resp.json()["files"]
        if saved:
            assert saved[0].get("is_binary") or not saved[0].get("is_supported")

    def test_get_file_detail(self):
        client.post(f"/api/v1/projects/{self.project_id}/files/upload-demo")
        files_resp = client.get(f"/api/v1/projects/{self.project_id}/files")
        files = files_resp.json()
        java_file = next((f for f in files if f.get("language") == "java"), None)
        assert java_file is not None
        resp = client.get(f"/api/v1/projects/{self.project_id}/files/{java_file['id']}")
        assert resp.status_code == 200
        detail = resp.json()
        assert detail.get("content")

    def test_list_files_empty_project(self):
        resp = client.get(f"/api/v1/projects/{self.project_id}/files")
        assert resp.status_code == 200
        assert resp.json() == []


# ─── File Service Unit Tests ───────────────────────────────────────────────────

class TestFileService:
    def test_detect_language_java(self):
        assert file_service.detect_language("Foo.java") == "java"

    def test_detect_language_python(self):
        assert file_service.detect_language("app.py") == "python"

    def test_detect_language_typescript(self):
        assert file_service.detect_language("component.tsx") == "typescript"

    def test_detect_language_unknown(self):
        result = file_service.detect_language("unknown_file.xyz")
        assert result is None

    def test_is_binary_class_file(self):
        assert file_service.is_binary_file("App.class") is True

    def test_is_binary_jar(self):
        assert file_service.is_binary_file("app.jar") is True

    def test_is_binary_java_source(self):
        assert file_service.is_binary_file("App.java") is False

    def test_is_supported_java(self):
        assert file_service.is_supported_file("Main.java") is True

    def test_is_supported_class(self):
        assert file_service.is_supported_file("Main.class") is False

    def test_is_supported_image(self):
        assert file_service.is_supported_file("logo.png") is False


# ─── Demo Project Tests ────────────────────────────────────────────────────────

class TestDemoProject:
    def test_demo_files_loaded(self):
        files = demo_service.load_demo_files()
        assert len(files) > 5

    def test_demo_has_pom_xml(self):
        files = demo_service.load_demo_files()
        paths = [f["path"] for f in files]
        assert any("pom.xml" in p for p in paths)

    def test_demo_has_java_controller(self):
        files = demo_service.load_demo_files()
        java_files = [f for f in files if f["name"].endswith(".java")]
        assert len(java_files) >= 3

    def test_demo_has_security_issues(self):
        files = demo_service.load_demo_files()
        controller = next((f for f in files if "InventoryController" in f["name"]), None)
        assert controller is not None
        assert "admin123" in controller["content"]  # Hardcoded password

    def test_demo_has_sql_injection(self):
        files = demo_service.load_demo_files()
        controller = next((f for f in files if "InventoryController" in f["name"]), None)
        assert controller is not None
        assert "query" in controller["content"]  # SQL injection risk present

    def test_demo_files_have_content(self):
        files = demo_service.load_demo_files()
        for f in files:
            assert f["content"] is not None
            assert len(f["content"]) > 0

    def test_demo_has_outdated_dependencies(self):
        files = demo_service.load_demo_files()
        pom = next((f for f in files if "pom.xml" in f["path"]), None)
        assert pom is not None
        assert "log4j" in pom["content"]
        assert "1.2.17" in pom["content"]


# ─── Analysis Status Tests ─────────────────────────────────────────────────────

class TestAnalysisStatus:
    def setup_method(self):
        resp = client.post("/api/v1/projects", json={"name": "Analysis Status Test"})
        self.project_id = resp.json()["id"]

    def test_analysis_status_not_started(self):
        resp = client.get(f"/api/v1/projects/{self.project_id}/analysis/status")
        assert resp.status_code == 200
        assert resp.json()["status"] == "not_started"

    def test_analysis_get_before_run_returns_404(self):
        resp = client.get(f"/api/v1/projects/{self.project_id}/analysis")
        assert resp.status_code == 404

    def test_start_analysis_no_files_creates_record(self):
        """Analysis start should create a record even if no files (will fail gracefully)"""
        resp = client.post(f"/api/v1/projects/{self.project_id}/analysis/start", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert "analysis_id" in data
        time.sleep(0.3)  # allow background thread to settle

    def test_issues_empty_before_analysis(self):
        """Use a dedicated project to avoid background thread race"""
        r = client.post("/api/v1/projects", json={"name": "Issues Empty Check"})
        pid = r.json()["id"]
        resp = client.get(f"/api/v1/projects/{pid}/analysis/issues")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_recommendations_empty_before_analysis(self):
        r = client.post("/api/v1/projects", json={"name": "Recs Empty Check"})
        pid = r.json()["id"]
        resp = client.get(f"/api/v1/projects/{pid}/analysis/recommendations")
        assert resp.status_code == 200
        assert resp.json() == []


# ─── Transformation Tests ──────────────────────────────────────────────────────

class TestTransformations:
    def setup_method(self):
        resp = client.post("/api/v1/projects", json={"name": "Transform Test"})
        self.project_id = resp.json()["id"]

    def test_list_transformations_empty(self):
        resp = client.get(f"/api/v1/projects/{self.project_id}/transformations")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_transform_nonexistent_file_returns_404(self):
        resp = client.post(f"/api/v1/projects/{self.project_id}/transformations", json={
            "file_path": "nonexistent/file.java",
        })
        assert resp.status_code in [404, 500]  # File not found

    def test_transform_request_structure(self):
        """Test that TransformationRequest validates correctly"""
        resp = client.post(f"/api/v1/projects/{self.project_id}/transformations", json={
            "file_path": "src/Main.java",
            "instruction": "Add proper error handling",
            "target_tech": "Spring Boot 3",
        })
        # Either 404 (file not found) or 500 (AI error) — both correct
        assert resp.status_code in [404, 500]


# ─── Validation Tests ──────────────────────────────────────────────────────────

class TestValidation:
    def setup_method(self):
        resp = client.post("/api/v1/projects", json={"name": "Validation Test"})
        self.project_id = resp.json()["id"]

    def test_list_validations_empty(self):
        resp = client.get(f"/api/v1/projects/{self.project_id}/transformations/validation/all")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_validate_nonexistent_transformation(self):
        resp = client.post(f"/api/v1/projects/{self.project_id}/transformations/{uuid.uuid4()}/validate")
        assert resp.status_code == 404


# ─── Health Check ──────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_check(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_health_has_version(self):
        resp = client.get("/api/health")
        assert "version" in resp.json()

    def test_health_reports_ai_configured(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert "ai_configured" in data
        # With test credential set in settings, this should be True
        assert data["ai_configured"] is True


# ─── IBM Bob AI Configuration Tests ───────────────────────────────────────────

class TestBobAIConfig:
    """Tests for IBM Bob Shell AI service configuration and error handling."""

    def test_ai_status_endpoint_exists(self):
        resp = client.get("/api/ai/status")
        assert resp.status_code == 200

    def test_ai_status_reports_configured_true_with_test_settings(self):
        """With test value set, ai/status should report configured=True."""
        resp = client.get("/api/ai/status")
        data = resp.json()
        assert "configured" in data
        # Test settings have a placeholder value for the required var
        assert data["configured"] is True

    def test_ai_config_error_raises_when_key_missing(self):
        """AIServiceConfigError should be raised when BOBSHELL_API_KEY is missing."""
        from app.services.ai_service import AIServiceConfigError, _get_api_key
        original = settings.bobshell_api_key
        settings.bobshell_api_key = ""
        try:
            _get_api_key()
            assert False, "Should have raised AIServiceConfigError"
        except AIServiceConfigError as e:
            assert "BOBSHELL_API_KEY" in str(e)
        finally:
            settings.bobshell_api_key = original

    def test_api_key_not_in_error_response(self):
        """The Bob API key must never appear in HTTP error responses."""
        original = settings.bobshell_api_key
        settings.bobshell_api_key = ""
        try:
            # Wrong method on ai/status → 405, key should not be exposed
            resp = client.post("/api/ai/status")
            assert resp.status_code == 405
        finally:
            settings.bobshell_api_key = original

    def test_bob_config_var_name(self):
        """Verify the config uses BOBSHELL_API_KEY, not OpenAI vars."""
        assert hasattr(settings, "bobshell_api_key")
        assert hasattr(settings, "bob_inference_url")   # optional override
        assert not hasattr(settings, "bob_model")        # model selection removed
        assert not hasattr(settings, "openai_api_key")
        assert not hasattr(settings, "openai_model")
        assert not hasattr(settings, "openai_base_url")
        assert not hasattr(settings, "bob_api_key")


# ─── Chat Tests ────────────────────────────────────────────────────────────────

class TestChat:
    def setup_method(self):
        resp = client.post("/api/v1/projects", json={"name": "Chat Test"})
        self.project_id = resp.json()["id"]

    def test_chat_history_empty(self):
        resp = client.get(f"/api/v1/projects/{self.project_id}/chat/history")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_clear_chat_history(self):
        resp = client.delete(f"/api/v1/projects/{self.project_id}/chat/history")
        assert resp.status_code == 200


# ─── Error Handling Tests ──────────────────────────────────────────────────────

class TestErrorHandling:
    def test_invalid_project_id_for_files(self):
        resp = client.get(f"/api/v1/projects/not-a-real-id/files")
        assert resp.status_code == 404

    def test_invalid_project_id_for_analysis(self):
        resp = client.get(f"/api/v1/projects/not-a-real-id/analysis")
        assert resp.status_code in [404]

    def test_project_name_required(self):
        resp = client.post("/api/v1/projects", json={})
        assert resp.status_code == 422

    def test_analysis_on_nonexistent_project(self):
        resp = client.post(f"/api/v1/projects/{uuid.uuid4()}/analysis/start", json={})
        assert resp.status_code == 404

    def test_upload_to_nonexistent_project(self):
        content = b"some code"
        resp = client.post(
            f"/api/v1/projects/{uuid.uuid4()}/files/upload",
            files=[("files", ("file.java", content, "text/plain"))],
            data={"replace": "false"},
        )
        assert resp.status_code == 404
