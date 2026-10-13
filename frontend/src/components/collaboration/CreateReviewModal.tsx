import React, { useState } from 'react';
import { Button } from '../common/Button';
import { IconClose, IconReviews, IconAlertCircle } from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import { ProjectMemberItem } from '../../types/collaboration';
import { GitBranchItem } from '../../types/git';
import { ArtifactItem } from '../../types/artifact';

interface CreateReviewModalProps {
  projectId: string;
  members: ProjectMemberItem[];
  branches?: GitBranchItem[];
  artifacts?: ArtifactItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateReviewModal: React.FC<CreateReviewModalProps> = ({
  projectId,
  members,
  branches = [],
  artifacts = [],
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<'branch' | 'commit' | 'artifact'>('branch');
  const [targetRef, setTargetRef] = useState(branches[0]?.name || 'main');
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleReviewer = (userId: string) => {
    setSelectedReviewerIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetRef.trim()) {
      setError('Title and target reference are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await collaborationService.createReview(projectId, {
        title: title.trim(),
        description: description.trim() || null,
        targetType,
        targetRef: targetRef.trim(),
        reviewerIds: selectedReviewerIds,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-primary-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-primary-light)',
              }}
            >
              <IconReviews size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Request Review
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-danger-bg)',
                border: '1px solid var(--status-danger-border)',
                color: 'var(--status-danger)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <IconAlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              Review Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement user authentication and session security"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              Description / Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the changes, context, and what reviewers should verify..."
              rows={3}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Target Type and Reference */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                }}
              >
                Target Type
              </label>
              <select
                value={targetType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setTargetType(val);
                  if (val === 'branch') setTargetRef(branches[0]?.name || 'main');
                  else if (val === 'artifact') setTargetRef(artifacts[0]?.id || '');
                  else setTargetRef('');
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="branch">Branch</option>
                <option value="commit">Commit</option>
                <option value="artifact">Artifact</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                }}
              >
                Target Reference *
              </label>
              {targetType === 'branch' && branches.length > 0 ? (
                <select
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} {b.isCurrent ? '(current)' : ''}
                    </option>
                  ))}
                </select>
              ) : targetType === 'artifact' && artifacts.length > 0 ? (
                <select
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {artifacts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.path})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                  placeholder={
                    targetType === 'commit'
                      ? 'e.g. 7-40 character commit hash'
                      : 'e.g. main, feature-login'
                  }
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              )}
            </div>
          </div>

          {/* Select Reviewers Checklist */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              Select Reviewers
            </label>
            <div
              style={{
                maxHeight: '130px',
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                background: 'var(--bg-surface)',
              }}
            >
              {members.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.25rem' }}>
                  No other team members yet.
                </span>
              ) : (
                members.map((m) => (
                  <label
                    key={m.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedReviewerIds.includes(m.userId)}
                      onChange={() => handleToggleReviewer(m.userId)}
                    />
                    <span>
                      {m.user?.displayName || m.user?.username} (@{m.user?.username}) •{' '}
                      <span style={{ color: 'var(--text-muted)' }}>{m.role}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading || !title.trim()}>
              {loading ? 'Creating Review...' : 'Create Review Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
