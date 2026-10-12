import { AuthServiceError } from '../auth/auth.errors';

/**
 * Base domain error for project operations.
 * Inherits from AuthServiceError to ensure seamless handling by the global error middleware.
 */
export class ProjectServiceError extends AuthServiceError {
  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message, code, status, details);
    this.name = 'ProjectServiceError';
  }
}

/**
 * Thrown when request payload fails Zod schema validation rules.
 */
export class ProjectValidationError extends ProjectServiceError {
  constructor(details: Array<{ field: string; issue: string }>) {
    super(
      'Project request payload failed validation rules.',
      'VALIDATION_ERROR',
      400,
      details
    );
    this.name = 'ProjectValidationError';
  }
}

/**
 * Thrown when the requested project cannot be found.
 */
export class ProjectNotFoundError extends ProjectServiceError {
  constructor(projectId?: string) {
    super(
      projectId ? `Project with ID '${projectId}' was not found.` : 'Project was not found.',
      'NOT_FOUND',
      404
    );
    this.name = 'ProjectNotFoundError';
  }
}

/**
 * Thrown when a user attempts to access or modify a project owned by another user.
 */
export class ProjectForbiddenError extends ProjectServiceError {
  constructor(message = 'You do not have permission to access or modify this project.') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ProjectForbiddenError';
  }
}

/**
 * Thrown when attempting to create or rename a project to a name that already exists for the owner.
 */
export class DuplicateProjectNameError extends ProjectServiceError {
  constructor(name: string) {
    super(
      `A project named '${name}' already exists in your account.`,
      'CONFLICT',
      409
    );
    this.name = 'DuplicateProjectNameError';
  }
}
