# Versora Database Schema Specification (PostgreSQL & Drizzle ORM)

## 1. Overview & Data Architecture

Versora uses **PostgreSQL** managed through **Drizzle ORM**.
PostgreSQL stores relational entities, authorization controls, artifact relationship graphs, review threads, and impact analysis results. **Raw version history is maintained directly within Git**, while large binaries reside in S3-compatible object storage.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      Users      │──────<│ Project Members │>──────│    Projects     │
└────────┬────────┘       └─────────────────┘       └────────┬────────┘
         │                                                   │
         │                                                   ├──────< Workspaces (Git Branches)
         │                                                   │
         │                                                   ├──────< Artifacts
         │                                                   │            │
         │                                                   │            ├────< Artifact Relations
         │                                                   │            │      (Directed Graph)
         │                                                   │            │
         │                                                   ├──────< Change Requests (PRs)
         │                                                   │            │
         │                                                   │            ├────< Reviews & Comments
         │                                                   │
         │                                                   ├──────< Tasks & Problems (Issues)
         │                                                   │
         │                                                   ├──────< Project Versions (Releases)
         │                                                   │
         └───────────────────────────────────────────────────┴──────< Activity Events (Audit Log)
```

---

## 2. Table Specifications

### 2.1 Identity & Access Control

#### `users`
Stores user profile information.
- `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
- `email`: `varchar(255)` (Unique, Not Null)
- `username`: `varchar(64)` (Unique, Not Null)
- `full_name`: `varchar(128)` (Not Null)
- `avatar_url`: `text` (Nullable)
- `created_at`: `timestamp with time zone` (Default `now()`)
- `updated_at`: `timestamp with time zone` (Default `now()`)

#### `projects`
Stores high-level project metadata. Maps directly to a native Git repository directory on disk.
- `id`: `uuid` (Primary Key)
- `name`: `varchar(128)` (Not Null)
- `slug`: `varchar(128)` (Not Null)
- `description`: `text` (Nullable)
- `visibility`: `enum('public', 'private')` (Default `'private'`)
- `git_repo_path`: `varchar(512)` (Not Null) - Relative filesystem path to the project's bare Git repository.
- `default_workspace`: `varchar(64)` (Default `'main'`)
- `created_by`: `uuid` (Foreign Key -> `users.id`)
- `created_at`: `timestamp with time zone` (Default `now()`)
- `updated_at`: `timestamp with time zone` (Default `now()`)

#### `project_members`
Defines role-based access permissions per project.
- `id`: `uuid` (Primary Key)
- `project_id`: `uuid` (Foreign Key -> `projects.id` ON DELETE CASCADE)
- `user_id`: `uuid` (Foreign Key -> `users.id` ON DELETE CASCADE)
- `role`: `enum('owner', 'maintainer', 'contributor', 'viewer')` (Default `'contributor'`)
- `created_at`: `timestamp with time zone` (Default `now()`)

---

### 2.2 Version Control & Workspaces

#### `workspaces` (Git Branches)
Represents isolated working spaces mapped to authentic Git branches.
- `id`: `uuid` (Primary Key)
- `project_id`: `uuid` (Foreign Key -> `projects.id` ON DELETE CASCADE)
- `name`: `varchar(128)` (Friendly name in Beginner Mode, e.g. "Experiment 3 Feature")
- `git_branch_name`: `varchar(255)` (Actual Git branch ref, e.g. `workspace/experiment-3`)
- `is_default`: `boolean` (Default `false`)
- `created_by`: `uuid` (Foreign Key -> `users.id`)
- `created_at`: `timestamp with time zone` (Default `now()`)
- `updated_at`: `timestamp with time zone` (Default `now()`)

#### `change_requests` (Pull Requests)
Tracks proposals to combine changes between workspaces.
- `id`: `uuid` (Primary Key)
- `project_id`: `uuid` (Foreign Key -> `projects.id` ON DELETE CASCADE)
- `title`: `varchar(255)` (Not Null)
- `description`: `text` (Nullable)
- `source_workspace_id`: `uuid` (Foreign Key -> `workspaces.id`)
- `target_workspace_id`: `uuid` (Foreign Key -> `workspaces.id`)
- `status`: `enum('open', 'merged', 'closed')` (Default `'open'`)
- `author_id`: `uuid` (Foreign Key -> `users.id`)
- `impact_summary`: `jsonb` (Cached impact assessment summary)
- `created_at`: `timestamp with time zone` (Default `now()`)
- `merged_at`: `timestamp with time zone` (Nullable)

