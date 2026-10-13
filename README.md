# Versora

> **"Track what changed. Understand what it affects."**

Versora is a modern, user-friendly version-control and project traceability platform. It is engineered to bridge the gap between everyday project artifacts and true version control, enabling teams and individual creators to understand not just *how* files change, but *what those changes affect* across the entire project lifecycle.

---

## 🌟 The Two Core Pillars of Versora

### 1. Simple Version Control (Accessible to Everyone, Powered by Real Git)
Traditional version control tools (like raw Git CLI) impose steep learning curves, esoteric jargon, and dangerous commands (`rebase`, `cherry-pick`, detached `HEAD`) that alienate researchers, writers, data scientists, and novice engineers.

Versora provides an intuitive, approachable interface using plain, human-centered terminology—**without sacrificing technical truth**. Under the hood, **Git remains the authentic version-control engine**. Advanced developers can switch to **Advanced Mode** at any moment to view raw commit hashes, branches, visual diffs, and merge topologies. Complexity is strictly optional; it is never hidden or permanently abstracted away.

#### Friendly Terminology Mapping

| Conventional Git Term | Versora Term (Beginner Mode) | User Intention |
|:----------------------|:-----------------------------|:---------------|
| **Repository** | **Project** | The home for all project files and history |
| **Clone** | **Get Project** | Download a copy to work on |
| **Commit** | **Save Changes** | Record a snapshot of modified work with a summary |
| **Branch** | **Workspace** | An isolated space to try ideas without disturbing main work |
| **Checkout** | **Switch Workspace** | Move between different lines of work |
| **Pull** | **Get Latest** | Fetch updates made by collaborators |
| **Push** | **Send Changes** | Share saved changes with the team |
| **Merge** | **Combine Changes** | Integrate work from one workspace into another |
| **Pull Request** | **Change Request** | Propose combining changes and request peer review |
| **Review** | **Review Changes** | Inspect what changed, comment, and approve |
| **Issue** | **Task / Problem** | Track items that need attention |
| **Tag / Release** | **Project Version** | Mark a stable milestone (e.g. `v1.0.0`, `Paper Submission`) |

---

### 2. Project Traceability and Version Intelligence (The Core Differentiator)
GitHub and traditional Git hosts excel at storing code repositories, but they treat projects as flat collections of text and binaries. They have no innate understanding of how a change in one file propagates through an ecosystem of connected artifacts.

**Versora understands relationships across diverse project assets:**
- Source code (`train.py`, `analysis.R`, `pipeline.ts`)
- Datasets (`cleaned_survey_v2.csv`, `validation_split.parquet`)
- Documents & Reports (`methodology.md`, `manuscript.docx`, `spec.pdf`)
- Experiment Results & Metrics (`weights.onnx`, `benchmark_summary.json`)
- Presentations & Diagrams (`architecture.drawio`, `slide_deck.key`)

#### How Impact Analysis Works
When an artifact changes, Versora traverses the artifact dependency graph to calculate and visualize potential impact:

```
[ train.py ] (Changed)
     │
     ▼
[ Model Training Configuration ] (Directly dependent)
     │
     ▼
[ Results / benchmark_summary.json ] (Potentially Stale)
     │
     ▼
[ Research Manuscript / Section 3.2 ] (Action Required: Needs Review)
```

Versora flags affected dependencies, suggests reviews to relevant stakeholders, and prevents outdated conclusions from persisting silently.

---

## 🎯 Target Audiences

- **Beginner Mode:** Students, scientists, technical writers, product leads, and domain experts who need reliable version tracking, collaborative reviews, and workspace switching without needing terminal commands or Linux knowledge.
- **Advanced Mode:** Software engineers and technical architects who require commit hashes, git reflogs, raw tree diffs, branch management, and fine-grained repository diagnostics.

---

## 🏗️ Technology Stack

