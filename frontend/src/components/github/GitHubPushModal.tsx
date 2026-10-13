import React from 'react';
import {
  IconUploadCloud,
  IconClose,
  IconAlertCircle,
  IconGitCommit,
} from '../common/Icons';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { GitHubRemoteStatusResponse } from '../../types/github';

interface GitHubPushModalProps {
  isOpen: boolean;
  status: GitHubRemoteStatusResponse | null;
  isPushing: boolean;
  error: string | null;
  onClose: () => void;
  onPush: () => Promise<void>;
}

export const GitHubPushModal: React.FC<GitHubPushModalProps> = ({
  isOpen,
  status,
  isPushing,
  error,
  onClose,
  onPush,
}) => {
  if (!isOpen) return null;

  const outgoingCommits = status?.outgoingCommits || [];
  const remote = status?.remote;
  const hasUncommitted = status?.hasUncommittedChanges || false;

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
          maxWidth: '560px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
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
            <IconUploadCloud size={22} style={{ color: 'var(--brand-primary-light)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Push Commits to GitHub
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Destination: {remote ? `${remote.owner}/${remote.repo}` : 'origin'} ({status?.localBranch || 'main'})
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            disabled={isPushing}
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
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

          {hasUncommitted && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--status-warning)',
                fontSize: '0.85rem',
                lineHeight: 1.45,
              }}
            >
              <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Uncommitted modifications detected.</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                  Git only pushes committed versions. To include your recent file edits in this push, click &ldquo;Save Version&rdquo; in the Changes tab first.
                </p>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Outgoing Commits ({status?.ahead || outgoingCommits.length})
              </span>
              <Badge variant="brand">Branch: {status?.localBranch || 'main'}</Badge>
            </div>

            {outgoingCommits.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem',
                  background: 'var(--bg-app)',
                }}
              >
                {outgoingCommits.map((c) => (
                  <div
                    key={c.hash}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', minWidth: 0 }}>
                      <IconGitCommit size={15} style={{ color: 'var(--brand-primary-light)', marginTop: 2, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.message}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {c.authorName} • {new Date(c.date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <code style={{ fontSize: '0.75rem', color: 'var(--brand-trace-light)', flexShrink: 0 }}>
                      {c.shortHash}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                }}
              >
                No unpushed outgoing commits detected. Your local branch is already up to date with origin.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-elevated)',
          }}
        >
          <Button variant="ghost" onClick={onClose} disabled={isPushing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<IconUploadCloud size={16} />}
            onClick={onPush}
            disabled={isPushing || (status?.ahead === 0 && outgoingCommits.length === 0)}
          >
            {isPushing ? 'Pushing Commits...' : `Push ${status?.ahead || 1} Commit(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
};
