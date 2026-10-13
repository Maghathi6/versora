import React from 'react';
import { IconGitHub, IconClose, IconTrash, IconCheck, IconAlertCircle } from '../common/Icons';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { GitHubAccountPublic } from '../../types/github';

interface GitHubAccountModalProps {
  isOpen: boolean;
  account: GitHubAccountPublic | null;
  isDisconnecting: boolean;
  error: string | null;
  onClose: () => void;
  onDisconnect: () => Promise<void>;
}

export const GitHubAccountModal: React.FC<GitHubAccountModalProps> = ({
  isOpen,
  account,
  isDisconnecting,
  error,
  onClose,
  onDisconnect,
}) => {
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

  if (!isOpen || !account) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <IconGitHub size={22} style={{ color: 'var(--brand-primary-light)' }} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Connected GitHub Account
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            disabled={isDisconnecting}
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--status-danger)',
                fontSize: '0.85rem',
              }}
            >
              <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Profile Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
            }}
          >
            {account.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt={account.username}
                style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#24292f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconGitHub size={24} style={{ color: '#fff' }} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                @{account.username}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <Badge variant="success">
                  <IconCheck size={11} style={{ marginRight: 3 }} />
                  OAuth Connected
                </Badge>
                {account.scope && (
                  <Badge variant="neutral">Scope: {account.scope}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Security Information */}
          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: '1.25rem',
            }}
          >
            <strong style={{ color: 'var(--status-healthy)', display: 'block', marginBottom: '0.2rem' }}>
              Zero Token Exposure Architecture
            </strong>
            Your GitHub credentials are encrypted at rest with AES-256-GCM on the Versora backend and never transmitted to your browser, stored in localStorage, or embedded in repository configs.
          </div>

          {/* Disconnect confirmation toggle */}
          {confirmDisconnect ? (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--status-danger)', marginBottom: '0.35rem' }}>
                Disconnect GitHub Account?
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                This will delete your stored GitHub OAuth credentials from the server. Your local files and Git history will remain intact.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDisconnect(false)}
                  disabled={isDisconnecting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                  style={{ background: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              icon={<IconTrash size={14} />}
              onClick={() => setConfirmDisconnect(true)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Disconnect GitHub Account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
