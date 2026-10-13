import { AuthServiceError } from '../auth/auth.errors';

export class SelfRelationshipError extends AuthServiceError {
  constructor(message: string = 'An artifact cannot have a relationship with itself.') {
    super(message, 'SELF_RELATIONSHIP_NOT_ALLOWED', 400);
  }
}

export class CrossProjectRelationshipError extends AuthServiceError {
  constructor(message: string = 'Both artifacts must belong to the same project.') {
    super(message, 'CROSS_PROJECT_RELATIONSHIP_FORBIDDEN', 400);
  }
}

export class DuplicateRelationshipError extends AuthServiceError {
  constructor(message: string = 'This relationship already exists between the artifacts.') {
    super(message, 'DUPLICATE_RELATIONSHIP', 409);
  }
}

export class RelationshipNotFoundError extends AuthServiceError {
  constructor(message: string = 'Relationship not found.') {
    super(message, 'RELATIONSHIP_NOT_FOUND', 404);
  }
}

export class IntelligenceValidationError extends AuthServiceError {
  public readonly errors: Array<{ field: string; issue: string }>;

  constructor(errors: Array<{ field: string; issue: string }>) {
    super(
      `Intelligence validation failed: ${errors.map((e) => `${e.field} - ${e.issue}`).join(', ')}`,
      'INTELLIGENCE_VALIDATION_ERROR',
      400,
      errors
    );
    this.errors = errors;
  }
}
