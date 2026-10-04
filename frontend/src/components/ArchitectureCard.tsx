import React from 'react';

export const ArchitectureCard: React.FC = () => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🏛️</span>
          <span>System Architecture & Boundaries</span>
        </div>
        <span className="badge badge-info">Modular Monolith</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ color: 'var(--brand-primary-light)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
            1. Authentic Git Engine
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Real version control for text and code. Handles commit trees, diffs, and branch pointers. Never simulated.
          </p>
        </div>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ color: 'var(--brand-trace-light)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
            2. PostgreSQL & Drizzle
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Relational and graph metadata. Stores artifact relationship graph edges, review threads, and RBAC permissions.
          </p>
        </div>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
            3. Object Storage (R2/S3)
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Dedicated high-bandwidth store for large binary datasets, model checkpoints, and generated media without Git bloat.
          </p>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Current Implementation Scope
          </span>
          <span className="badge badge-success">Phase 0 Complete</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <span className="badge badge-brand">✅ Express + TypeScript API</span>
          <span className="badge badge-brand">✅ Vite + React + TanStack Query</span>
          <span className="badge badge-brand">✅ Zod Environment Validation</span>
          <span className="badge badge-brand">✅ Real Health Endpoint</span>
          <span className="badge badge-brand">✅ Design System Tokens</span>
          <span className="badge badge-brand">✅ Comprehensive PRD & Architecture Docs</span>
        </div>
      </div>
    </div>
  );
};
