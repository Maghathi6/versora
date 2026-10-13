import { AuthServiceError } from '../auth/auth.errors';

export class CollaborationError extends AuthServiceError {
  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message, code, status, details);
    this.name = 'CollaborationError';
  }
}

export class CollaborationValidationError extends CollaborationError {
  constructor(details: Array<{ field: string; issue: string }>) {
    super('Validation failed for collaboration request payload.', 'VALIDATION_ERROR', 400, details);
    this.name = 'CollaborationValidationError';
  }
}

export class CollaborationNotFoundError extends CollaborationError {
  constructor(message: string = 'Requested collaboration resource was not found.') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'CollaborationNotFoundError';
  }
}

export class CollaborationForbiddenError extends CollaborationError {
  constructor(message: string = 'You do not have permission to perform this collaboration action.') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'CollaborationForbiddenError';
  }
}

export class LastOwnerCannotBeRemovedError extends CollaborationError {
  constructor(message: string = 'The project must have at least one owner. Demoting or removing the last owner is not permitted.') {
    super(message, 'LAST_OWNER_PROTECTION', 400);
    this.name = 'LastOwnerCannotBeRemovedError';
  }
}

export class RoleEscalationError extends CollaborationError {
  constructor(message: string = 'You cannot grant or assign a role higher than your own.') {
    super(message, 'ROLE_ESCALATION_FORBIDDEN', 403);
    this.name = 'RoleEscalationError';
  }
}

export class CannotInviteSelfError extends CollaborationError {
  constructor() {
    super('You cannot invite yourself to a project.', 'INVALID_INVITATION', 400);
    this.name = 'CannotInviteSelfError';
  }
}

export class UserAlreadyMemberError extends CollaborationError {
  constructor(usernameOrEmail: string) {
    super(`User '${usernameOrEmail}' is already a member of this project.`, 'ALREADY_MEMBER', 409);
    this.name = 'UserAlreadyMemberError';
  }
}

export class PendingInvitationExistsError extends CollaborationError {
  constructor(usernameOrEmail: string) {
    super(`A pending invitation for user '${usernameOrEmail}' already exists.`, 'INVITATION_ALREADY_EXISTS', 409);
    this.name = 'PendingInvitationExistsError';
  }
}

export class InvitationNotFoundError extends CollaborationError {
  constructor() {
    super('The invitation was not found or has been revoked.', 'INVITATION_NOT_FOUND', 404);
    this.name = 'InvitationNotFoundError';
  }
}

export class InvitationExpiredError extends CollaborationError {
  constructor() {
    super('This project invitation has expired.', 'INVITATION_EXPIRED', 400);
    this.name = 'InvitationExpiredError';
  }
}

export class InvitationAlreadyHandledError extends CollaborationError {
  constructor(status: string) {
    super(`This invitation has already been ${status}.`, 'INVITATION_ALREADY_HANDLED', 400);
    this.name = 'InvitationAlreadyHandledError';
  }
}

export class UnauthorizedInvitationActionError extends CollaborationError {
  constructor() {
    super('You are not authorized to accept or reject this invitation.', 'FORBIDDEN', 403);
    this.name = 'UnauthorizedInvitationActionError';
  }
}

export class InvalidReviewTargetError extends CollaborationError {
  constructor(message: string) {
    super(message, 'INVALID_REVIEW_TARGET', 400);
    this.name = 'InvalidReviewTargetError';
  }
}

export class ReviewClosedError extends CollaborationError {
  constructor() {
    super('Cannot submit decisions or comments on a closed review.', 'REVIEW_CLOSED', 400);
    this.name = 'ReviewClosedError';
  }
}
