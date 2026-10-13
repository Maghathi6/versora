import { AuthServiceError } from '../auth/auth.errors';

export class ArtifactServiceError extends AuthServiceError {
  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message, code, status, details);
    this.name = 'ArtifactServiceError';
  }
}

export class ArtifactValidationError extends ArtifactServiceError {
  constructor(details: Array<{ field: string; issue: string }>) {
    super(
      'Artifact request payload failed validation rules.',
      'VALIDATION_ERROR',
      400,
      details
    );
    this.name = 'ArtifactValidationError';
  }
}

export class ArtifactNotFoundError extends ArtifactServiceError {
  constructor(artifactId?: string) {
    super(
      artifactId ? `Artifact '${artifactId}' was not found.` : 'Artifact was not found.',
      'NOT_FOUND',
      404
    );
    this.name = 'ArtifactNotFoundError';
  }
}

export class ArtifactForbiddenError extends ArtifactServiceError {
  constructor(message = 'You do not have permission to access or modify this artifact.') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ArtifactForbiddenError';
  }
}

export class DuplicateArtifactNameError extends ArtifactServiceError {
  constructor(name: string, location = 'this directory') {
    super(
      `An item named '${name}' already exists in ${location}.`,
      'CONFLICT',
      409
    );
    this.name = 'DuplicateArtifactNameError';
  }
}

export class InvalidArtifactOperationError extends ArtifactServiceError {
  constructor(message: string) {
    super(message, 'BAD_REQUEST', 400);
    this.name = 'InvalidArtifactOperationError';
  }
}
