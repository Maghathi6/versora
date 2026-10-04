# Versora Product Requirements Document (PRD)

## 1. Product Vision & Problem Statement

Modern projects—especially in research, data science, machine learning, and cross-functional product development—are not composed purely of source code. They consist of an interconnected matrix of:
- **Code:** preprocessing scripts, neural network architectures, web APIs.
- **Datasets:** raw survey files, cleaned tabular dumps, validation benchmarks.
- **Documents:** scientific papers, compliance filings, architecture RFCs.
- **Results:** confusion matrices, metrics logs, model checkpoint binaries.
- **Presentations:** stakeholder slide decks, executive summaries.

Current tools suffer from two critical failures:
1. **The Version Control Chasm:** Git is universally adopted for code, but its steep command-line learning curve and unforgiving concepts alienate researchers, writers, and analysts.
2. **The Isolation Blindspot:** Tools like GitHub track changes at the repository or file level, but they lack semantic intelligence regarding how changes propagate across disparate artifacts. When a training script changes, there is no automated mechanism to determine that Section 3 of a research paper or an executive deck is now presenting outdated metrics.

**Versora solves both problems:**
1. Providing an approachable, jargon-free version control experience powered by authentic Git.
2. Tracking relationships between heterogeneous project artifacts to provide automated **Impact Analysis** and **Version Intelligence**.

---

## 2. Target Personas

### Persona A: Dr. Elena Rostova (Research Scientist / Beginner Mode)
- **Background:** PhD in Computational Biology; writes Python and R scripts; drafts papers in Markdown and LaTeX.
- **Pain Point:** Terrified of Git merge conflicts and terminal command errors (`git rebase -i`); constantly forgets to re-run figures when underlying scripts are updated.
- **Versora Need:** Intuitive UI buttons for "Save Changes" and "Switch Workspace"; instant visual alert showing which manuscript sections need updating whenever a data cleaning script changes.

### Persona B: Marcus Chen (Senior Platform Engineer / Advanced Mode)
- **Background:** 10+ years in distributed systems; comfortable with raw Git CLI and CI/CD pipelines.
- **Pain Point:** Team members frequently break documentation and produce stale benchmark reports because dependencies aren't tracked systematically.
- **Versora Need:** Ability to view raw commit SHAs, git diffs, and branch topology; confidence that the platform is backed by authentic Git without proprietary lock-in.

---

## 3. Functional Requirements

### 3.1 Core Version Control (Git-Backed)
- **FR-VC-01 (Authentic Git Engine):** Every Versora project MUST correspond to a valid, standard Git repository. No simulated or mock version-control abstractions.
- **FR-VC-02 (Friendly Terminology):** The default user interface MUST present friendly terminology (`Project`, `Save Changes`, `Workspace`, `Change Request`, `Combine Changes`).
- **FR-VC-03 (Advanced Mode Switch):** Users MUST be able to toggle "Advanced Mode" to reveal raw Git terminology (`Repository`, `Commit`, `Branch`, `Pull Request`, `Merge`, commit hashes, reflogs).
- **FR-VC-04 (Workspace Isolation):** Users can create, switch between, and delete isolated workspaces (Git branches) without writing CLI commands.
- **FR-VC-05 (Change Requests & Reviews):** Proposing changes between workspaces initiates a structured Change Request featuring visual diffs, inline review comments, and approval workflows.

### 3.2 Artifact Traceability & Impact Analysis
- **FR-TR-01 (Heterogeneous Artifact Support):** Projects track code files, markdown documents, CSV/Parquet datasets, images, and binary model files.
- **FR-TR-02 (Artifact Relationship Graph):** Users and automated parsers can define directional relationships between artifacts (`DEPENDS_ON`, `DOCUMENTS`, `DERIVED_FROM`, `VALIDATES`).
- **FR-TR-03 (Automated Impact Traversal):** When an artifact is modified in a commit, the backend traverses downstream dependency edges to identify all potentially affected artifacts.
- **FR-TR-04 (Stale Artifact Flagging):** Affected artifacts are visually badged as "Requires Review" until verified by an assigned reviewer.
- **FR-TR-05 (Impact Matrix in Change Requests):** Every Change Request automatically compiles an "Impact Summary" listing all downstream documents, datasets, and code files impacted by the proposed changes.

### 3.3 Project Intelligence & Milestones
- **FR-PI-01 (Project Versions / Releases):** Users can tag a specific snapshot of the entire project as a named Version (e.g., `v1.2.0 - Nature Submission`).
- **FR-PI-02 (Cross-Artifact Diff):** Viewing a Project Version shows what code changed, what datasets were updated, and what documents were revised in that release.
- **FR-PI-03 (Activity Stream):** Real-time, audit-grade event feed of all project actions (commits, reviews, relationship modifications).

### 3.4 Future AI Assistant (Planned Phase 14)
- **FR-AI-01 (Backend Tool Calling):** The AI assistant functions via secure backend server-side endpoints with defined tool schemas.
- **FR-AI-02 (Read-Only Safety Default):** The AI may analyze project history and dependency graphs, but CANNOT mutate Git history or database records without explicit user confirmation.
- **FR-AI-03 (Impact Explanation):** The AI can generate natural language explanations of impact analysis graphs (e.g., *"Modifying learning_rate in train.py may invalidate the convergence metrics reported on page 4 of report.pdf"*).

### 3.5 Optional GitHub Integration (Planned Phase 15)
- **FR-GH-01 (Zero-Dependency Independence):** Versora operates fully independently without requiring GitHub authentication or hosting.
- **FR-GH-02 (Two-Way Synchronization):** Optional integration enables mirroring commits and pull requests between a GitHub repository and a Versora project.

---

## 4. Non-Functional Requirements

### 4.1 Performance & Responsiveness
- **NFR-PERF-01:** Health check and lightweight API endpoints must respond with P95 < 50ms.
- **NFR-PERF-02:** Impact analysis graph traversal for projects with up to 1,000 artifacts and 5,000 relations must execute in < 200ms.
- **NFR-PERF-03:** Client bundle size must remain lightweight with code-splitting to ensure fast initial page loads (< 1.5s on broadband).

### 4.2 Security & Data Integrity
- **NFR-SEC-01:** Strict input validation on all API boundaries using Zod schemas.
- **NFR-SEC-02:** Role-Based Access Control (RBAC): Owner, Maintainer, Contributor, and Viewer roles.
- **NFR-SEC-03:** No sensitive credentials, tokens, or private keys committed to Git; environment variables validated at startup.

### 4.3 Accessibility & Usability (WCAG 2.1 AA)
- **NFR-A11Y-01:** High contrast ratio (minimum 4.5:1 for body text).
- **NFR-A11Y-02:** Keyboard navigation support for all core interactive elements.
- **NFR-A11Y-03:** Clear explanatory tooltips for every technical concept in Beginner Mode.
