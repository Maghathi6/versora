# Versora REST API Specification

## 1. Conventions & Standards

### 1.1 Base URL
- Development: `http://localhost:4000/api`
- Production: `https://api.versora.dev/api`

### 1.2 Response Envelope
All API endpoints conform to a standardized JSON response envelope:

#### Successful Response (`2xx`)
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-10-04T17:30:00.000Z"
}
```

#### Error Response (`4xx`, `5xx`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The provided request payload failed validation.",
    "details": [
      {
        "field": "name",
        "issue": "Project name must be at least 3 characters long."
      }
    ]
  },
  "timestamp": "2026-10-04T17:30:00.000Z"
}
```

### 1.3 Standard Error Codes
| Code | HTTP Status | Description |
|:-----|:------------|:------------|
| `BAD_REQUEST` | 400 | Malformed request syntax or unparseable JSON |
| `VALIDATION_ERROR` | 400 | Zod schema validation failure on body, query, or params |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions for the requested resource |
| `NOT_FOUND` | 404 | Target resource does not exist |
| `CONFLICT` | 409 | Resource state conflict (e.g. branch name already exists) |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled server exception |

---

## 2. Currently Implemented Endpoints (Phase 0)

### 2.1 System Health
Returns the operational health, uptime, environment, and version of the Versora API.

- **URL:** `/api/health`
- **Method:** `GET`
- **Auth:** None (Public)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "versora-api",
    "version": "0.1.0",
    "environment": "development",
    "uptimeSeconds": 142.85,
    "timestamp": "2026-10-04T17:30:00.000Z"
  },
  "timestamp": "2026-10-04T17:30:00.000Z"
}
```

---

## 3. Planned Endpoints Roadmap

### 3.1 Authentication & Profile (Phase 2)
- `POST /api/v1/auth/register` — Create user account
- `POST /api/v1/auth/login` — Authenticate and receive session/JWT
- `POST /api/v1/auth/logout` — Terminate session
- `GET /api/v1/users/me` — Current user profile

### 3.2 Projects (Phase 4)
- `GET /api/v1/projects` — List accessible projects
- `POST /api/v1/projects` — Create project (initializes bare Git repo)
- `GET /api/v1/projects/:projectId` — Project metadata and summary
- `PATCH /api/v1/projects/:projectId` — Update project configuration

### 3.3 Workspaces / Branches (Phase 6)
- `GET /api/v1/projects/:projectId/workspaces` — List workspaces (git branches)
- `POST /api/v1/projects/:projectId/workspaces` — Create workspace
- `DELETE /api/v1/projects/:projectId/workspaces/:workspaceId` — Delete workspace

### 3.4 Changes / Commits (Phase 6)
- `POST /api/v1/projects/:projectId/commits` — Save changes (commit staged changes to Git)
- `GET /api/v1/projects/:projectId/commits` — History stream with beginner/advanced view
- `GET /api/v1/projects/:projectId/commits/:commitSha/diff` — Visual file diff

### 3.5 Artifacts & Traceability Graph (Phase 9 & 10)
- `GET /api/v1/projects/:projectId/artifacts` — List artifacts
- `POST /api/v1/projects/:projectId/artifacts` — Register an artifact entity
- `GET /api/v1/projects/:projectId/relations` — Full directed dependency graph
- `POST /api/v1/projects/:projectId/relations` — Connect two artifacts (e.g. `DEPENDS_ON`)
- `POST /api/v1/projects/:projectId/impact/simulate` — Simulate impact of modifying an artifact
- `GET /api/v1/projects/:projectId/impact/:assessmentId` — Retrieve impact assessment report

### 3.6 Change Requests & Reviews (Phase 8)
- `GET /api/v1/projects/:projectId/change-requests` — List change requests
- `POST /api/v1/projects/:projectId/change-requests` — Open change request (computes impact)
- `POST /api/v1/projects/:projectId/change-requests/:crId/combine` — Merge changes into target workspace
- `POST /api/v1/change-requests/:crId/reviews` — Submit review approval / feedback

### 3.7 Project Versions / Releases (Phase 11)
- `GET /api/v1/projects/:projectId/versions` — List releases/milestones
- `POST /api/v1/projects/:projectId/versions` — Tag release snapshot with changelog
