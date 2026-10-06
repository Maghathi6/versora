/**
 * Service-level domain errors for authentication operations.
 */

export class AuthServiceError extends Error {
  public code: string;
  public status: number;
  public details?: unknown;

  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class DuplicateEmailError extends AuthServiceError {
  constructor(email?: string) {
    super(
      email
        ? `A user with email '${email}' already exists.`
        : 'A user with this email address already exists.',
      'DUPLICATE_EMAIL',
      409
    );
    this.name = 'DuplicateEmailError';
  }
}

export class DuplicateUsernameError extends AuthServiceError {
  constructor(username?: string) {
    super(
      username
        ? `A user with username '${username}' already exists.`
        : 'A user with this username already exists.',
      'DUPLICATE_USERNAME',
      409
    );
    this.name = 'DuplicateUsernameError';
  }
}

export class RegistrationValidationError extends AuthServiceError {
  constructor(details: Array<{ field: string; issue: string }>) {
    super(
      'Registration input failed validation rules.',
      'VALIDATION_ERROR',
      400,
      details
    );
    this.name = 'RegistrationValidationError';
  }
}

export class LoginValidationError extends AuthServiceError {
  constructor(details: Array<{ field: string; issue: string }>) {
    super(
      'Login input failed validation rules.',
      'VALIDATION_ERROR',
      400,
      details
    );
    this.name = 'LoginValidationError';
  }
}

export class InvalidCredentialsError extends AuthServiceError {
  constructor(message = 'Invalid email or password.') {
    super(message, 'INVALID_CREDENTIALS', 401);
    this.name = 'InvalidCredentialsError';
  }
}
