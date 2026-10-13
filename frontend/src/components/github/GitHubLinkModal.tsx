import React, { useState } from 'react';
import { IconGitHub, IconClose, IconAlertCircle } from '../common/Icons';
import { Button } from '../common/Button';
import { GitHubLinkInput } from '../../types/github';

interface GitHubLinkModalProps {
  isOpen: boolean;
  isLinking: boolean;
  error: string | null;
  onClose: () => void;
  onLink: (input: GitHubLinkInput) => Promise<void>;
}

export const GitHubLinkModal: React.FC<GitHubLinkModalProps> = ({
  isOpen,
  isLinking,
  error,
  onClose,
  onLink,
}) => {
  const [repoIdentifier, setRepoIdentifier] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const input = repoIdentifier.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    const parts = input.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setValidationError('Please specify a valid repository in the format: owner/repository (e.g. facebook/react)');
      return;
    }

    const owner = parts[0].trim();
    const repo = parts[1].trim();

    if (!/^[a-zA-Z0-9_-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
      setValidationError('Repository owner and name contain invalid characters.');
      return;
    }

    await onLink({ owner, repo });
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
          maxWidth: '500px',
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
              Link Existing GitHub Repository
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            disabled={isLinking}
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Form */}
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

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="github-repo-link"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}
            >
              GitHub Repository (owner/repo) *
            </label>
            <input
              id="github-repo-link"
              type="text"
              value={repoIdentifier}
              onChange={(e) => setRepoIdentifier(e.target.value)}
              placeholder="e.g. username/my-repository or https://github.com/..."
              disabled={isLinking}
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
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Enter the repository path or full HTTPS URL. Versora will verify access before linking.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="ghost" onClick={onClose} disabled={isLinking}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={<IconGitHub size={16} />}
              disabled={isLinking || !repoIdentifier.trim()}
            >
              {isLinking ? 'Verifying & Linking...' : 'Link Repository'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
