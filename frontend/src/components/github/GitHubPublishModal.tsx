import React, { useState } from 'react';
import { IconGitHub, IconUploadCloud, IconClose, IconAlertCircle } from '../common/Icons';
import { Button } from '../common/Button';
import { GitHubPublishInput } from '../../types/github';

interface GitHubPublishModalProps {
  isOpen: boolean;
  projectName: string;
  isPublishing: boolean;
  error: string | null;
  onClose: () => void;
  onPublish: (input: GitHubPublishInput) => Promise<void>;
}

export const GitHubPublishModal: React.FC<GitHubPublishModalProps> = ({
  isOpen,
  projectName,
  isPublishing,
  error,
  onClose,
  onPublish,
}) => {
  const [repoName, setRepoName] = useState<string>(
    projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'my-project'
  );
  const [description, setDescription] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [confirmedPublish, setConfirmedPublish] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanName = repoName.trim();
    if (!cleanName || cleanName.length < 1 || cleanName.length > 100) {
      setValidationError('Repository name must be between 1 and 100 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(cleanName)) {
      setValidationError('Repository name may only contain alphanumeric characters, hyphens, periods, and underscores.');
      return;
    }

    if (!confirmedPublish) {
      setValidationError('Please confirm that you want to publish your project files externally to GitHub.');
      return;
    }

    await onPublish({
      name: cleanName,
      description: description.trim() || undefined,
      isPrivate,
    });
  };

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
          maxWidth: '540px',
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
              Publish Project to GitHub
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            disabled={isPublishing}
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {(error || validationError) && (
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
              <span>{error || validationError}</span>
            </div>
          )}

          {/* Repository Name */}
          <div style={{ marginBottom: '1.1rem' }}>
            <label
              htmlFor="github-repo-name"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}
            >
              Repository Name *
            </label>
            <input
              id="github-repo-name"
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="e.g. versora-workspace"
              disabled={isPublishing}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.9rem',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
              }}
              required
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1.1rem' }}>
            <label
              htmlFor="github-repo-desc"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}
            >
              Description (Optional)
            </label>
            <textarea
              id="github-repo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project repository"
              disabled={isPublishing}
              rows={2}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.88rem',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Visibility Selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Repository Visibility
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.75rem 1rem',
                  background: isPrivate ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-app)',
                  border: isPrivate ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={isPrivate}
                  onChange={() => setIsPrivate(true)}
                  disabled={isPublishing}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Private</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Only you can view and push
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.75rem 1rem',
                  background: !isPrivate ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-app)',
                  border: !isPrivate ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={!isPrivate}
                  onChange={() => setIsPrivate(false)}
                  disabled={isPublishing}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Public</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Anyone on GitHub can see this
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Explicit Confirmation Notice */}
          <div
            style={{
              padding: '1rem',
              marginBottom: '1.25rem',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.83rem',
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={confirmedPublish}
                onChange={(e) => setConfirmedPublish(e.target.checked)}
                disabled={isPublishing}
                style={{ marginTop: '0.2rem' }}
              />
              <span>
                I confirm that I want to create this repository and publish my project's current commits to GitHub.
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="ghost" onClick={onClose} disabled={isPublishing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={<IconUploadCloud size={16} />}
              disabled={isPublishing || !confirmedPublish}
            >
              {isPublishing ? 'Publishing to GitHub...' : 'Publish Repository'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
