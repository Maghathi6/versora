import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconRotateCcw,
  IconClose,
  IconAlertCircle,
  IconShield,
  IconFileText,
} from '../common/Icons';
import { GitCommitItem, GitRestorePreviewResponse } from '../../types/git';
import { gitService } from '../../services/gitService';
import { ApiError } from '../../services/apiClient';

interface GitRestoreModalProps {
  isOpen: boolean;
  projectId: string;
  commit: GitCommitItem | null;
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (commitHash: string, mode: 'file' | 'project', filePath?: string) => Promise<void>;
}

export const GitRestoreModal: React.FC<GitRestoreModalProps> = ({
  isOpen,
  projectId,
  commit,
  isLoading,
  errorMessage,
  onClose,
  onConfirm,
}) => {
  const [preview, setPreview] = useState<GitRestorePreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>(''); // empty string = whole project
  const [confirmed, setConfirmed] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && commit) {
      setSelectedFilePath('');
      setConfirmed(false);
      let isCancelled = false;

      const fetchPreview = async () => {
        setIsLoadingPreview(true);
        setPreviewError(null);
        try {
          const res = await gitService.previewRestore(projectId, commit.hash);
          if (!isCancelled) {
            setPreview(res);
          }
        } catch (err) {
          if (!isCancelled) {
            setPreviewError(err instanceof ApiError ? err.message : 'Failed to preview changes.');
          }
        } finally {
          if (!isCancelled) {
            setIsLoadingPreview(false);
          }
        }
      };

      fetchPreview();
      return () => {
        isCancelled = true;
      };
    } else {
      setPreview(null);
    }
  }, [isOpen, projectId, commit]);

  if (!isOpen || !commit) return null;

  const handleExecuteRestore = async () => {
    if (selectedFilePath.trim()) {
      await onConfirm(commit.hash, 'file', selectedFilePath.trim());
    } else {
      await onConfirm(commit.hash, 'project');
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
          maxWidth: 540,
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
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--status-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconRotateCcw size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Restore Earlier Version
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target: commit <span style={{ fontFamily: 'monospace' }}>{commit.shortHash}</span>
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

        {/* Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Error Banner */}
          {(errorMessage || previewError) && (
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
              <span>{errorMessage || previewError}</span>
            </div>
          )}

          {/* Target Commit Summary Card */}
          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {commit.message}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Created by {commit.author.name} on {new Date(commit.timestamp).toLocaleString()}
            </div>
          </div>

          {/* Safety Backup Guarantee */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              padding: '0.85rem 1rem',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            <IconShield size={18} style={{ color: 'var(--status-success)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong style={{ color: 'var(--status-success)' }}>Safe Reversible Rollback:</strong> Versora will automatically create a safety backup tag (e.g. <code>backup-restore-...</code>) preserving your current state before any files are modified.
            </div>
          </div>

          {/* Uncommitted changes warning */}
          {preview?.hasUncommittedChanges && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--status-danger)',
                fontSize: '0.84rem',
              }}
            >
              <IconAlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Warning:</strong> You have uncommitted changes in your workspace. You must save a version or discard those changes before restoring.
              </div>
            </div>
          )}

          {/* Files to change preview */}
          {isLoadingPreview ? (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Checking affected files...
            </div>
          ) : preview && preview.filesToChange.length > 0 ? (
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Files Affected ({preview.filesToChange.length})
              </div>
              <div
                style={{
                  maxHeight: 140,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                }}
              >
                {preview.filesToChange.map((f) => (
                  <div
                    key={f.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.45rem 0.75rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' }}>
                      <IconFileText size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{f.path}</span>
                    </div>
                    <Badge variant={f.action === 'create' ? 'success' : f.action === 'delete' ? 'danger' : 'brand'}>
                      {f.action}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* User Confirmation Checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.86rem',
              cursor: 'pointer',
              userSelect: 'none',
              marginTop: '0.25rem',
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={isLoading || preview?.hasUncommittedChanges}
            />
            <span>I understand that this will restore project files to this version snapshot.</span>
          </label>
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
            variant="danger"
            size="sm"
            onClick={handleExecuteRestore}
            isLoading={isLoading}
            disabled={!confirmed || preview?.hasUncommittedChanges}
            icon={<IconRotateCcw size={14} />}
          >
            Restore Version
          </Button>
        </div>
      </div>
    </div>
  );
};
