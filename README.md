# Invuric BA Agent

An AI-powered Business Analyst automation tool that generates professional documents — SOW, PRD, FRD, RAID, WBS, Process Flow Diagrams, and User Stories — from guided questionnaires or uploaded files.

---

## What it does

| Module | Description |
|---|---|
| **SOW** | Statement of Work — scope, deliverables, timeline, Gantt, RAID, roles |
| **PRD** | Product Requirements Document — goals, personas, features, metrics |
| **FRD** | Functional Requirements Document — system behaviour, business rules, APIs |
| **RAID** | Risks, Assumptions, Issues, Dependencies register |
| **WBS** | Work Breakdown Structure with phases, tasks, subtasks |
| **Process Flow Diagram** | Mermaid.js diagrams, exportable as PNG / SVG / PDF |
| **User Stories** | Acceptance criteria, edge cases, data points per feature |

Documents are generated using GPT-4o, formatted to Invuric's branded Word template, and downloadable as `.docx` or `.pdf`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| AI | OpenAI GPT-4o |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (`outputs` bucket) |
| DOCX | python-docx (template-copy for SOW, scratch for PRD/FRD) |

---

## Project Structure

```
invuric-insights/
├── src/
│   ├── pages/
│   │   ├── Index.tsx                  # Dashboard
│   │   ├── ChooseDocumentType.tsx     # Step 1 — pick SOW/PRD/FRD
│   │   ├── ChoosePath.tsx             # Step 2 — scratch or upload
│   │   ├── Questionnaire.tsx          # Step 3 — guided questions
│   │   ├── OutputFormat.tsx           # Step 4 — generate & download
│   │   ├── UploadGapFlow.tsx          # Upload + AI autofill path
│   │   ├── RaidDocument.tsx           # RAID generator
│   │   ├── WBSGenerator.tsx           # WBS generator
│   │   ├── UserStories.tsx            # User stories generator
│   │   ├── ProcessFlowDiagram.tsx     # PFD with Mermaid.js
│   │   └── PreviousProjects.tsx       # History of all sessions
│   ├── components/
│   │   ├── AppSidebar.tsx
│   │   ├── ModuleCards.tsx
│   │   └── RecentProjects.tsx
│   └── lib/
│       └── api.ts                     # All API calls + types
│
└── backend/
    ├── main.py                        # FastAPI app entry point
    ├── database.py                    # Supabase client
    ├── pipelines/
    │   └── doc_pipeline.py            # OpenAI prompt + JSON schema for SOW/PRD/FRD
    ├── generators/
    │   └── docx_generator.py          # python-docx DOCX builder
    ├── templates/
    │   └── invuric_sow.docx           # Master SOW Word template
    └── routes/
        ├── sessions.py                # Session CRUD + download endpoint
        ├── sow.py                     # POST /api/generate/sow
        ├── prd.py                     # POST /api/generate/prd
        ├── frd.py                     # POST /api/generate/frd
        ├── raid.py                    # POST /api/generate/raid
        ├── wbs.py                     # POST /api/generate/wbs
        ├── backlog.py                 # POST /api/generate/backlog
        ├── pfd.py                     # POST /api/generate/pfd
        └── upload.py                  # POST /api/upload
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Supabase project (with `sessions`, `documents`, `outputs` tables and `outputs` storage bucket)
- OpenAI API key

### 1. Clone the repo

```bash
git clone https://github.com/rkst09/invuric-insights.git
cd invuric-insights
```

### 2. Frontend setup

```bash
npm install
```

Create `.env` in the project root:
```
VITE_API_URL=http://localhost:8000
```

Start the frontend:
```bash
npm run dev
# → http://localhost:5173
```

### 3. Backend setup

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Create `backend/.env`:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

Start the backend:
```bash
.venv/Scripts/python.exe -m uvicorn main:app --reload
# → http://localhost:8000
```

> **"Unable to connect to API (FailedToOpenSocket)"** in the frontend = backend is not running. Start it with the command above.

---

## Generation Flow

```
Questionnaire (answers saved to sessionStorage)
    ↓
OutputFormat → POST /api/generate/{sow|prd|frd}
    ↓
GPT-4o generates structured JSON
    ↓
python-docx builds .docx from Invuric template
    ↓
File uploaded to Supabase Storage: outputs/{session_id}/{type}.docx
    ↓
Row inserted in outputs table (session_id, output_type, storage_path)
    ↓
3600s signed URL returned → browser download
```

To re-download later from History:
```
GET /api/sessions/{session_id}/outputs/{output_type}/download
→ fetches storage_path → generates fresh signed URL
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/upload` | Upload a document for AI extraction |
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions` | List recent sessions |
| `GET` | `/api/sessions/{id}` | Get session with documents and outputs |
| `GET` | `/api/sessions/{id}/outputs/{type}/download` | Get fresh download URL |
| `POST` | `/api/generate/sow` | Generate SOW document |
| `POST` | `/api/generate/prd` | Generate PRD document |
| `POST` | `/api/generate/frd` | Generate FRD document |
| `POST` | `/api/generate/raid` | Generate RAID register |
| `POST` | `/api/generate/wbs` | Generate WBS |
| `POST` | `/api/generate/backlog` | Generate User Stories |
| `POST` | `/api/generate/pfd` | Generate Process Flow Diagram |

---

## Supabase Schema

```sql
-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  project_name text,
  module_type text,
  status text default 'created',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Documents (uploaded files)
create table documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  filename text,
  storage_path text,
  extracted_text text,
  created_at timestamptz default now()
);

-- Outputs (generated files)
create table outputs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  output_type text,
  storage_path text,
  created_at timestamptz default now()
);
```

---

## Document Style

SOW documents use the **Invuric branded Word template** (`backend/templates/invuric_sow.docx`):
- Font: Neue Haas Grotesk Text Pro
- Table headers: black (`#000000`) with white text
- Gantt chart: Unicode block characters (`██████`) filling active week columns
- Cover page: client name, project ID, author, dates injected into template runs

PRD and FRD are built from scratch matching the same style.
