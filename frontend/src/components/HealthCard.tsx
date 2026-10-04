import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { healthService } from '../services/apiClient';
import { HealthCheckData } from '../types/api';
import { formatUptime, formatDate } from '../utils';

interface FetchHealthResult {
  data: HealthCheckData;
  latencyMs: number;
}

export const HealthCard: React.FC = () => {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const {
    data: healthResult,
    error,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<FetchHealthResult, Error>({
    queryKey: ['systemHealth'],
    queryFn: () => healthService.getHealth(),
    refetchInterval: 10000, // automatically poll every 10s
    retry: 2,
  });

  const handleManualRefetch = async () => {
    await refetch();
    setLastRefreshedAt(new Date());
  };

  const isHealthy = healthResult?.data.status === 'healthy';

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🩺</span>
          <span>Backend System Health</span>
        </div>
        <div>
          {isLoading ? (
            <span className="badge badge-brand">Connecting...</span>
          ) : isHealthy ? (
            <span className="badge badge-success">
              <span className="health-dot healthy" style={{ width: 6, height: 6 }} />
              Healthy
            </span>
          ) : (
            <span className="badge badge-danger">
              <span className="health-dot error" style={{ width: 6, height: 6 }} />
              Offline / Error
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {error ? (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--status-danger-bg)',
              border: '1px solid var(--status-danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-danger)',
              fontSize: '0.9rem',
              marginBottom: '1rem',
            }}
          >
            <strong>Failed to connect to Versora API:</strong>
            <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>{error.message}</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Make sure the backend is running on <code>http://localhost:4000</code>.
            </p>
          </div>
        ) : healthResult ? (
          <div>
            <div className="metric-row">
              <span className="metric-label">Service Name</span>
              <span className="metric-value font-mono">{healthResult.data.service}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">API Version</span>
              <span className="metric-value font-mono">v{healthResult.data.version}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Environment</span>
              <span className="badge badge-brand font-mono" style={{ textTransform: 'lowercase' }}>
                {healthResult.data.environment}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Server Uptime</span>
              <span className="metric-value font-mono">
                {formatUptime(healthResult.data.uptimeSeconds)} ({healthResult.data.uptimeSeconds}s)
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Round-Trip Latency</span>
              <span className="metric-value font-mono" style={{ color: 'var(--status-success)' }}>
                {healthResult.latencyMs} ms
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Server Timestamp</span>
              <span className="metric-value font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {formatDate(healthResult.data.timestamp)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Last checked: {lastRefreshedAt.toLocaleTimeString()}
        </span>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleManualRefetch}
          disabled={isLoading || isRefetching}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          {isRefetching ? 'Testing...' : '🔄 Test Connection'}
        </button>
      </div>
    </div>
  );
};