| Layer | Technology | Rationale |
|:------|:-----------|:----------|
| **Frontend** | React 18, TypeScript, Vite | Fast, standard, component-based modern SPA |
| **Data Fetching** | TanStack React Query v5 | Robust caching, server-state management, retry & refetch logic |
| **Styling** | Custom Vanilla CSS Design System | Curated CSS custom properties, zero build-step overhead, bespoke aesthetics |
| **Backend** | Node.js, Express, TypeScript | Modular, scalable REST API with clean separation of concerns |
| **Validation** | Zod | Runtime type validation for safe request parsing and type inference |
| **Database (Planned)** | PostgreSQL & Drizzle ORM | Relational integrity for artifact graphs, typed queries, lightweight migrations |
| **Version Engine** | Native Git | Real version control source of truth for repository history |
| **Object Storage (Planned)** | Cloudflare R2 / S3-compatible | High-performance, cost-effective storage for datasets and large binaries |

---

## 📂 Project Structure

```
versora/
├── backend/                  # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/           # Environment and runtime configurations
│   │   ├── controllers/      # Route request/response handlers
│   │   ├── middlewares/      # Error, logging, and security middleware
│   │   ├── routes/           # Express router definitions
│   │   ├── types/            # Shared TypeScript interfaces & types
│   │   └── index.ts          # Express application entrypoint
│   ├── .env.example          # Backend environment template
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # Vite + React + TypeScript SPA
│   ├── src/
│   │   ├── assets/           # Visual assets
│   │   ├── components/       # Reusable UI components (Logo, Header, Cards)
│   │   ├── styles/           # Design system tokens and global styles
│   │   ├── types/            # Frontend interfaces & schemas
│   │   ├── App.tsx           # Main application root
│   │   └── main.tsx          # React DOM entrypoint
│   ├── .env.example          # Frontend environment template
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/                     # Architectural diagrams & specifications
├── ARCHITECTURE.md           # System topology and boundary definitions
├── REQUIREMENTS.md           # Comprehensive multi-phase requirements
├── DATABASE_SCHEMA.md        # Database schema specifications (Drizzle ORM)
├── API_SPEC.md               # REST API endpoints and contract specifications
├── DEVELOPMENT_PLAN.md       # Roadmap phases (Phase 0 to Phase 16)
├── .env.example              # Global environment reference
└── .gitignore                # Git exclusions
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later
- **Git**: Installed and available in your system path

### 1. Clone & Set Up Environment

```bash
# Clone the repository
git clone <repository-url> versora
cd versora

# Copy environment variable templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Database Setup & Migrations (PostgreSQL)

Ensure PostgreSQL is running locally (e.g. on port `5432` with database `versora_dev`), then run database migrations:

```bash
cd backend
npm run db:migrate
```

To verify the database schema and migration snapshots at any time:

```bash
npm run db:check
```

### 3. Run Development Servers

#### Option A: Run from Project Root (Recommended)

```bash
# Install root dependencies
npm install

# Start both backend and frontend concurrently
npm run dev
```

- **Backend:** Starts on `http://localhost:4000` (Health: `http://localhost:4000/api/health`)
- **Frontend:** Starts on `http://localhost:5173` with automated `/api` proxying to backend

#### Option B: Run in Separate Terminals

##### Terminal 1 (Backend API):
```bash
cd backend
npm install
npm run dev
```

##### Terminal 2 (Frontend Client):
```bash
cd frontend
npm install
npm run dev
```

---

---

## 🚦 Phase Completion Status

### ✅ Phase 3 — Collaboration, Reviews, Tasks, and Notifications (COMPLETE)
- **Team Collaboration:** Multi-member project access, role-based authorization (`owner`, `maintainer`, `contributor`, `viewer`).
- **Reviews & Decisions:** Review requests on branches or artifacts with structured approval/rejection decisions and reviewer summaries.
- **Tasks & Assignments:** Project-scoped task tracking with priorities (`urgent`, `high`, `medium`, `low`), statuses (`todo`, `in_progress`, `in_review`, `completed`), assignments, and linked artifacts.
- **Threaded Comments & Notifications:** In-app notification bell with real-time badges, read/unread states, and threaded discussions on artifacts, reviews, and tasks.

---

### 🤖 Phase 4 — AI Project Assistant & Project Intelligence (COMPLETE)
Grounded AI intelligence that understands your actual Versora project data. Rather than acting like a disconnected chatbot, Versora's Assistant answers questions using real accessible artifacts, Git commit history, relationship graphs, impact analysis, reviews, tasks, and project activity feeds.

