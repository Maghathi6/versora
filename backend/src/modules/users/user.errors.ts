import { AuthServiceError } from '../auth/auth.errors';

/**
 * Domain error for invalid user profile update input payloads.
 */
export class ProfileValidationError extends AuthServiceError {
  constructor(details: Array<{ field: string; issue: string }>) {
    super(
      'Profile update input failed validation rules.',
      'VALIDATION_ERROR',
      400,
      details
    );
    this.name = 'ProfileValidationError';
  }
}
