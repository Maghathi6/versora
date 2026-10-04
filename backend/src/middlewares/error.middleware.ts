import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types/api';

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
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
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
