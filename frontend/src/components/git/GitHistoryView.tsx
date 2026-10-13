import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconHistory,
  IconFileText,
  IconRotateCcw,
  IconAlertCircle,
} from '../common/Icons';
import { GitCommitItem, GitCommitDetail } from '../../types/git';
import { gitService } from '../../services/gitService';
import { ApiError } from '../../services/apiClient';

interface GitHistoryViewProps {
  projectId: string;
  onRestoreCommit: (commit: GitCommitItem) => void;
}

export const GitHistoryView: React.FC<GitHistoryViewProps> = ({
  projectId,
  onRestoreCommit,
}) => {
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitItem | null>(null);
  const [commitDetail, setCommitDetail] = useState<GitCommitDetail | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch commits on mount
  useEffect(() => {
    let isCancelled = false;
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      setErrorMessage(null);
      try {
        const list = await gitService.getHistory(projectId);
        if (!isCancelled) {
          setCommits(list);
          if (list.length > 0) {
            setSelectedCommit(list[0]);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMessage(err instanceof ApiError ? err.message : 'Failed to load commit history.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    fetchHistory();
    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  // Fetch detail when selected commit changes
  useEffect(() => {
    if (!projectId || !selectedCommit) {
      setCommitDetail(null);
      return;
    }

    let isCancelled = false;
    const fetchDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const detail = await gitService.getCommit(projectId, selectedCommit.hash);
        if (!isCancelled) {
          setCommitDetail(detail);
        }
      } catch {
        if (!isCancelled) {
          setCommitDetail(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDetail(false);
        }
      }
    };

    fetchDetail();
    return () => {
      isCancelled = true;
    };
  }, [projectId, selectedCommit]);

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  if (isLoadingHistory) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
        }}
      >
        Loading version history...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--status-danger-bg)',
          color: 'var(--status-danger)',
          border: '1px solid var(--status-danger-border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
        }}
      >
        <IconAlertCircle size={20} />
        <span>{errorMessage}</span>
      </div>
    );
  }

  if (commits.length === 0) {
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
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--brand-primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          <IconHistory size={24} />
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 600 }}>
          No Version History Yet
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: 440, marginInline: 'auto' }}>
          This repository has no recorded commits. Make changes and click <strong>Save Version</strong> to create your first version snapshot.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gap: '1.25rem',
        minHeight: 560,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Left Column: Commits Timeline */}
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
            padding: '1rem',
            borderBottom: '1px solid var(--border-subtle)',
            fontWeight: 600,
            fontSize: '0.92rem',
          }}
        >
          Version History ({commits.length})
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {commits.map((c) => {
            const isSelected = selectedCommit?.hash === c.hash;
            return (
              <div
                key={c.hash}
                onClick={() => setSelectedCommit(c)}
                style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: isSelected ? 'var(--brand-primary-light)' : 'var(--text-muted)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '0.1rem 0.35rem',
                      borderRadius: 4,
                    }}
                  >
                    {c.shortHash}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatDate(c.timestamp)}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    marginBottom: '0.25rem',
                    lineHeight: 1.3,
                  }}
                >
                  {c.message}
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  by {c.author.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Commit Details and Diff */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedCommit ? (
          <>
            {/* Commit Header Card */}
            <div
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 600 }}>
                    {selectedCommit.message}
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Author: <strong style={{ color: 'var(--text-secondary)' }}>{selectedCommit.author.name}</strong> ({selectedCommit.author.email}) • {formatDate(selectedCommit.timestamp)}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  icon={<IconRotateCcw size={14} />}
                  onClick={() => onRestoreCommit(selectedCommit)}
                  title="Restore this version snapshot into your working tree"
                >
                  Restore Version
                </Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>
                  Commit: <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{selectedCommit.hash}</span>
                </span>
                {commitDetail && (
                  <span>
                    Files Changed: <strong style={{ color: 'var(--text-secondary)' }}>{commitDetail.stats.totalFiles}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Commit Diffs / Changed Files */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: 'var(--bg-primary)' }}>
              {isLoadingDetail ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading commit diff details...
                </div>
              ) : commitDetail && commitDetail.files.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {commitDetail.files.map((file) => (
                    <div
                      key={file.path}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        background: 'var(--bg-card)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.6rem 0.85rem',
                          background: 'var(--bg-secondary)',
                          borderBottom: '1px solid var(--border-subtle)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' }}>
                          <IconFileText size={15} style={{ color: 'var(--text-muted)' }} />
                          <strong>{file.path}</strong>
                          <Badge variant={file.status === 'added' ? 'success' : file.status === 'deleted' ? 'danger' : 'neutral'}>
                            {file.status}
                          </Badge>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>+{file.additions}</span>
                          <span style={{ color: 'var(--status-danger)', fontWeight: 600 }}>-{file.deletions}</span>
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem', overflowX: 'auto' }}>
                        {file.isBinary ? (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>
                            Binary file differences cannot be displayed.
                          </div>
                        ) : file.diff ? (
                          <pre
                            style={{
                              margin: 0,
                              fontFamily: 'monospace',
                              fontSize: '0.82rem',
                              lineHeight: 1.45,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {file.diff.split('\n').map((line, idx) => {
                              const isAdd = line.startsWith('+') && !line.startsWith('+++');
                              const isDel = line.startsWith('-') && !line.startsWith('---');
                              const color = isAdd ? '#4ade80' : isDel ? '#f87171' : 'var(--text-secondary)';
                              const bg = isAdd ? 'rgba(34, 197, 94, 0.1)' : isDel ? 'rgba(239, 68, 68, 0.1)' : 'transparent';
                              return (
                                <div key={idx} style={{ color, background: bg, padding: '0.05rem 0.25rem', borderRadius: 2 }}>
                                  {line}
                                </div>
                              );
                            })}
                          </pre>
                        ) : (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                            No text differences.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No file differences recorded in this commit.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Select a commit from the timeline to inspect its changes.
          </div>
        )}
      </div>
    </div>
  );
};
