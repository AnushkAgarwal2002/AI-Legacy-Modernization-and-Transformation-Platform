"""
Pydantic models for the Legacy Modernization Platform.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
import uuid


# ─── Projects ────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    legacy_tech: Optional[str] = None
    target_tech: Optional[str] = None
    objective: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    legacy_tech: Optional[str] = None
    target_tech: Optional[str] = None
    objective: Optional[str] = None
    status: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    legacy_tech: Optional[str] = None
    target_tech: Optional[str] = None
    objective: Optional[str] = None
    status: str = "created"
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = None


# ─── Files ───────────────────────────────────────────────────────────────────

class FileInfo(BaseModel):
    id: str
    project_id: str
    path: str
    name: str
    extension: Optional[str] = None
    size_bytes: Optional[int] = None
    is_binary: bool = False
    is_supported: bool = True
    language: Optional[str] = None
    created_at: datetime


class FileDetail(FileInfo):
    content: Optional[str] = None


# ─── Analysis ────────────────────────────────────────────────────────────────

class AnalysisRequest(BaseModel):
    force_reanalyze: bool = False


class TechnologySummary(BaseModel):
    languages: List[str] = []
    frameworks: List[str] = []
    libraries: List[str] = []
    runtime_platform: Optional[str] = None
    build_tools: List[str] = []
    databases: List[str] = []
    external_services: List[str] = []
    apis: List[str] = []
    deployment_assumptions: List[str] = []


class CodeStructure(BaseModel):
    entry_points: List[str] = []
    modules: List[str] = []
    key_classes: List[str] = []
    key_functions: List[str] = []
    config_files: List[str] = []
    important_files: List[str] = []


class DependencyInfo(BaseModel):
    internal: List[Dict[str, Any]] = []
    external: List[Dict[str, Any]] = []
    deprecated: List[str] = []
    risky: List[str] = []
    coupling_issues: List[str] = []


class ArchitectureInfo(BaseModel):
    pattern: Optional[str] = None
    description: Optional[str] = None
    components: List[str] = []
    issues: List[str] = []


class AnalysisResult(BaseModel):
    id: str
    project_id: str
    status: str
    technology_summary: Optional[TechnologySummary] = None
    code_structure: Optional[CodeStructure] = None
    dependencies: Optional[DependencyInfo] = None
    architecture: Optional[ArchitectureInfo] = None
    technical_debt: Optional[List[Dict[str, Any]]] = None
    raw_analysis: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


# ─── Issues ──────────────────────────────────────────────────────────────────

class Issue(BaseModel):
    id: str
    project_id: str
    analysis_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    evidence: Optional[str] = None
    why_matters: Optional[str] = None
    recommended_action: Optional[str] = None
    complexity: Optional[str] = None
    risk: Optional[str] = None
    priority: int = 3
    status: str = "open"
    created_at: datetime


class IssueUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[int] = None


# ─── Recommendations ─────────────────────────────────────────────────────────

class Recommendation(BaseModel):
    id: str
    project_id: str
    analysis_id: Optional[str] = None
    title: str
    problem: Optional[str] = None
    evidence: Optional[str] = None
    proposed_solution: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    risk: Optional[str] = None
    expected_benefit: Optional[str] = None
    related_files: Optional[List[str]] = None
    status: str = "pending"
    created_at: datetime


# ─── Modernization Plan ───────────────────────────────────────────────────────

class PlanTask(BaseModel):
    id: str
    plan_id: str
    project_id: str
    stage_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    related_files: Optional[List[str]] = None
    priority: str = "medium"
    complexity: str = "medium"
    risk: str = "medium"
    dependencies: Optional[List[str]] = None
    suggested_order: int = 0
    status: str = "not_started"
    created_at: datetime
    updated_at: datetime


class PlanTaskUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None


class ModernizationPlan(BaseModel):
    id: str
    project_id: str
    analysis_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    stages: Optional[List[Dict[str, Any]]] = None
    tasks: Optional[List[PlanTask]] = None
    created_at: datetime
    updated_at: datetime


# ─── Transformations ─────────────────────────────────────────────────────────

class TransformationRequest(BaseModel):
    file_path: str
    task_id: Optional[str] = None
    instruction: Optional[str] = None
    target_tech: Optional[str] = None


class Transformation(BaseModel):
    id: str
    project_id: str
    file_id: Optional[str] = None
    task_id: Optional[str] = None
    file_path: str
    original_code: Optional[str] = None
    transformed_code: Optional[str] = None
    explanation: Optional[str] = None
    risks: Optional[str] = None
    review_items: Optional[str] = None
    status: str = "proposed"
    validation_status: str = "pending"
    validation_output: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ─── Validation ──────────────────────────────────────────────────────────────

class ValidationResult(BaseModel):
    id: str
    project_id: str
    transformation_id: Optional[str] = None
    build_status: str = "unknown"
    test_status: str = "unknown"
    static_analysis: Optional[List[Dict[str, Any]]] = None
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    manual_review_items: Optional[List[str]] = None
    overall_status: str = "pending"
    notes: Optional[str] = None
    created_at: datetime


# ─── Architecture ─────────────────────────────────────────────────────────────

class ArchitectureNode(BaseModel):
    id: str
    label: str
    type: str
    description: Optional[str] = None
    files: Optional[List[str]] = None


class ArchitectureEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None
    type: str = "dependency"


class ArchitectureModel(BaseModel):
    id: str
    project_id: str
    analysis_id: Optional[str] = None
    model_type: str = "current"
    nodes: List[ArchitectureNode] = []
    edges: List[ArchitectureEdge] = []
    description: Optional[str] = None
    pattern: Optional[str] = None
    created_at: datetime


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    id: str
    project_id: str
    role: str
    content: str
    context_file: Optional[str] = None
    context_type: Optional[str] = None
    created_at: datetime


class ChatRequest(BaseModel):
    message: str
    context_file: Optional[str] = None
    context_type: Optional[str] = None


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_files: int = 0
    analyzed_files: int = 0
    total_issues: int = 0
    high_priority_issues: int = 0
    total_recommendations: int = 0
    total_tasks: int = 0
    completed_tasks: int = 0
    transformations_performed: int = 0
    validation_status: str = "unknown"
    remaining_risks: int = 0
    analysis_status: str = "not_started"
    modernization_score: Optional[Dict[str, Any]] = None


# ─── Report ───────────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    include_code: bool = False
    format: str = "json"


class Report(BaseModel):
    project_id: str
    generated_at: datetime
    executive_summary: Optional[str] = None
    technology_inventory: Optional[TechnologySummary] = None
    architecture_assessment: Optional[str] = None
    technical_debt_summary: Optional[str] = None
    recommendations_summary: Optional[List[Dict[str, Any]]] = None
    target_architecture: Optional[str] = None
    migration_plan_summary: Optional[str] = None
    transformation_summary: Optional[str] = None
    validation_summary: Optional[str] = None
    risks: Optional[List[str]] = None
    manual_review_items: Optional[List[str]] = None
