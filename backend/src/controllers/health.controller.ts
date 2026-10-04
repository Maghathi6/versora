import { Request, Response } from 'express';
import { ApiSuccessResponse, HealthCheckData } from '../types/api';
import { env } from '../config/env';

/**
 * Controller to check backend service health and runtime metrics.
 */
export function getHealth(_req: Request, res: Response): void {
  const healthData: HealthCheckData = {
    status: 'healthy',
    service: 'versora-api',
    version: '0.1.0',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime() * 100) / 100,
    timestamp: new Date().toISOString(),
  };

  const response: ApiSuccessResponse<HealthCheckData> = {
    success: true,
    data: healthData,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
}
