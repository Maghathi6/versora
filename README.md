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

## 🚦 Phase 2 Completion Status

- **Status:** `Phase 2 — Core Workspace, Native Git, GitHub Integration, and Project Intelligence` ✅ **COMPLETE**
- **Features Implemented & Verified:**
  - **Authentication & User Management:** Registration, login, password hashing (Argon2id), JWT authentication, protected routes, and user profile management.
  - **Project Management:** Project creation, listing, updating, deletion, and owner-only access controls.
  - **Workspace & Artifact Management:** Folder tree hierarchy, direct artifact creation with modal validation, file uploads, downloads, renames, moves, and deletions with local storage persistence and Git synchronization.
  - **Editor & Previews:** Integrated Monaco Editor with Ctrl+S/Cmd+S shortcuts, unsaved change alerts, document previews for Markdown, DOCX, XLSX, PPTX, CSV, images, and PDFs.
  - **Native Git Engine:** Automated repository initialization, working-tree status, textual diffs, version commits, branch creation, branch switching, and safe restore with backup tags.
  - **GitHub Remote Integration:** GitHub OAuth account linking, encrypted access token storage (AES-256-GCM), remote publishing, fetch, push, safe fast-forward pull, divergence protection, and non-interactive authentication.
  - **Project Intelligence:** Artifact relationship tracking (`depends_on`, `documents`, `tests`, `generated_from`, `related_to`), Git provenance traceability, rule-based change impact analysis, and review/dismiss workflows.
  - **Project Activity Timeline:** Real-time chronological audit feed across file changes, Git commits, GitHub syncs, and relationships, with sanitized metadata and category filtering (`All`, `Artifacts`, `Git`, `GitHub`, `Connections`).

- **Deferred to Phase 3:** Project invitations, team collaboration discussions, comment threads, and notification streams.
