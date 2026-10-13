import React, { useState } from 'react';
import { Button } from '../common/Button';
import { IconClose, IconUsers, IconAlertCircle, IconCheck } from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import { ProjectRole } from '../../types/collaboration';

interface InviteMemberModalProps {
  projectId: string;
  projectName: string;
  currentUserRole?: ProjectRole;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS: Array<{ role: ProjectRole; label: string; desc: string }> = [
  { role: 'viewer', label: 'Viewer', desc: 'Read-only access to files, history, tasks, and reviews.' },
  { role: 'reviewer', label: 'Reviewer', desc: 'Inspect changes, comment on discussions, and submit review decisions.' },
  { role: 'member', label: 'Member', desc: 'Create and edit files, branches, tasks, and reviews.' },
  { role: 'admin', label: 'Admin', desc: 'Manage project members, tasks, and collaboration settings.' },
  { role: 'owner', label: 'Owner', desc: 'Full administrative control over the project and team.' },
];

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  projectId,
  projectName,
  currentUserRole = 'owner',
  onClose,
  onSuccess,
}) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim()) {
      setError('Please provide a username or email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const invite = await collaborationService.inviteMember(projectId, {
        usernameOrEmail: usernameOrEmail.trim(),
        role,
      });

      setSuccess(`Invitation sent successfully to @${invite.invitee.username || usernameOrEmail}!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to send invitation.');
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
          maxWidth: '520px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
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
              <IconUsers size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Invite Team Member
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Collaborate on {projectName}
              </p>
            </div>
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

        {/* Modal Body */}
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

          {success && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-success-bg)',
                border: '1px solid var(--status-success-border)',
                color: 'var(--status-success)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <IconCheck size={16} />
              <span>{success}</span>
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.45rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              User Identifier (Username or Email)
            </label>
            <input
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="e.g. alex or alex@example.com"
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

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.45rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              Project Role
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ROLE_OPTIONS.map((opt) => {
                const isSelected = role === opt.role;
                const isDisabled = currentUserRole !== 'owner' && opt.role === 'owner';

                return (
                  <div
                    key={opt.role}
                    onClick={() => !isDisabled && setRole(opt.role)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                      background: isSelected ? 'var(--brand-primary-glow)' : 'var(--bg-surface)',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.45 : 1,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      transition: 'border-color var(--transition-fast)',
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.role}
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => setRole(opt.role)}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {opt.label}
                        </span>
                        {opt.role === 'owner' && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(234, 179, 8, 0.15)',
                              color: '#eab308',
                              fontWeight: 600,
                            }}
                          >
                            Full Ownership
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {opt.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading || !usernameOrEmail.trim()}>
              {loading ? 'Sending Invite...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
