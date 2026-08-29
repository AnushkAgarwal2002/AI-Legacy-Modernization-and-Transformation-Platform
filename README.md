# ModernizeAI — AI-Assisted Legacy Application Modernization Platform

> **Hackathon Submission** — AI-Assisted Legacy Application Modernization and Transformation Platform powered by IBM Bob

---

## Overview

ModernizeAI is a full-stack web application that helps developers, architects, and engineering teams understand, assess, and modernize legacy codebases using AI assistance from IBM Bob.

**The complete workflow:**

```
Import Legacy Code → Analyze → Understand Architecture → Assess Technical Debt → 
Get Recommendations → Generate Migration Plan → Transform Code → Validate → Report
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ModernizeAI Platform                         │
├──────────────────────────┬──────────────────────────────────────────┤
│   React + TypeScript     │         FastAPI + Python 3.11            │
│   Frontend (Vite)        │         Backend                         │
│                          │                                          │
│  ┌─────────────────┐     │  ┌─────────────────────────────────┐   │
│  │ Project Manager  │────────│ Project / File Services          │   │
│  │ File Explorer   │     │  │ Analysis Orchestration           │   │
│  │ Analysis View   │     │  │ Transformation Service           │   │
│  │ Architecture    │     │  │ Validation Service               │   │
│  │ Issues/Debt     │────────│ AI Service (IBM Bob / OpenAI)    │   │
│  │ Recommendations │     │  │ Chat Service                     │   │
│  │ Moderniz. Plan  │     │  └────────────────┬────────────────┘   │
│  │ Transform WS    │     │                   │                      │
│  │ Validation      │     │  ┌────────────────▼────────────────┐   │
│  │ Reports         │     │  │         DuckDB Database          │   │
│  │ AI Chat Panel   │     │  │  (projects, files, analyses,     │   │
│  └─────────────────┘     │  │   issues, plans, transforms)     │   │
│                          │  └─────────────────────────────────┘   │
└──────────────────────────┴──────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite | Fast iteration, type safety, modern DX |
| Routing | React Router v6 | SPA navigation |
| Styling | Custom CSS (dark theme) | No runtime overhead, full control |
| Charts | Recharts | Lightweight, composable charts |
| Backend | FastAPI + Python 3.11 | Fast async API, automatic docs |
| Database | DuckDB | Zero-config embedded DB, SQL power |
| AI | IBM Bob Shell (non-interactive subprocess) | Full analysis and transformation |
| File Upload | python-multipart + react-dropzone | Multi-file, ZIP support |
| Testing | pytest + FastAPI TestClient | 60 backend tests |

---

## Features

### 🔍 Analysis Engine
- Detects programming languages, frameworks, libraries, build tools
- Identifies architecture pattern (Monolith, MVC, Layered, SOA, etc.)
- Discovers external dependencies with version/status assessment
- Finds technical debt: deprecated dependencies, security vulnerabilities, coupling issues, missing tests
- AI-assisted heuristic scoring across 10 modernization dimensions (clearly labeled as heuristic)

### 🏛️ Architecture Visualization
- SVG-based interactive architecture diagram (current legacy system)
- AI-generated recommended modern architecture diagram
- Color-coded node types (controllers, services, models, databases, etc.)
- Hover tooltips with component descriptions

### ⚠️ Issues & Technical Debt
- Severity-based issue tracking (critical/high/medium/low)
- Category filtering (Security, Architecture, Dependencies, etc.)
- Per-issue: evidence, why-it-matters, recommended action, complexity, risk
- Issue status management (open/in-progress/resolved/won't-fix)

### 💡 Recommendations
- Prioritized modernization recommendations
- Grouped by category with visual filtering
- Per-recommendation: evidence, proposed solution, expected benefit, related files

### 📋 Modernization Plan
- AI-generated staged migration plan
- Task status tracking (Not Started/In Progress/Completed/Blocked)
- Per-task: complexity, risk, priority, related files, dependencies
- Progress visualization

### ⚡ Transformation Workspace
- File-by-file AI-assisted code modernization
- Before/After side-by-side code view
- Explanation of what changed and why
- Risk assessment and manual review items
- Transformation history
- **Never overwrites original code** — all transformations are proposals

### ✅ Validation Center
- AI-based code review of proposed transformations
- Errors, warnings, static analysis findings, manual review items
- Clearly labeled: "AI validation" not "compilation/test results"

### 📄 Report Generation
- Executive summary, technology inventory, architecture assessment
- Technical debt summary, recommendations, target architecture
- Migration plan summary, transformation summary
- Exportable as JSON and Markdown

### 💬 Contextual AI Chat
- Per-project AI assistant (IBM Bob)
- Context-aware: knows the project's files, analysis, architecture
- File-specific context when opened from file/transform views
- Suggested questions per page
- Persistent chat history per project

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- **IBM Bob Shell** installed and on your PATH
- An IBM Bob account with an **Inference-scoped API key** (created at [bob.ibm.com](https://bob.ibm.com) → API Keys)

### 1. Install Bob Shell

**Windows (PowerShell)**:
```powershell
powershell -ep Bypass 'irm -Uri "https://bob.ibm.com/download/bobshell.ps1" | iex'
```

**macOS/Linux**:
```bash
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash
```

Verify:
```bash
bob --version
```

### 2. Configure credentials

```bash
cd backend
cp .env.example .env
# Edit .env and set:
#   BOBSHELL_API_KEY — Inference-scoped key from bob.ibm.com → API Keys
```

Accept the Bob Shell license (first time only):
```bash
BOBSHELL_API_KEY=YOUR_KEY bob --accept-license --auth-method api-key -p "hello"
```

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
python run.py
# Backend starts at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### 4. Start the frontend (development)

```bash
cd frontend
npm install
npm run dev
# Frontend at http://localhost:5173
```

### 5. Production (single server)

```bash
cd frontend
npm run build
# Frontend built to frontend/dist/
# Backend serves it at http://localhost:8000
```

---

## Demo Workflow

The platform includes a built-in realistic legacy Java application (ACME Inventory Management System) with intentional modernization problems.

### Demo Steps

1. **Open the app** at `http://localhost:5173`
2. **Create a new project**: Click "New Project" → enter a name → click "Create Project"
3. **Load demo project**: In the File Explorer, click "Load Demo Legacy Project"
4. **Explore the code**: Browse the file tree, inspect the legacy Java code
5. **Run analysis**: Click "Analyze Project" → "Start Analysis" (wait ~60 seconds for IBM Bob)
6. **View results**:
   - **Dashboard**: Overall modernization assessment scorecard + radar chart
   - **Architecture**: Current vs. Recommended architecture diagrams
   - **Issues & Technical Debt**: 10+ identified issues with severity classification
   - **Recommendations**: Prioritized modernization recommendations
   - **Modernization Plan**: Staged migration tasks
