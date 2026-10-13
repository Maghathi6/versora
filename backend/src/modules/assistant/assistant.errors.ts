import { AuthServiceError } from '../auth/auth.errors';

export class AssistantError extends AuthServiceError {
  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message, code, status, details);
    this.name = 'AssistantError';
  }
}

export class AssistantValidationError extends AssistantError {
  constructor(details: Array<{ field: string; issue: string }> | string) {
    if (typeof details === 'string') {
      super(details, 'VALIDATION_ERROR', 400);
    } else {
      super('Validation failed for assistant request payload.', 'VALIDATION_ERROR', 400, details);
    }
    this.name = 'AssistantValidationError';
  }
}

export class ConversationNotFoundError extends AssistantError {
  constructor(message = 'Requested assistant conversation was not found.') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'ConversationNotFoundError';
  }
}

export class ConversationForbiddenError extends AssistantError {
  constructor(message = 'You do not have permission to access this assistant conversation.') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ConversationForbiddenError';
  }
}

export class AIProviderNotConfiguredError extends AssistantError {
  constructor(
    message = 'AI Assistant is not configured. Please set AI_PROVIDER (e.g. openai, anthropic, gemini, ollama) and AI_API_KEY in server environment variables.'
  ) {
    super(message, 'AI_PROVIDER_NOT_CONFIGURED', 503);
    this.name = 'AIProviderNotConfiguredError';
  }
}

export class AIProviderError extends AssistantError {
  constructor(message = 'The AI model provider encountered an error while processing the request.', details?: unknown) {
    super(message, 'AI_PROVIDER_ERROR', 502, details);
    this.name = 'AIProviderError';
  }
}

export class AIProviderRateLimitError extends AssistantError {
  constructor(message = 'AI model rate limit exceeded. Please try again shortly.') {
    super(message, 'AI_RATE_LIMIT_EXCEEDED', 429);
    this.name = 'AIProviderRateLimitError';
  }
}

export class AIProviderTimeoutError extends AssistantError {
  constructor(message = 'The AI request timed out before receiving a response.') {
    super(message, 'AI_REQUEST_TIMEOUT', 504);
    this.name = 'AIProviderTimeoutError';
  }
}
