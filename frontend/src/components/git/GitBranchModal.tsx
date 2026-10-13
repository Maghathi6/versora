import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconGitBranch,
  IconClose,
  IconPlus,
  IconAlertCircle,
} from '../common/Icons';
import { GitBranchItem, GitStatusResponse } from '../../types/git';

interface GitBranchModalProps {
  isOpen: boolean;
  status: GitStatusResponse | null;
  branches: GitBranchItem[];
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSwitchBranch: (branchName: string) => Promise<void>;
  onCreateBranch: (branchName: string) => Promise<void>;
}

export const GitBranchModal: React.FC<GitBranchModalProps> = ({
  isOpen,
  status,
  branches,
  isLoading,
  errorMessage,
  onClose,
  onSwitchBranch,
  onCreateBranch,
}) => {
  const [newBranchName, setNewBranchName] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setNewBranchName('');
      setValidationError(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasUncommittedChanges = (status?.totalChangesCount || 0) > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBranchName.trim();
    if (!clean) {
      setValidationError('Please enter a branch name.');
      return;
    }
    if (clean.startsWith('-') || clean.startsWith('.') || clean.endsWith('.')) {
      setValidationError('Branch name cannot start with a hyphen or start/end with a dot.');
      return;
    }
    if (branches.some((b) => b.name === clean)) {
      setValidationError(`Branch '${clean}' already exists.`);
      return;
    }

    setValidationError(null);
    setIsCreating(true);
    try {
      await onCreateBranch(clean);
      setNewBranchName('');
    } finally {
      setIsCreating(false);
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
          maxWidth: 520,
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
              <IconGitBranch size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              Branch Management
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading || isCreating}
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

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Error Banner */}
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

          {/* Uncommitted changes caution */}
          {hasUncommittedChanges && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.8rem 1rem',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--status-warning)',
                fontSize: '0.84rem',
                lineHeight: 1.4,
              }}
            >
              <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Unsaved changes detected.</strong> You must save a version or discard your pending changes before switching to another branch to prevent losing your work.
              </div>
            </div>
          )}

          {/* Create Branch Form */}
          <form onSubmit={handleCreate}>
            <label
              htmlFor="new-branch-name"
              style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.86rem', fontWeight: 600 }}
            >
              Create New Branch
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="new-branch-name"
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="e.g. feature/new-dataset or bugfix/typo"
                disabled={isLoading || isCreating}
                style={{
                  flex: 1,
                  padding: '0.55rem 0.75rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                }}
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={<IconPlus size={14} />}
                isLoading={isCreating}
                disabled={!newBranchName.trim()}
              >
                Create
              </Button>
            </div>
          </form>

          {/* Existing Branches List */}
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Existing Branches ({branches.length})
            </div>
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)',
              }}
            >
              {branches.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No branches found.
                </div>
              ) : (
                branches.map((b) => (
                  <div
                    key={b.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: b.isCurrent ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <IconGitBranch
                        size={15}
                        style={{ color: b.isCurrent ? 'var(--brand-primary-light)' : 'var(--text-muted)' }}
                      />
                      <span
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: b.isCurrent ? 700 : 500,
                          color: b.isCurrent ? 'var(--brand-primary-light)' : 'var(--text-primary)',
                        }}
                      >
                        {b.name}
                      </span>
                      {b.isCurrent && <Badge variant="brand">Current Branch</Badge>}
                    </div>

                    {!b.isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSwitchBranch(b.name)}
                        isLoading={isLoading}
                        disabled={hasUncommittedChanges}
                        title={
                          hasUncommittedChanges
                            ? 'Cannot switch branches with uncommitted changes'
                            : `Switch to ${b.name}`
                        }
                      >
                        Switch
                      </Button>
                    )}
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
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading || isCreating}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