#### `reviews`
Tracks peer reviews, approvals, and change requests.
- `id`: `uuid` (Primary Key)
- `change_request_id`: `uuid` (Foreign Key -> `change_requests.id` ON DELETE CASCADE)
- `reviewer_id`: `uuid` (Foreign Key -> `users.id`)
- `status`: `enum('pending', 'approved', 'changes_requested')` (Default `'pending'`)
- `feedback`: `text` (Nullable)
- `created_at`: `timestamp with time zone` (Default `now()`)

---

### 2.3 Artifact Traceability & Impact Analysis (Core Differentiator)

#### `artifacts`
Entities tracked within the project. Encompasses code, data, reports, and binaries.
- `id`: `uuid` (Primary Key)
- `project_id`: `uuid` (Foreign Key -> `projects.id` ON DELETE CASCADE)
- `file_path`: `varchar(1024)` (Relative path within repo, e.g. `src/train.py`, `docs/methodology.md`)
- `name`: `varchar(255)` (Display label)
- `artifact_type`: `enum('code', 'document', 'dataset', 'result', 'presentation', 'model')` (Not Null)
- `storage_type`: `enum('git_tracked', 'object_storage')` (Default `'git_tracked'`)
- `storage_key`: `varchar(512)` (Nullable - Object storage bucket key if stored externally)
- `description`: `text` (Nullable)
- `created_at`: `timestamp with time zone` (Default `now()`)
- `updated_at`: `timestamp with time zone` (Default `now()`)

#### `artifact_relations` (Directed Graph Edges)
Stores the dependencies and relationships between artifacts.
- `id`: `uuid` (Primary Key)
- `project_id`: `uuid` (Foreign Key -> `projects.id` ON DELETE CASCADE)
- `source_artifact_id`: `uuid` (Foreign Key -> `artifacts.id` ON DELETE CASCADE)
- `target_artifact_id`: `uuid` (Foreign Key -> `artifacts.id` ON DELETE CASCADE)
- `relation_type`: `enum('depends_on', 'documents', 'derived_from', 'validates')` (Not Null)
- `metadata`: `jsonb` (Optional contextual data, e.g. `{"section": "3.2", "confidence": "high"}`)
- `created_at`: `timestamp with time zone` (Default `now()`)

*Index:* Unique compound index on `(project_id, source_artifact_id, target_artifact_id, relation_type)`

#### `impact_assessments`
Historical records of impact evaluations generated when changes are saved or change requests are opened.
- `id`: `uuid` (Primary Key)
- `project_id`: `uuid` (Foreign Key -> `projects.id` ON DELETE CASCADE)
- `trigger_commit_sha`: `varchar(64)` (Not Null)
- `trigger_workspace_id`: `uuid` (Foreign Key -> `workspaces.id`)
- `changed_artifact_ids`: `jsonb` (List of artifact UUIDs modified in this commit)
- `affected_artifact_ids`: `jsonb` (Computed downstream affected artifact UUIDs with impact paths)
- `created_at`: `timestamp with time zone` (Default `now()`)

---

### 2.4 Project Versions & Audit Trail

#### `project_versions` (Releases / Milestones)
Marks a stable release snapshot.
- `id`: `uuid` (Primary Key)
- `project_id`: `uuid` (Foreign Key -> `projects.id` ON DELETE CASCADE)
- `version_name`: `varchar(128)` (e.g. `v1.0.0` or `ICML Submission`)
- `git_tag_name`: `varchar(128)` (Underlying Git tag ref)
- `commit_sha`: `varchar(64)` (Not Null)
- `changelog`: `text` (Markdown description)
- `created_by`: `uuid` (Foreign Key -> `users.id`)
- `created_at`: `timestamp with time zone` (Default `now()`)

#### `activity_events`
Audit trail of project actions.
- `id`: `uuid` (Primary Key)
- `project_id`: `uuid` (Foreign Key -> `projects.id` ON DELETE CASCADE)
- `actor_id`: `uuid` (Foreign Key -> `users.id`)
- `event_type`: `varchar(64)` (e.g., `'workspace.created'`, `'changes.saved'`, `'impact.flagged'`)
- `payload`: `jsonb`
- `created_at`: `timestamp with time zone` (Default `now()`)