7. **Transform code**: Go to "Transformation Workspace", select a file, click "Generate Transformation"
8. **Compare Before/After**: Review legacy vs. modern code side-by-side
9. **Validate**: Click "Run AI Validation" to get AI code review
10. **Generate Report**: Go to "Report" → "Generate Report" → export as JSON or Markdown

### Demo Legacy Application Details

The ACME Inventory Management System intentionally contains:

| Issue | Location | Severity |
|-------|---------|---------|
| Hardcoded DB credentials | `InventoryController.java`, `InventoryDAO.java`, `applicationContext.xml` | Critical |
| SQL injection vulnerability | `InventoryController.java:searchInventory()` | Critical |
| Log4j 1.x (CVE-2019-17571) | `pom.xml` | Critical |
| Commons Collections 3.2.1 (CVE-2015-7501) | `pom.xml` | Critical |
| Spring 3.2.x (EOL 2016) | `pom.xml` | High |
| JDBC connection leaks | `InventoryDAO.java` | High |
| No connection pooling | `DatabaseUtil.java` | High |
| Business logic in controller | `InventoryController.java` | High |
| Double type for monetary values | `Product.java`, `Order.java` | Medium |
| No transaction management | `InventoryDAO.java` | High |
| Zero test coverage | `InventoryControllerTest.java` | High |
| Unencrypted SMTP (port 25) | `EmailSender.java` | Medium |
| `java.util.Date` (deprecated) | `Order.java` | Low |
| No pagination | `InventoryController.java` | Medium |

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

**Test coverage:**
- 59 tests across 9 test classes
- Project CRUD operations
- File ingestion and language detection
- Demo project content validation
- Analysis status workflow
- Transformation error handling
- Validation service
- Error handling and edge cases
- Health check

