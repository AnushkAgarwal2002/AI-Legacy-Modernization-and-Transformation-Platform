"""
Database initialization and management using DuckDB.
"""
import os
import json
import duckdb
from datetime import datetime
from typing import Optional
from ..core.config import settings


def get_db():
    """Get a DuckDB connection."""
    os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)
    return duckdb.connect(settings.db_path)


def init_db():
    """Initialize database schema."""
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                description VARCHAR,
                legacy_tech VARCHAR,
                target_tech VARCHAR,
                objective VARCHAR,
                status VARCHAR DEFAULT 'created',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSON
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS project_files (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                path VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                extension VARCHAR,
                size_bytes BIGINT,
                content TEXT,
                is_binary BOOLEAN DEFAULT FALSE,
                is_supported BOOLEAN DEFAULT TRUE,
                language VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                status VARCHAR DEFAULT 'pending',
                technology_summary JSON,
                code_structure JSON,
                dependencies JSON,
                architecture JSON,
                technical_debt JSON,
                raw_analysis TEXT,
                error_message VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS issues (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                analysis_id VARCHAR,
                title VARCHAR NOT NULL,
                description TEXT,
                category VARCHAR,
                severity VARCHAR,
                file_path VARCHAR,
                line_number INTEGER,
                evidence TEXT,
                why_matters TEXT,
                recommended_action TEXT,
                complexity VARCHAR,
                risk VARCHAR,
                priority INTEGER DEFAULT 3,
                status VARCHAR DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS recommendations (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                analysis_id VARCHAR,
                title VARCHAR NOT NULL,
                problem TEXT,
                evidence TEXT,
                proposed_solution TEXT,
                category VARCHAR,
                priority VARCHAR,
                risk VARCHAR,
                expected_benefit TEXT,
                related_files JSON,
                status VARCHAR DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS modernization_plans (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                analysis_id VARCHAR,
                title VARCHAR NOT NULL,
                description TEXT,
                stages JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS plan_tasks (
                id VARCHAR PRIMARY KEY,
                plan_id VARCHAR NOT NULL,
                project_id VARCHAR NOT NULL,
                stage_name VARCHAR,
                title VARCHAR NOT NULL,
                description TEXT,
                related_files JSON,
                priority VARCHAR DEFAULT 'medium',
                complexity VARCHAR DEFAULT 'medium',
                risk VARCHAR DEFAULT 'medium',
                dependencies JSON,
                suggested_order INTEGER DEFAULT 0,
                status VARCHAR DEFAULT 'not_started',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS transformations (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                file_id VARCHAR,
                task_id VARCHAR,
                file_path VARCHAR NOT NULL,
                original_code TEXT,
                transformed_code TEXT,
                explanation TEXT,
                risks TEXT,
                review_items TEXT,
                status VARCHAR DEFAULT 'proposed',
                validation_status VARCHAR DEFAULT 'pending',
                validation_output TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS validation_results (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                transformation_id VARCHAR,
                build_status VARCHAR DEFAULT 'unknown',
                test_status VARCHAR DEFAULT 'unknown',
                static_analysis JSON,
                errors JSON,
                warnings JSON,
                manual_review_items JSON,
                overall_status VARCHAR DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS architecture_models (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                analysis_id VARCHAR,
                model_type VARCHAR DEFAULT 'current',
                nodes JSON,
                edges JSON,
                description TEXT,
                pattern VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id VARCHAR PRIMARY KEY,
                project_id VARCHAR NOT NULL,
                role VARCHAR NOT NULL,
                content TEXT NOT NULL,
                context_file VARCHAR,
                context_type VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()
        print("Database initialized successfully.")
    finally:
        conn.close()
