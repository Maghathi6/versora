import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconGitCommit,
  IconClose,
  IconAlertCircle,
  IconFileText,
} from '../common/Icons';
import { GitStatusResponse, GitFileChange } from '../../types/git';

interface GitCommitModalProps {
  isOpen: boolean;
  status: GitStatusResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

export const GitCommitModal: React.FC<GitCommitModalProps> = ({
  isOpen,
  status,
  isLoading,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [message, setMessage] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allChanges: GitFileChange[] = [
    ...(status?.staged || []),
    ...(status?.unstaged || []),
    ...(status?.untracked || []),
  ];

  // Remove duplicate paths from combined list
  const uniqueChanges = Array.from(
    new Map(allChanges.map((item) => [item.path, item])).values()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMsg = message.trim();
    if (!cleanMsg) {
      setValidationError('Please enter a meaningful version message explaining your changes.');
      return;
    }
    setValidationError(null);
    await onSubmit(cleanMsg);
  };

  const getStatusBadge = (change: GitFileChange) => {
    switch (change.status) {
      case 'added':
      case 'untracked':
        return <Badge variant="success">New</Badge>;
      case 'modified':
        return <Badge variant="brand">Modified</Badge>;
      case 'deleted':
        return <Badge variant="danger">Deleted</Badge>;
      case 'renamed':
        return <Badge variant="neutral">Renamed</Badge>;
      default:
        return <Badge variant="neutral">{change.status}</Badge>;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--brand-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconGitCommit size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Save Version (Git Commit)
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Branch: <strong>{status?.currentBranch || 'main'}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <IconClose size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Error alerts */}
            {(errorMessage || validationError) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-danger)',
                  fontSize: '0.86rem',
                }}
              >
                <IconAlertCircle size={16} />
                <span>{errorMessage || validationError}</span>
              </div>
            )}

            {/* Commit message input */}
            <div>
              <label
                htmlFor="commit-message-input"
                style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}
              >
                Version Message <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <textarea
                id="commit-message-input"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Add user authentication module and update documentation..."
                disabled={isLoading}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                A clear description helps you and your team trace what changed in this version snapshot.
              </div>
            </div>

            {/* Changed files review */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                  Files Included in this Version ({uniqueChanges.length})
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  All saved files are automatically staged
                </span>
              </div>

              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                }}
              >
                {uniqueChanges.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No pending file changes detected.
                  </div>
                ) : (
                  uniqueChanges.map((change) => (
                    <div
                      key={change.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.84rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                        <IconFileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span
                          style={{
                            fontFamily: 'monospace',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {change.path}
                        </span>
                      </div>
                      <div>{getStatusBadge(change)}</div>
                    </div>
                  ))
                )}
              </div>
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
              background: 'var(--bg-secondary)',
            }}
          >
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={<IconGitCommit size={14} />}
              isLoading={isLoading}
              disabled={uniqueChanges.length === 0}
            >
              Save Version
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