---

## API Reference

The backend auto-generates API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Key Endpoints

```
POST   /api/v1/projects                          Create project
GET    /api/v1/projects                          List projects
GET    /api/v1/projects/{id}                     Get project
PATCH  /api/v1/projects/{id}                     Update project
DELETE /api/v1/projects/{id}                     Delete project
GET    /api/v1/projects/{id}/dashboard           Dashboard stats

POST   /api/v1/projects/{id}/files/upload        Upload files
POST   /api/v1/projects/{id}/files/upload-zip    Upload ZIP archive
POST   /api/v1/projects/{id}/files/upload-demo   Load demo project
GET    /api/v1/projects/{id}/files               List files

POST   /api/v1/projects/{id}/analysis/start      Start analysis
GET    /api/v1/projects/{id}/analysis/status     Analysis status
GET    /api/v1/projects/{id}/analysis            Full analysis results
GET    /api/v1/projects/{id}/analysis/issues     Issues
GET    /api/v1/projects/{id}/analysis/recommendations  Recommendations
GET    /api/v1/projects/{id}/analysis/architecture     Architecture models
GET    /api/v1/projects/{id}/analysis/plan        Modernization plan

POST   /api/v1/projects/{id}/transformations     Generate transformation
GET    /api/v1/projects/{id}/transformations     List transformations
POST   /api/v1/projects/{id}/transformations/{tid}/validate  AI validation

POST   /api/v1/projects/{id}/chat               Send chat message
GET    /api/v1/projects/{id}/chat/history        Chat history

POST   /api/v1/projects/{id}/report             Generate report
```

---

## AI Workflow

IBM Bob is used for these operations:

### 1. Comprehensive Analysis (`analyze_project`)
Single structured JSON prompt that produces:
- Technology inventory
- Code structure
- Dependency assessment
- Architecture pattern
- Technical debt items (with evidence, severity, recommended action)
- Modernization recommendations
- Architecture models (current + recommended) with nodes/edges
- Staged modernization plan with tasks
- Assessment scores (0-100 per dimension, clearly labeled as heuristic)
- Executive summary

### 2. Code Transformation (`transform_file`)
Given a file's original code, language, target tech, and project context:
- Produces modernized code
- Explains each change decision
- Lists risks and potential behavior changes
- Identifies manual review requirements

### 3. Transformation Validation (`run_validation`)
Given original and transformed code:
- AI code review
- Identifies definite errors
- Warns about potential issues
- Lists static analysis findings
- Recommends manual review items

### 4. Report Generation (`generate_report`)
Synthesizes all analysis findings into a structured executive report.

### 5. Contextual Chat (`answer_project_question`)
Answers questions with project context (technology, architecture, files) and optional file-specific context.

### Transparency

