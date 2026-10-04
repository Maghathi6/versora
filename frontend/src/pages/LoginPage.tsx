import React from 'react';
import { Link } from 'react-router-dom';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { PublicFooter } from '../components/layout/PublicFooter';
import { Badge } from '../components/common/Badge';

export const LoginPage: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNavbar />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div
          className="card"
          style={{
            maxWidth: '460px',
            width: '100%',
            padding: '2.5rem',
            textAlign: 'center',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <Badge variant="brand">Scheduled for Phase 2: Authentication</Badge>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.65rem' }}>
            Sign In to Versora
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '2rem' }}>
            User authentication, password hashing, and session tokens will be implemented in Phase 2.
          </p>

          <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Email Address
              </label>
              <input
                type="email"
                disabled
                placeholder="alex.researcher@institution.org"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Password
              </label>
              <input
                type="password"
                disabled
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            <div
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                fontSize: '0.82rem',
                color: 'var(--brand-primary-light)',
                marginTop: '0.5rem',
              }}
            >
              🔒 <strong>Authentication Preview:</strong> Sign-in functionality is intentionally not activated in Phase 1. You can access the application shell directly via the button below.
            </div>

            <Link
              to="/dashboard"
              className="btn btn-primary"
              style={{ marginTop: '0.5rem', width: '100%', textAlign: 'center' }}
            >
              Continue to Dashboard (Guest Mode)
            </Link>
          </form>

          <div style={{ marginTop: '1.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: 'var(--brand-primary-light)', fontWeight: 600 }}>
              Create an account
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};
