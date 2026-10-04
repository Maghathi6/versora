# Versora Documentation Hub

Welcome to the technical documentation repository for **Versora**.

## Quick Reference Documents
- [README.md](file:///c:/Users/HP/OneDrive/Documents/projects/versora/README.md): High-level overview, setup guide, and philosophy.
- [ARCHITECTURE.md](file:///c:/Users/HP/OneDrive/Documents/projects/versora/ARCHITECTURE.md): Technical boundaries, tri-store model, and impact engine mechanics.
- [REQUIREMENTS.md](file:///c:/Users/HP/OneDrive/Documents/projects/versora/REQUIREMENTS.md): Functional and non-functional specifications.
- [DATABASE_SCHEMA.md](file:///c:/Users/HP/OneDrive/Documents/projects/versora/DATABASE_SCHEMA.md): PostgreSQL schema entities and Drizzle ORM layout.
- [API_SPEC.md](file:///c:/Users/HP/OneDrive/Documents/projects/versora/API_SPEC.md): REST endpoints and error codes.
- [DEVELOPMENT_PLAN.md](file:///c:/Users/HP/OneDrive/Documents/projects/versora/DEVELOPMENT_PLAN.md): Phase-by-phase execution roadmap from Phase 0 to Phase 16.

## Architectural Data Flow Summary
```
[User Browser]
      │
      ▼
[React 18 + Vite Frontend]
      │ (REST API / HTTPS)
      ▼
[Node.js + Express API] ─── (Zod Validation & Middleware)
      │
      ├──▶ [PostgreSQL Metadata / Drizzle ORM]
      │        (Users, Projects, Artifact Graph, Reviews)
      │
      ├──▶ [Native Git Engine]
      │        (Commits, Workspaces/Branches, Diffs)
      │
      └──▶ [Object Storage (S3 / R2)]
               (Large Datasets, Model Binaries, Media)
```