The platform is explicit about AI limitations:
- Assessment scores are labeled "AI-assisted heuristic assessments — not objective measurements"
- Transformations are labeled "AI-generated proposals requiring developer review"
- Validation is labeled "AI validation" not "compilation/test results"
- Analysis findings that cannot be confirmed are labeled "Requires Further Investigation"

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   │   ├── projects.py
│   │   │   ├── files.py
│   │   │   ├── analysis.py
│   │   │   ├── transformations.py
│   │   │   ├── chat.py
│   │   │   └── reports.py
│   │   ├── core/
│   │   │   └── config.py
│   │   ├── db/
│   │   │   └── database.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   ├── services/
│   │   │   ├── ai_service.py      # IBM Bob integration
│   │   │   ├── project_service.py
│   │   │   ├── file_service.py
│   │   │   ├── analysis_service.py
│   │   │   ├── transformation_service.py
│   │   │   ├── chat_service.py
│   │   │   └── demo_service.py    # Built-in legacy demo project
│   │   └── main.py
│   ├── tests/
│   │   └── test_platform.py       # 60 tests
│   ├── requirements.txt
│   ├── run.py
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # API client
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── AIChatPanel.tsx    # Contextual AI chat
│   │   │   ├── ArchDiagram.tsx    # SVG arch visualization
│   │   │   └── ScoreBar.tsx
│   │   ├── context/AppContext.tsx
│   │   ├── pages/
│   │   │   ├── ProjectList.tsx
│   │   │   ├── NewProject.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── FileExplorer.tsx
│   │   │   ├── Analysis.tsx
│   │   │   ├── Architecture.tsx
│   │   │   ├── Issues.tsx
│   │   │   ├── Recommendations.tsx
│   │   │   ├── ModernizationPlan.tsx
│   │   │   ├── Transformation.tsx
│   │   │   ├── Validation.tsx
│   │   │   └── Report.tsx
│   │   ├── styles/global.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── data/                          # Runtime data directory (auto-created)
└── README.md
```

---

## Data Model

| Entity | Purpose |
|--------|---------|
| `projects` | Modernization project metadata |
| `project_files` | Uploaded source files with content |
| `analyses` | Full analysis results (JSON blobs) |
| `issues` | Technical debt items |
| `recommendations` | Modernization recommendations |
| `architecture_models` | Current + recommended arch (nodes/edges) |
| `modernization_plans` | Plan metadata |
| `plan_tasks` | Individual plan tasks with status |
| `transformations` | Before/after code proposals |
| `validation_results` | AI validation findings |
| `chat_messages` | Per-project chat history |

---

## Security Considerations

This is a prototype — the following apply:

- **No authentication**: Multi-user auth not implemented. Deploy behind auth proxy for production.
- **File validation**: Uploaded files are checked for binary/supported status. Unsafe code is never executed.
- **Path traversal prevention**: File paths are stored as-is in DB; no direct filesystem operations on uploaded content.
- **No secret storage**: API keys via environment variables only, never in DB or logs.
- **Source code privacy**: Uploaded code is stored locally in DuckDB. Not transmitted anywhere except to the configured AI endpoint.
- **Content Security**: HTML content in JSP files is not rendered — stored and displayed as text only.

For production deployment:
- Add authentication (JWT/OAuth)
- Enable HTTPS
- Rate-limit AI endpoints
- Implement file scanning
- Restrict CORS origins

---

## Known Limitations

1. **Analysis time**: Full AI analysis takes 60–120 seconds depending on codebase size and API latency.
2. **Code execution**: The platform cannot compile, run, or test code. All validation is AI-based review.
3. **Large codebases**: Files are truncated to ~3000-8000 chars for AI context. Very large files may lose context.
4. **Language support**: Best support for Java, Python, JavaScript/TypeScript. Other languages analyzed but transformation quality varies.
5. **Concurrent analysis**: Multiple simultaneous analyses share DB connections (DuckDB concurrent write limitations).
6. **Binary files**: Excluded from AI analysis. Structure is preserved in file tree.

---

## Future Improvements

- [ ] Multi-user workspace with authentication
- [ ] Git repository import (clone + analyze)
- [ ] Real compilation/test execution in sandboxed containers
- [ ] Incremental analysis (only re-analyze changed files)
- [ ] Custom modernization rules/patterns
- [ ] Side-by-side live diff editor (Monaco)
- [ ] Team collaboration features
- [ ] CI/CD pipeline integration
- [ ] Dependency graph visualization
- [ ] Support for more languages (Go, Rust, Ruby)
- [ ] Export transformations as Git patches

---

## Development Notes

### Environment Variables

```env
# Required — IBM Bob Shell
BOBSHELL_API_KEY=     # Inference-scoped key from bob.ibm.com → API Keys

# Optional — only needed if your subscription requires explicit routing
BOB_INSTANCE_ID=
BOB_TEAM_ID=

# Optional app settings
DEBUG=false
```

### IBM Bob Shell Integration

The platform drives IBM Bob Shell (`bob` CLI) in non-interactive mode as a subprocess for all AI operations:

```
BOBSHELL_API_KEY=<key> bob --auth-method api-key --hide-intermediary-output < prompt.txt
```

**Why Bob Shell instead of the HTTP API?**
Bob Shell is the documented, supported programmatic access path. It handles authentication, model routing, and inference internally — no separate LiteLLM proxy URL or model identifier is required.

**API key type**: Create an **Inference-scoped** key at bob.ibm.com → Account → API Keys. This key type is scoped to a specific subscription instance and team; no additional instance or team headers are required.

Verify connectivity at runtime: `GET /api/ai/status`

---

## License

Built for the IBM Bob Hackathon. All rights reserved.
