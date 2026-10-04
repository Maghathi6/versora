# Versora Backend Module Architecture

This directory establishes modular boundaries for domain features.
In accordance with our architectural guidelines:
- Modules encapsulate their respective controllers, services, routes, and DTO schemas.
- Future modules will be activated phase-by-phase without leaking domain logic into the global server pipeline.

## Planned Domain Modules

| Module | Target Phase | Responsibility |
|:-------|:-------------|:---------------|
| `auth` | Phase 2 | User registration, login, JWT token issuance, session verification |
| `users` | Phase 2 | User profiles, account settings, avatar management |
| `projects` | Phase 4 | Project CRUD, repository directory provisioning on disk |
| `artifacts` | Phase 5 | Artifact registration, file tree exploration, file viewing |
| `git` | Phase 6 | Native Git operations: commits, branches, diffs, reflogs |
| `relationships` | Phase 9 | Directed artifact dependency graph management (PostgreSQL) |
| `reviews` | Phase 8 | Change requests (PRs), line-level comments, approvals, tasks |
| `impact` | Phase 10 | Graph traversal engine, downstream stale artifact flagging |
| `notifications` | Phase 7 & 10 | Activity alerts, impact review requests, event subscriptions |
