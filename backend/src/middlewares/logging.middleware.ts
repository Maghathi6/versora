import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 500 ? '🔥' : statusCode >= 400 ? '⚠️' : '✅';
    console.log(
      `${statusEmoji} [${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${statusCode} - ${duration}ms`
    );
  });

  next();
}
