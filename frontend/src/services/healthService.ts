import { ApiSuccessResponse, HealthCheckData } from '../types/api';
import { apiClient, ApiError } from './apiClient';

export interface HealthCheckResult {
  data: HealthCheckData;
  latencyMs: number;
}

/**
 * Service for checking backend API operational status and latency.
 */
export const healthService = {
  /**
   * Fetches real-time server health and measures round-trip network latency.
   */
  async getHealth(): Promise<HealthCheckResult> {
    const start = performance.now();
    const result = await apiClient.get<ApiSuccessResponse<HealthCheckData>>('/health');
    const latencyMs = Math.round(performance.now() - start);

    if (!result.success || !result.data) {
      throw new ApiError('Invalid health payload format returned by API', 'MALFORMED_DATA');
    }

    return {
      data: result.data,
      latencyMs,
    };
  },

  /**
   * Quick boolean liveness check for UI indicator dots.
   */
  async checkBackendLive(): Promise<boolean> {
    try {
      const { data } = await this.getHealth();
      return data.status === 'healthy';
    } catch {
      return false;
    }
  },
};
