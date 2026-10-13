import { AuthServiceError } from '../auth/auth.errors';

export class GitServiceError extends AuthServiceError {
  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message, code, status, details);
    this.name = 'GitServiceError';
  }
}

export class GitNotInstalledError extends GitServiceError {
  constructor(message = 'Git is not installed or not available on the server system PATH.') {
    super(message, 'GIT_NOT_AVAILABLE', 503);
    this.name = 'GitNotInstalledError';
  }
}

export class GitRepositoryNotInitializedError extends GitServiceError {
  constructor(message = 'Git repository is not initialized for this project. Please initialize it first.') {
    super(message, 'REPOSITORY_NOT_INITIALIZED', 400);
    this.name = 'GitRepositoryNotInitializedError';
  }
}

export class GitValidationError extends GitServiceError {
  constructor(details: Array<{ field: string; issue: string }>) {
    super('Git request failed validation rules.', 'VALIDATION_ERROR', 400, details);
    this.name = 'GitValidationError';
  }
}

export class GitConflictError extends GitServiceError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'GitConflictError';
  }
}

export class GitExecutionError extends GitServiceError {
  constructor(message: string, details?: unknown) {
    super(message, 'GIT_EXECUTION_ERROR', 500, details);
    this.name = 'GitExecutionError';
  }
}

export class GitNotFoundError extends GitServiceError {
  constructor(message = 'Requested Git entity was not found.') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'GitNotFoundError';
  }
}
