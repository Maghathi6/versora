import React from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconGitBranch,
  IconGitCommit,
  IconHistory,
  IconSparkles,
} from '../common/Icons';
import { GitStatusResponse } from '../../types/git';

interface GitStatusBarProps {
  status: GitStatusResponse | null;
  isLoading: boolean;
  onInitClick: () => void;
  onBranchClick: () => void;
  onSaveVersionClick: () => void;
  onViewChangesClick: () => void;
  onViewHistoryClick: () => void;
}

export const GitStatusBar: React.FC<GitStatusBarProps> = ({
  status,
  isLoading,
  onInitClick,
  onBranchClick,
  onSaveVersionClick,
  onViewChangesClick,
  onViewHistoryClick,
}) => {
  if (isLoading && !status) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          fontSize: '0.88rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="health-dot healthy" style={{ width: 8, height: 8 }} />
          <span>Checking repository status...</span>
        </div>
      </div>
    );
  }

  // State 1: Git repository not initialized yet
  if (!status || !status.isInitialized) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              Real Git Version Control
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Enable version history, branches, change tracking, and safe rollbacks for this project.
            </div>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<IconSparkles size={14} />}
          onClick={onInitClick}
        >
          Initialize Repository
        </Button>
      </div>
    );
  }

  // State 2: Git repository active
  const hasChanges = status.totalChangesCount > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.65rem 1.25rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '1.25rem',
      }}
    >
      {/* Left: Branch and Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onBranchClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.75rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.86rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          title="Switch or create branches"
        >
          <IconGitBranch size={15} style={{ color: 'var(--brand-primary-light)' }} />
          <span>{status.currentBranch || 'main'}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>▼</span>
        </button>

        {hasChanges ? (
          <button
            type="button"
            onClick={onViewChangesClick}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <Badge variant="warning">
              ● {status.totalChangesCount} Unsaved {status.totalChangesCount === 1 ? 'Change' : 'Changes'}
            </Badge>
          </button>
        ) : (
          <Badge variant="success">
            ✓ Workspace Clean
          </Badge>
        )}

        {status.headCommitHash ? (
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}
            title={`Current commit: ${status.headCommitHash}`}
          >
            commit {status.headCommitHash.slice(0, 7)}
          </span>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No commits yet
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {hasChanges && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewChangesClick}
          >
            Review Changes
          </Button>
        )}

        <Button
          variant="primary"
          size="sm"
          icon={<IconGitCommit size={14} />}
          onClick={onSaveVersionClick}
          disabled={!hasChanges}
          title={!hasChanges ? 'Workspace is clean. Make edits to save a version.' : 'Commit current changes'}
        >
          Save Version
        </Button>

        <Button
          variant="ghost"
          size="sm"
          icon={<IconHistory size={15} />}
          onClick={onViewHistoryClick}
          title="Inspect version history and commits"
        >
          History
        </Button>
      </div>
    </div>
  );
};
