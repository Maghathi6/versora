import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse, ApiErrorDetail } from '../types/api';
import { AuthServiceError } from '../modules/auth/auth.errors';

/**
 * 404 Not Found Middleware
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested resource '${req.originalUrl}' does not exist on this server.`,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(response);
}

/**
 * Global Error Handler Middleware
 *
 * Maps domain errors to appropriate HTTP status codes (e.g. 400, 409).
 * Guarantees that internal implementation details, SQL errors, credentials,
 * and stack traces are never leaked in client responses.
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Authentication domain errors (RegistrationValidationError -> 400, DuplicateEmailError -> 409, etc.)
  if (err instanceof AuthServiceError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(Array.isArray(err.details) ? { details: err.details as ApiErrorDetail[] } : {}),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(err.status).json(response);
    return;
  }

  // 2. Malformed JSON payload from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as { status: unknown }).status === 400) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload in request body.',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
    return;
  }

  // 3. Fallback for unexpected internal server errors (500)
  console.error('Unhandled server error:', err);

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected internal server error occurred.'
          : err.message || 'An unexpected internal server error occurred.',
    },
    timestamp: new Date().toISOString(),
  };

  res.status(500).json(response);
}

