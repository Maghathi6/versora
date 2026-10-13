import { AuthServiceError } from '../auth/auth.errors';

export class GitHubNotConfiguredError extends AuthServiceError {
  constructor(
    message = 'GitHub integration is not configured on this server. Please set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_TOKEN_ENCRYPTION_KEY.'
  ) {
    super(message, 'GITHUB_NOT_CONFIGURED', 503);
    this.name = 'GitHubNotConfiguredError';
  }
}

export class GitHubAuthRequiredError extends AuthServiceError {
  constructor(
    message = 'A connected GitHub account is required for this operation. Please connect your GitHub account in Settings.'
  ) {
    super(message, 'GITHUB_AUTH_REQUIRED', 401);
    this.name = 'GitHubAuthRequiredError';
  }
}

export class GitHubOAuthStateError extends AuthServiceError {
  constructor(
    message = 'Invalid or expired GitHub OAuth state token. Please initiate the authorization request again.'
  ) {
    super(message, 'GITHUB_OAUTH_STATE_INVALID', 400);
    this.name = 'GitHubOAuthStateError';
  }
}

export class GitHubApiError extends AuthServiceError {
  public readonly githubStatus?: number;

  constructor(message: string, githubStatus?: number) {
    super(
      message,
      'GITHUB_API_ERROR',
      githubStatus === 404 ? 404 : githubStatus === 403 ? 403 : 502
    );
    this.name = 'GitHubApiError';
    this.githubStatus = githubStatus;
  }
}

export class GitHubSyncConflictError extends AuthServiceError {
  constructor(message: string) {
    super(message, 'GITHUB_SYNC_CONFLICT', 409);
    this.name = 'GitHubSyncConflictError';
  }
}

export class GitHubValidationError extends AuthServiceError {
  constructor(details: Array<{ field: string; issue: string }>, message = 'GitHub request validation failed') {
    super(message, 'GITHUB_VALIDATION_ERROR', 400, details);
    this.name = 'GitHubValidationError';
  }
}

export class GitHubForbiddenError extends AuthServiceError {
  constructor(message = 'You do not have permission to access or modify this GitHub resource.') {
    super(message, 'GITHUB_FORBIDDEN', 403);
    this.name = 'GitHubForbiddenError';
  }
}

export class GitHubNotFoundError extends AuthServiceError {
  constructor(message = 'The requested GitHub repository or remote configuration was not found.') {
    super(message, 'GITHUB_NOT_FOUND', 404);
    this.name = 'GitHubNotFoundError';
  }
}
