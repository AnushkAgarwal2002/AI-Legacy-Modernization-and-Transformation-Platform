import os
from functools import lru_cache
from pydantic_settings import BaseSettings

# Resolve the .env path relative to this file so it works regardless of the
# working directory the server is launched from.
_ENV_FILE = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


class Settings(BaseSettings):
    # Application
    app_name: str = "Legacy Modernization Platform"
    app_version: str = "1.0.0"
    debug: bool = False

    # API
    api_prefix: str = "/api/v1"

    # ── IBM Bob Inference API ─────────────────────────────────────────────────
    # Create an Inference-scoped key at bob.ibm.com -> Account -> API Keys.
    # Set as BOBSHELL_API_KEY in backend/.env.
    bobshell_api_key: str = ""

    # Inference endpoint base URL (without /chat/completions).
    # Default is the us-east gateway; override if your subscription is elsewhere.
    bob_inference_url: str = ""

    # Storage
    data_dir: str = os.path.join(os.path.dirname(__file__), "..", "..", "data")
    uploads_dir: str = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")
    db_path: str = os.path.join(os.path.dirname(__file__), "..", "..", "data", "platform.duckdb")

    # Upload limits
    max_upload_size_mb: int = 50
    allowed_extensions: list = [
        ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cs", ".cpp", ".c", ".h",
        ".rb", ".php", ".go", ".rs", ".swift", ".kt", ".scala", ".clj",
        ".html", ".css", ".scss", ".sass", ".less",
        ".json", ".yaml", ".yml", ".xml", ".toml", ".ini", ".cfg", ".conf",
        ".properties", ".env", ".env.example",
        ".md", ".txt", ".rst",
        ".sql", ".sh", ".bat", ".ps1",
        ".dockerfile", ".Dockerfile", "dockerfile",
        ".gitignore", ".gitattributes",
        ".gradle", ".maven", "pom.xml", "build.gradle",
        "requirements.txt", "package.json", "package-lock.json",
        "Gemfile", "Cargo.toml", "go.mod", "go.sum",
        ".tf", ".hcl",
    ]

    model_config = {
        "env_file": _ENV_FILE,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
