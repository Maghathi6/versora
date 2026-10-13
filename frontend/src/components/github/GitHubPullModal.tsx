import React from 'react';
import {
  IconDownloadCloud,
  IconClose,
  IconAlertCircle,
  IconGitCommit,
} from '../common/Icons';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { GitHubRemoteStatusResponse } from '../../types/github';

interface GitHubPullModalProps {
  isOpen: boolean;
  status: GitHubRemoteStatusResponse | null;
  isPulling: boolean;
  error: string | null;
  onClose: () => void;
  onPull: () => Promise<void>;
}

export const GitHubPullModal: React.FC<GitHubPullModalProps> = ({
  isOpen,
  status,
  isPulling,
  error,
  onClose,
  onPull,
}) => {
  if (!isOpen) return null;

  const incomingCommits = status?.incomingCommits || [];
  const remote = status?.remote;
  const isDiverged = status?.isDiverged || false;
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
            <IconDownloadCloud size={22} style={{ color: 'var(--brand-primary-light)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Synchronize Incoming Changes
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Source: {remote ? `${remote.owner}/${remote.repo}` : 'origin'} ({status?.remoteBranch || 'origin/main'})
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            disabled={isPulling}
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

          {isDiverged && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--status-danger)',
                fontSize: '0.85rem',
                lineHeight: 1.45,
              }}
            >
              <IconAlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Diverged Branches Detected ({status?.ahead} ahead, {status?.behind} behind).</strong>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                  Both your local branch and GitHub have new commits that have diverged. To protect your work against silent overwrites, Versora requires manual review or a rebase before pulling.
                </p>
              </div>
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
                <strong>Unsaved modifications in workspace.</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                  Pulling changes will update the local working tree. Please save or discard your current file changes before pulling to prevent accidental data loss.
                </p>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Incoming Commits ({status?.behind || incomingCommits.length})
              </span>
              <Badge variant="warning">{status?.remoteBranch || 'origin/main'}</Badge>
            </div>

            {incomingCommits.length > 0 ? (
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
                {incomingCommits.map((c) => (
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
                {status?.behind === 0
                  ? 'Your local repository is already synchronized with GitHub.'
                  : 'Fetching latest incoming commits from GitHub...'}
              </div>
            )}
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--brand-primary-light)', marginBottom: '0.25rem' }}>
              Automatic File Reconciliation
            </div>
            After pulling, Versora updates local files, reconciles database artifacts, and reloads the Monaco editor and file explorer so incoming remote files appear immediately.
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
          <Button variant="ghost" onClick={onClose} disabled={isPulling}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<IconDownloadCloud size={16} />}
            onClick={onPull}
            disabled={isPulling || isDiverged || hasUncommitted}
          >
            {isPulling ? 'Pulling & Reconciling...' : `Confirm & Pull ${status?.behind || 0} Commit(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
};
