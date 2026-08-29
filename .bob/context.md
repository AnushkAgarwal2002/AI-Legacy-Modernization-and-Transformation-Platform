# ModernizeAI — Bob Project Context

## Purpose
This is an AI-assisted legacy application modernization and transformation platform.
IBM Bob Shell is the core AI engine powering analysis, recommendations, transformation, and conversation.

## AI Integration
- **Mechanism**: IBM Bob Shell (`bob` CLI) in non-interactive subprocess mode
- **Authentication**: Inference-scoped API key (BOBSHELL_API_KEY) — no extra headers required
- **Command pattern**: `BOBSHELL_API_KEY=<key> bob --auth-method api-key --hide-intermediary-output < prompt.txt`
- **Config**: `BOBSHELL_API_KEY` (required), `BOB_INSTANCE_ID`, `BOB_TEAM_ID` (optional) in backend/.env
- **Service**: `backend/app/services/ai_service.py` — all AI calls go through here
- **Health check**: `GET /api/ai/status`

## Architecture
- **Backend**: FastAPI + Python 3.11, DuckDB, python-multipart
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: DuckDB at `data/platform.duckdb`

## Key Files
- `backend/app/services/ai_service.py` — IBM Bob Shell integration (call_ai, _call_json, analyze_project, transform_file, validate_transformation, generate_report, answer_project_question, check_connectivity)
- `backend/app/core/config.py` — settings: bobshell_api_key, bob_instance_id, bob_team_id
- `backend/app/services/demo_service.py` — Built-in demo legacy project (Java Spring MVC)
- `backend/app/services/analysis_service.py` — Analysis orchestration
- `backend/app/services/transformation_service.py` — Code transformation + validation
- `backend/app/main.py` — FastAPI app, global AIServiceError handlers
- `frontend/src/App.tsx` — React SPA root with routing
- `frontend/src/pages/` — All 10 application pages
- `backend/tests/test_platform.py` — 59 backend tests

## Development Workflow
- Backend: `cd backend && python run.py` (port 8000)
- Frontend dev: `cd frontend && npm run dev` (port 5173, proxies /api to :8000)
- Frontend build: `cd frontend && npm run build`
- Tests: `cd backend && python -m pytest tests/ -v`
- API docs: http://localhost:8000/docs
- AI status: http://localhost:8000/api/ai/status

## AI Service Conventions
- `call_ai(prompt, expect_json)` — core Bob Shell invocation, returns stdout string
- `_call_json(prompt)` — calls call_ai and JSON-parses the result (strips markdown fences)
- `analyze_project(files, project_info)` — full codebase analysis → structured JSON
- `transform_file(file_path, code, language, target, instruction, ctx)` — code modernization
- `validate_transformation(file_path, original, transformed)` — AI code review
- `explain_code(file_path, code, language, question)` — code explanation
- `answer_project_question(question, ctx, file_context)` — contextual chat
- `generate_report(project, analysis, issues, recs, transforms, plan)` — exec report
- `check_connectivity()` — verify Bob Shell is reachable and key is valid

## Error Handling
AIServiceConfigError    → 503 (missing BOBSHELL_API_KEY, or `bob` not found in PATH)
AIServiceAuthError      → 503 (invalid API key)
AIServiceRateLimitError → 429
AIServiceError          → 502
The API key value is never exposed in error messages or API responses.

## Data Model
projects → project_files → analyses → issues
                                     → recommendations
                                     → architecture_models
                                     → modernization_plans → plan_tasks
                         → transformations → validation_results
                         → chat_messages

## Design Principles
- AI findings are labeled as heuristic/proposed, never claimed as objective facts
- Transformations are ALWAYS proposals — original code is NEVER overwritten
- AI validation ≠ compilation or test execution — clearly labeled as AI review
- Uncertain findings are labeled "Unknown / Requires Further Investigation"

## Environment Setup
1. Install Bob Shell: `powershell -ep Bypass 'irm -Uri "https://bob.ibm.com/download/bobshell.ps1" | iex'`
2. Copy `backend/.env.example` to `backend/.env`
3. Set `BOBSHELL_API_KEY` (Inference-scoped key from bob.ibm.com → API Keys)
4. Accept license (first time): `BOBSHELL_API_KEY=<key> bob --accept-license --auth-method api-key -p "hello"`

## Navigation Structure
Dashboard → File Explorer → Analysis → Architecture → Issues & Debt →
Recommendations → Modernization Plan → Transformation Workspace →
Validation Center → Report
