import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconGitCommit,
  IconFileText,
  IconAlertCircle,
  IconCheck,
} from '../common/Icons';
import { GitStatusResponse, GitFileChange, GitDiffResponse, GitDiffFile } from '../../types/git';
import { gitService } from '../../services/gitService';
import { ApiError } from '../../services/apiClient';

interface GitChangesViewProps {
  projectId: string;
  status: GitStatusResponse | null;
  isLoadingStatus: boolean;
  onRefresh: () => void;
  onOpenCommitModal: () => void;
  onOpenFileInEditor?: (filePath: string) => void;
}

export const GitChangesView: React.FC<GitChangesViewProps> = ({
  projectId,
  status,
  isLoadingStatus,
  onRefresh,
  onOpenCommitModal,
  onOpenFileInEditor,
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<GitDiffResponse | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  // Combine changes
  const allChanges: GitFileChange[] = [
    ...(status?.staged || []),
    ...(status?.unstaged || []),
    ...(status?.untracked || []),
  ];

  const uniqueChanges = Array.from(
    new Map(allChanges.map((item) => [item.path, item])).values()
  );

  // Select first file by default
  useEffect(() => {
    if (uniqueChanges.length > 0 && !selectedFile) {
      setSelectedFile(uniqueChanges[0].path);
    } else if (uniqueChanges.length === 0) {
      setSelectedFile(null);
      setDiffData(null);
    }
  }, [uniqueChanges, selectedFile]);

  // Fetch diff when selected file changes
  useEffect(() => {
    if (!projectId || !selectedFile) {
      setDiffData(null);
      return;
    }

    let isCancelled = false;
    const fetchDiff = async () => {
      setIsLoadingDiff(true);
      setDiffError(null);
      try {
        const res = await gitService.getDiff(projectId, selectedFile);
        if (!isCancelled) {
          setDiffData(res);
        }
      } catch (err) {
        if (!isCancelled) {
          setDiffError(err instanceof ApiError ? err.message : 'Failed to load diff.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDiff(false);
        }
      }
    };

    fetchDiff();
    return () => {
      isCancelled = true;
    };
  }, [projectId, selectedFile]);

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

  const selectedFileChange = uniqueChanges.find((c) => c.path === selectedFile);
  const currentDiffFile: GitDiffFile | undefined = diffData?.files?.find((f) => f.path === selectedFile) || diffData?.files?.[0];

  if (!status || !status.isInitialized) {
    return (
      <div
        style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Git Version Control Not Initialized
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Initialize Git in this workspace to track changes and inspect diffs.
        </div>
      </div>
    );
  }

  if (uniqueChanges.length === 0) {
    return (
      <div
        style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          <IconCheck size={24} />
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 600 }}>
          No Unsaved Changes
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: 460, marginInline: 'auto' }}>
          Your working tree is completely clean and matches the latest saved version on branch <strong>{status.currentBranch || 'main'}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: '1.25rem',
        minHeight: 560,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Left panel: changed files list */}
      <div
        style={{
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Pending Changes</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {uniqueChanges.length} {uniqueChanges.length === 1 ? 'file' : 'files'} modified
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              isLoading={isLoadingStatus}
              title="Refresh status"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<IconGitCommit size={14} />}
              onClick={onOpenCommitModal}
            >
              Save Version
            </Button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {uniqueChanges.map((change) => {
            const isSelected = change.path === selectedFile;
            return (
              <div
                key={change.path}
                onClick={() => setSelectedFile(change.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.7rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <IconFileText
                    size={15}
                    style={{
                      color: isSelected ? 'var(--brand-primary-light)' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
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
            );
          })}
        </div>
      </div>

      {/* Right panel: Diff viewer */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Diff header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.92rem', fontFamily: 'monospace' }}>
              {selectedFile || 'Select a file to view changes'}
            </span>
            {selectedFileChange && getStatusBadge(selectedFileChange)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {onOpenFileInEditor && selectedFile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenFileInEditor(selectedFile)}
              >
                Open in Editor
              </Button>
            )}
            {currentDiffFile && !currentDiffFile.isBinary && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>
                  +{currentDiffFile.additions}
                </span>
                <span style={{ color: 'var(--status-danger)', fontWeight: 600 }}>
                  -{currentDiffFile.deletions}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Diff Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: 'var(--bg-primary)' }}>
          {isLoadingDiff ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Computing diff...
            </div>
          ) : diffError ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem',
                background: 'var(--status-danger-bg)',
                color: 'var(--status-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
              }}
            >
              <IconAlertCircle size={16} />
              <span>{diffError}</span>
            </div>
          ) : currentDiffFile?.isBinary ? (
            <div
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.4rem' }}>
                Binary File Modified
              </div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                This is a binary format (media, spreadsheet, document, or archive). Textual diffs cannot be rendered.
              </div>
            </div>
          ) : currentDiffFile?.diff ? (
            <pre
              style={{
                margin: 0,
                fontFamily: 'monospace',
                fontSize: '0.84rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {currentDiffFile.diff.split('\n').map((line, idx) => {
                const isAdd = line.startsWith('+') && !line.startsWith('+++');
                const isDel = line.startsWith('-') && !line.startsWith('---');
                const isHdr = line.startsWith('@@') || line.startsWith('diff --git');

                const bg = isAdd
                  ? 'rgba(34, 197, 94, 0.12)'
                  : isDel
                  ? 'rgba(239, 68, 68, 0.12)'
                  : isHdr
                  ? 'rgba(99, 102, 241, 0.08)'
                  : 'transparent';

                const color = isAdd
                  ? '#4ade80'
                  : isDel
                  ? '#f87171'
                  : isHdr
                  ? '#818cf8'
                  : 'var(--text-secondary)';

                return (
                  <div
                    key={idx}
                    style={{
                      background: bg,
                      color,
                      padding: '0.05rem 0.5rem',
                      borderRadius: 2,
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </pre>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No textual changes to display for this file.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
