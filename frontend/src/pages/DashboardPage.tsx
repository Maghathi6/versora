import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { HealthCard } from '../components/HealthCard';
import { Badge } from '../components/common/Badge';
import { useTerminology } from '../context/TerminologyContext';
import { IconProjects, IconReviews, IconActivity, IconArrowRight, IconSparkles } from '../components/common/Icons';

export const DashboardPage: React.FC = () => {
  const { t, mode } = useTerminology();

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Welcome to Versora. Explore workspaces, verify backend communication, and configure preferences."
        badge={<Badge variant="brand">Phase 1 Foundation</Badge>}
      />

      {/* Welcome & System Status Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-trace-light)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <IconSparkles size={16} />
              <span>Application Foundation Active</span>
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Currently in {mode === 'beginner' ? '🌱 Beginner Mode' : '⚡ Advanced Mode'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '640px', lineHeight: 1.5 }}>
              The application layout shell and routing are operational. Future modules will populate real repositories, Git operations, and impact graphs.
            </p>
          </div>
          <Link to="/settings" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
            Configure Preferences
          </Link>
        </div>
      </div>

      {/* Grid: Health Card & Navigation Modules */}
      <div className="dashboard-grid">
        {/* Left Column: Live Backend System Health Card */}
        <div className="col-span-6">
          <HealthCard />
        </div>

        {/* Right Column: Platform Navigation & Roadmap Modules */}
        <div className="col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <IconProjects size={18} />
                <span>{t('projects')}</span>
              </div>
              <Badge variant="neutral">Phase 4</Badge>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1rem' }}>
              Create and manage projects backed by native Git repositories on disk with automated workspace initialization.
            </p>
            <Link
              to="/projects"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--brand-primary-light)',
              }}
            >
              <span>Explore {t('projects')} Module</span>
              <IconArrowRight size={14} />
            </Link>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <IconReviews size={18} />
                <span>{t('reviews')}</span>
              </div>
              <Badge variant="neutral">Phase 8</Badge>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1rem' }}>
              Structured peer review workflows for proposed changes between workspaces, complete with visual diffs and line comments.
            </p>
            <Link
              to="/reviews"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--brand-primary-light)',
              }}
            >
              <span>Explore {t('reviews')} Module</span>
              <IconArrowRight size={14} />
            </Link>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <IconActivity size={18} />
                <span>Audit & Activity Stream</span>
              </div>
              <Badge variant="neutral">Phase 7</Badge>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1rem' }}>
              Real-time audit log of all project events, workspace changes, and collaborator updates.
            </p>
            <Link
              to="/activity"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--brand-primary-light)',
              }}
            >
              <span>Explore Activity Module</span>
              <IconArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
