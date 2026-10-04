# Versora Frontend Services Layer

This directory houses the service layer bridging the React UI and the Versora backend REST API.

## Design Principles
1. **Single Source of Truth:** All HTTP traffic flows through `apiClient` (`request<T>`), enforcing consistent headers, error parsing, and environment URL resolution.
2. **Strict Typing:** All service methods define typed input parameters and return strongly-typed promises wrapping API responses.
3. **No Mock Business Data:** Services interact solely with real backend endpoints. Future endpoints are stubbed via typed interface contracts without returning fabricated mock payloads.
4. **Normalized Error Handling:** All failures throw normalized `ApiError` instances containing HTTP status codes, structured error codes, and field validation issues.

## Planned Domain Services

| Service | Target Phase | Planned Methods |
|:--------|:-------------|:----------------|
| `healthService` | Phase 0 & 1 (Active) | `getHealth()`, `checkBackendLive()` |
| `authService` | Phase 2 | `login()`, `signup()`, `logout()`, `getCurrentUser()` |
| `projectService` | Phase 4 | `getProjects()`, `getProject()`, `createProject()`, `deleteProject()` |
| `artifactService` | Phase 5 | `getArtifacts()`, `getArtifactContent()`, `createArtifact()` |
| `gitService` | Phase 6 | `getWorkspaces()`, `createWorkspace()`, `saveChanges()`, `getDiff()` |
| `reviewService` | Phase 8 | `getChangeRequests()`, `createChangeRequest()`, `submitReview()` |
| `impactService` | Phase 10 | `getImpactGraph()`, `simulateImpact()`, `getAffectedArtifacts()` |
