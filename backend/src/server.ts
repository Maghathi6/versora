import express, { Application } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requestLogger } from './middlewares/logging.middleware';
import { notFoundHandler, globalErrorHandler } from './middlewares/error.middleware';
import apiRoutes from './routes';

export function createServer(): Application {
  const app = express();

  // Basic Security & Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body Parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request Logging
  app.use(requestLogger);

  // Mount API Router
  app.use('/api', apiRoutes);

  // 404 Handler
  app.use(notFoundHandler);

  // Global Error Handler
  app.use(globalErrorHandler);

  return app;
}
