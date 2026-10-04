import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { TerminologyPreview } from '../components/TerminologyPreview';
import { Badge } from '../components/common/Badge';
import { useTerminology } from '../context/TerminologyContext';

export const SettingsPage: React.FC = () => {
  const { mode, setMode } = useTerminology();

  return (
    <div>
      <PageHeader
        title="Settings & Preferences"
        subtitle="Manage your interface terminology, application diagnostics, and system configuration."
        badge={<Badge variant="brand">Active Preferences</Badge>}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '880px' }}>
        {/* Working Global Preference: Terminology Mode */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>🌐</span>
              <span>Global Interface Terminology Mode</span>
            </div>
            <Badge variant="success">Persisted in LocalStorage</Badge>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Choose how Versora presents version control concepts throughout the entire application. Your preference is saved locally and will remain active across sessions.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div
              onClick={() => setMode('beginner')}
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${mode === 'beginner' ? 'var(--brand-trace)' : 'var(--border-subtle)'}`,
                background: mode === 'beginner' ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-trace-light)', fontSize: '1rem' }}>
                  🌱 Beginner Mode
                </span>
                {mode === 'beginner' && <Badge variant="info">Selected</Badge>}
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Uses plain-English, approachable concepts: <em>Projects</em>, <em>Workspaces</em>, <em>Save Changes</em>, and <em>Change Requests</em>. Eliminates Git command anxiety.
              </p>
            </div>

            <div
              onClick={() => setMode('advanced')}
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${mode === 'advanced' ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                background: mode === 'advanced' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-primary-light)', fontSize: '1rem' }}>
                  ⚡ Advanced Mode
                </span>
                {mode === 'advanced' && <Badge variant="brand">Selected</Badge>}
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Displays explicit Git terminology: <em>Repositories</em>, <em>Branches</em>, <em>Commits</em>, <em>Pull Requests</em>, and commit hashes. Ideal for experienced engineers.
              </p>
            </div>
          </div>

          {/* Terminology Comparison Table */}
          <TerminologyPreview viewMode={mode} />
        </div>

        {/* System & API Diagnostics */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>🔧</span>
              <span>API Diagnostics & Environment</span>
            </div>
            <Badge variant="brand">Phase 1 Foundation</Badge>
          </div>

          <div className="metric-row">
            <span className="metric-label">Frontend API Base URL</span>
            <span className="metric-value font-mono">
              {import.meta.env.VITE_API_BASE_URL || '/api'}
            </span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Backend Target Port</span>
            <span className="metric-value font-mono">4000 (Express REST API)</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Storage Architecture</span>
            <span className="metric-value font-mono">Tri-Store (PostgreSQL + Git Engine + S3/R2)</span>
          </div>
        </div>

        {/* Planned Integrations (Clear placeholders) */}
        <div className="card" style={{ opacity: 0.75 }}>
          <div className="card-header">
            <div className="card-title">
              <span>🔌</span>
              <span>External Integrations</span>
            </div>
            <Badge variant="neutral">Scheduled for Phase 15</Badge>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Optional GitHub synchronization and OAuth token management will be configured here in Phase 15. Versora functions independently without requiring an external GitHub account.
          </p>
        </div>
      </div>
    </div>
  );
};
