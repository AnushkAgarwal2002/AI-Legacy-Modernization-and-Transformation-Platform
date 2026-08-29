"""
File ingestion service — handles upload, parsing, language detection.
"""
import os
import json
import uuid
import zipfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from ..db.database import get_db
from ..core.config import settings

LANGUAGE_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "javascript",
    ".tsx": "typescript",
    ".java": "java",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".rb": "ruby",
    ".php": "php",
    ".go": "go",
    ".rs": "rust",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".sql": "sql",
    ".sh": "bash",
    ".bat": "batch",
    ".ps1": "powershell",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".toml": "toml",
    ".md": "markdown",
    ".txt": "text",
    ".properties": "properties",
    ".env": "dotenv",
    ".gradle": "gradle",
    ".tf": "terraform",
}

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".tar", ".gz", ".jar", ".war", ".ear", ".class",
    ".exe", ".dll", ".so", ".dylib",
    ".mp3", ".mp4", ".avi", ".mov",
    ".ttf", ".woff", ".woff2", ".eot",
    ".db", ".sqlite", ".duckdb",
    ".pyc", ".pyo",
}


def detect_language(filename: str) -> Optional[str]:
    ext = Path(filename).suffix.lower()
    return LANGUAGE_MAP.get(ext)


def is_binary_file(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    if ext in BINARY_EXTENSIONS:
        return True
    # Check for Dockerfile without extension
    name = Path(filename).name.lower()
    return False


def is_supported_file(filename: str) -> bool:
    if is_binary_file(filename):
        return False
    ext = Path(filename).suffix.lower()
    name = Path(filename).name.lower()
    # Allow files with no extension for common config files
    no_ext_allowed = {"dockerfile", "makefile", "gemfile", "procfile", "rakefile", ".env",
                      ".gitignore", ".gitattributes", ".editorconfig", "requirements"}
    if not ext and name not in no_ext_allowed:
        return False
    return True


def save_uploaded_files(
    project_id: str,
    files_data: List[Dict[str, Any]],
    replace: bool = False
) -> List[Dict[str, Any]]:
    """
    Save file data to DB. files_data: list of {path, name, content (str), size_bytes}.
    """
    if replace:
        conn = get_db()
        try:
            conn.execute("DELETE FROM project_files WHERE project_id = ?", [project_id])
            conn.commit()
        finally:
            conn.close()

    saved = []
    conn = get_db()
    try:
        for f in files_data:
            file_id = str(uuid.uuid4())
            path = f.get("path", f.get("name", "unknown"))
            name = os.path.basename(path) or path
            ext = Path(name).suffix.lower() or None
            binary = is_binary_file(name)
            supported = is_supported_file(name) and not binary
            language = detect_language(name)
            content = f.get("content") if supported else None

            conn.execute("""
                INSERT INTO project_files
                (id, project_id, path, name, extension, size_bytes, content, is_binary, is_supported, language, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                file_id, project_id, path, name, ext,
                f.get("size_bytes", len((content or "").encode("utf-8"))),
                content, binary, supported, language, datetime.utcnow()
            ])
            saved.append({
                "id": file_id, "project_id": project_id,
                "path": path, "name": name, "extension": ext,
                "size_bytes": f.get("size_bytes"),
                "is_binary": binary, "is_supported": supported, "language": language,
            })
        conn.commit()
    finally:
        conn.close()

    return saved


def get_project_files(project_id: str, include_content: bool = False) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        cols_list = "id, project_id, path, name, extension, size_bytes, is_binary, is_supported, language, created_at"
        if include_content:
            cols_list = "id, project_id, path, name, extension, size_bytes, content, is_binary, is_supported, language, created_at"
        results = conn.execute(
            f"SELECT {cols_list} FROM project_files WHERE project_id = ? ORDER BY path",
            [project_id]
        ).fetchall()
        cols = [d[0] for d in conn.description]
        return [dict(zip(cols, r)) for r in results]
    finally:
        conn.close()


def get_file(file_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        result = conn.execute(
            "SELECT * FROM project_files WHERE id = ?", [file_id]
        ).fetchone()
        if not result:
            return None
        cols = [d[0] for d in conn.description]
        return dict(zip(cols, result))
    finally:
        conn.close()


def get_file_by_path(project_id: str, path: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        result = conn.execute(
            "SELECT * FROM project_files WHERE project_id = ? AND path = ?",
            [project_id, path]
        ).fetchone()
        if not result:
            return None
        cols = [d[0] for d in conn.description]
        return dict(zip(cols, result))
    finally:
        conn.close()


def extract_zip_contents(zip_bytes: bytes) -> List[Dict[str, Any]]:
    """Extract files from a zip archive, returning list of file data dicts."""
    import io
    files = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            path = info.filename
            # Strip leading directory if all files share a common root
            name = os.path.basename(path)
            ext = Path(name).suffix.lower()
            binary = is_binary_file(name)
            supported = is_supported_file(name) and not binary

            content = None
            if supported:
                try:
                    raw = zf.read(info.filename)
                    content = raw.decode("utf-8", errors="replace")
                except Exception:
                    binary = True
                    supported = False
            else:
                try:
                    raw = zf.read(info.filename)
                except Exception:
                    raw = b""

            files.append({
                "path": path,
                "name": name,
                "content": content,
                "size_bytes": info.file_size,
                "is_binary": binary,
                "is_supported": supported,
                "language": detect_language(name),
            })
    return files