#### Key Features
1. **Multi-Provider AI Service Layer:**
   - Provider-independent architecture with support for:
     - **OpenAI** (`gpt-4o`, `gpt-4o-mini`, etc.)
     - **Anthropic Claude** (`claude-3-5-sonnet-latest`, `claude-3-haiku`, etc.)
     - **Google Gemini** (`gemini-1.5-flash`, `gemini-1.5-pro`, etc.)
     - **Ollama / Local LLMs** (any OpenAI-compatible local server, e.g. `llama3`, `mistral`, `deepseek`)
     - **Mock Provider** (for hermetic automated testing)
   - Zero-secret client exposure: all keys are kept strictly on the backend.
   - Graceful unconfigured state: informative UI warning with exact setup instructions when `AI_PROVIDER` or `AI_API_KEY` is missing.

2. **Authorized, Project-Grounded Context Retrieval:**
   - Multi-source retrieval:
     - Project metadata (name, description)
     - Artifacts (keyword-scored file matching, safe truncation, non-text/binary exclusion)
     - Traceability relationships (`depends_on`, `documents`, `tests`, etc.)
     - Impact analysis predictions
     - Git branch, working-tree modifications, commit history, and commit diffs
     - Reviews and approval decisions
     - Project tasks, priorities, and assignments
     - Project audit timeline activities
   - Project-scoped authorization: Users can only query projects they are members of. Cross-project data leakage is strictly prevented.
   - Read-only safety: AI responses never execute shell commands, edit database records, or mutate Git repositories.

3. **Evidence Citations & Anti-Hallucination:**
   - Structured evidence references parsed from responses (`[artifact:name]`, `[commit:hash]`, `[task:id]`, `[review:id]`).
   - Every citation is validated against actual entities retrieved for that request; hallucinations are automatically pruned.
   - Interactive source chips in the UI allowing one-click navigation to the referenced file, commit, task, or review.
   - Uncertainty banners displayed whenever the assistant flags missing context or estimated predictions.

4. **Context-Aware Quick Actions:**
   - **Explain Artifact (`explain-artifact`):** Explains code purpose, architecture, and connections to related files. Directly accessible from the Monaco Editor toolbar via the **"Ask AI"** button.
   - **Summarize Commit (`summarize-commit`):** Summarizes diffs, modified files, and downstream consequences of any commit.
   - **Explain Impact (`explain-impact`):** Translates graph impact predictions into plain-language risk assessments.
   - **Review Assistance (`review-assistance`):** Summarizes pending reviews, blocking tasks, and required checks.
   - **Project Summary (`project-summary`):** Generates a high-level executive summary of project goals, health, and recent changes.

5. **Persistent, Project-Scoped Conversations:**
   - Project-scoped chat history stored in PostgreSQL via Drizzle ORM (`assistant_conversations`, `assistant_messages`).
   - Ownership isolation: Conversations are private to the authoring user.
   - Full conversation lifecycle: Create, list, switch, rename, and delete conversations.

6. **Prompt Injection Hardening:**
   - Retrieved artifact content, user comments, and commit diffs are encapsulated within strict `<project_data_boundary>` delimiters.
   - System prompt instructs model to treat all retrieved content strictly as inert reference data rather than executable instructions.

---

## ⚙️ AI Provider Setup Guide

To enable AI features, set the following environment variables in `backend/.env`:

### Option 1: OpenAI
```env
AI_PROVIDER=openai
AI_API_KEY=sk-proj-your-openai-api-key
AI_MODEL=gpt-4o-mini
```

### Option 2: Anthropic Claude
```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-your-anthropic-api-key
AI_MODEL=claude-3-5-sonnet-latest
```

### Option 3: Google Gemini
```env
AI_PROVIDER=gemini
AI_API_KEY=your-gemini-api-key
AI_MODEL=gemini-1.5-flash
```

### Option 4: Local Ollama (Free, Offline, Privacy-Preserving)
```bash
# 1. Start Ollama with your chosen model
ollama run llama3
```
In `backend/.env`:
```env
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3
AI_API_KEY=ollama
```

*Note: If no AI provider is configured, the Versora frontend will display an intuitive configuration prompt without breaking existing workspace features.*

