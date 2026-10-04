import React from 'react';
import { Link } from 'react-router-dom';
import { IconAlertCircle } from '../components/common/Icons';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '3rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--status-danger)',
            marginBottom: '1.5rem',
          }}
        >
          <IconAlertCircle size={32} />
        </div>

        <span className="badge badge-danger" style={{ marginBottom: '1rem' }}>
          404 &bull; Page Not Found
        </span>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Destination Not Found
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          The path you requested does not exist or may have been moved in a project version update.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/dashboard" className="btn btn-primary">
            Go to Dashboard
          </Link>
          <Link to="/" className="btn btn-outline">
            Return to Landing Page
          </Link>
        </div>
      </div>
    </div>
  );
};
