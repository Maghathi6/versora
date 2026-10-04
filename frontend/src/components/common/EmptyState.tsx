import React from 'react';
import { Badge } from './Badge';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  phaseBadge?: string;
  actionText?: string;
  onAction?: () => void;
  technicalNote?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  phaseBadge,
  actionText,
  onAction,
  technicalNote,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '4rem 2rem',
        background: 'var(--bg-card)',
        border: '1px dashed var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: '720px',
        margin: '2rem auto',
      }}
    >
      {icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand-primary-light)',
            marginBottom: '1.25rem',
          }}
        >
          {icon}
        </div>
      )}

      {phaseBadge && (
        <div style={{ marginBottom: '1rem' }}>
          <Badge variant="brand">{phaseBadge}</Badge>
        </div>
      )}

      <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.65rem' }}>
        {title}
      </h3>

      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.95rem',
          lineHeight: 1.6,
          maxWidth: '520px',
          marginBottom: '1.5rem',
        }}
      >
        {description}
      </p>

      {technicalNote && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            maxWidth: '560px',
            marginBottom: '1.5rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Architectural Note:</span>{' '}
          {technicalNote}
        </div>
      )}

      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn btn-outline"
          style={{ fontSize: '0.88rem' }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
