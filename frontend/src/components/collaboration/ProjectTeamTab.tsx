import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconUsers,
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconShield,
  IconClose,
} from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import { ProjectMemberItem, ProjectInvitationItem, ProjectRole } from '../../types/collaboration';
import { InviteMemberModal } from './InviteMemberModal';
import { useAuth } from '../../context/AuthContext';

interface ProjectTeamTabProps {
  projectId: string;
  projectName: string;
}

const ROLE_COLORS: Record<ProjectRole, { bg: string; color: string; border: string }> = {
  owner: { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: 'rgba(234, 179, 8, 0.35)' },
  admin: { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: 'rgba(99, 102, 241, 0.35)' },
  member: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.35)' },
  reviewer: { bg: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: 'rgba(6, 182, 212, 0.35)' },
  viewer: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.35)' },
};

export const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({ projectId, projectName }) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load members
  const {
    data: members = [],
    isLoading: loadingMembers,
    error: membersError,
  } = useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: () => collaborationService.listMembers(projectId),
  });

  // Load pending invitations
  const {
    data: invitations = [],
  } = useQuery({
    queryKey: ['projectInvitations', projectId],
    queryFn: () => collaborationService.listProjectInvitations(projectId),
    retry: false, // In case user is viewer and not permitted to list invites
  });

  // Determine current user's effective role
  const currentUserMember = members.find((m) => m.userId === currentUser?.id);
  const currentUserRole: ProjectRole = currentUserMember?.role || 'viewer';
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Role update mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: ProjectRole }) =>
      collaborationService.updateMemberRole(projectId, userId, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to update member role.');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => collaborationService.removeMember(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to remove member.');
    },
  });

  // Cancel invitation mutation
  const cancelInviteMutation = useMutation({
    mutationFn: (invitationId: string) => collaborationService.cancelInvitation(projectId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectInvitations', projectId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to cancel invitation.');
    },
  });

  const handleRoleChange = (member: ProjectMemberItem, newRole: ProjectRole) => {
    if (member.role === newRole) return;
    updateRoleMutation.mutate({ userId: member.userId, newRole });
  };

  const handleRemoveMember = (member: ProjectMemberItem) => {
    if (
      window.confirm(
        `Are you sure you want to remove @${member.user.username} from this project?`
      )
    ) {
      removeMemberMutation.mutate(member.userId);
    }
  };

  const handleCancelInvite = (invitation: ProjectInvitationItem) => {
    if (window.confirm(`Cancel pending invitation for @${invitation.invitee.username}?`)) {
      cancelInviteMutation.mutate(invitation.id);
    }
  };

  const getInitials = (name?: string, fallback = 'U'): string => {
    if (!name) return fallback;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Team Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <IconUsers size={20} />
            <span>Project Team & Access</span>
            <Badge variant="neutral">{members.length} Members</Badge>
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manage collaborators, assign scoped permission roles, and review pending invitations.
          </p>
        </div>

        {canManageMembers && (
          <Button variant="primary" onClick={() => setShowInviteModal(true)}>
            <IconPlus size={16} />
            <span>Invite Collaborator</span>
          </Button>
        )}
      </div>

      {/* Global Error Banner */}
      {(actionError || membersError) && (
        <div
          style={{
            padding: '0.75rem 1rem',
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
          <span>{actionError || (membersError as any)?.message || 'An error occurred.'}</span>
        </div>
      )}

      {/* Members Table */}
      <div
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            display: 'grid',
            gridTemplateColumns: '2.5fr 1.5fr 1.5fr 100px',
            alignItems: 'center',
          }}
        >
          <span>User</span>
          <span>Role</span>
          <span>Joined</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {loadingMembers ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading project team members...
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No members found for this project.
          </div>
        ) : (
          members.map((member) => {
            const isSelf = member.userId === currentUser?.id;
            const isOwner = member.role === 'owner';
            const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.viewer;
            const canModifyThisMember =
              canManageMembers &&
              !isSelf &&
              (currentUserRole === 'owner' || member.role !== 'owner');

            return (
              <div
                key={member.id}
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1.5fr 1.5fr 100px',
                  alignItems: 'center',
                  transition: 'background var(--transition-fast)',
                }}
              >
                {/* User Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                    }}
                  >
                    {member.user?.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.username}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      getInitials(member.user?.displayName || member.user?.username)
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {member.user?.displayName || member.user?.username}
                      </span>
                      {isSelf && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.05rem 0.35rem',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--brand-primary-glow)',
                            color: 'var(--brand-primary-light)',
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      @{member.user?.username} • {member.user?.email}
                    </span>
                  </div>
                </div>

                {/* Role Column */}
                <div>
                  {canModifyThisMember ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value as ProjectRole)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: 'var(--radius-md)',
                        background: roleStyle.bg,
                        color: roleStyle.color,
                        border: `1px solid ${roleStyle.border}`,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      {currentUserRole === 'owner' && <option value="owner">Owner</option>}
                    </select>
                  ) : (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.65rem',
                        borderRadius: 'var(--radius-md)',
                        background: roleStyle.bg,
                        color: roleStyle.color,
                        border: `1px solid ${roleStyle.border}`,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {member.role}
                    </span>
                  )}
                </div>

                {/* Joined Column */}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(member.createdAt).toLocaleDateString()}
                </span>

                {/* Actions Column */}
                <div style={{ textAlign: 'right' }}>
                  {canModifyThisMember && !isOwner && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--status-danger)',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Remove Member"
                    >
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pending Invitations Section (Admins/Owners) */}
      {canManageMembers && invitations.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3
            style={{
              margin: '0 0 0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Pending Invitations</span>
            <Badge variant="warning">{invitations.length} Pending</Badge>
          </h3>

          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            {invitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  padding: '0.85rem 1.25rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      @{inv.invitee.username}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-secondary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      Role: {inv.role}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Invited by @{inv.inviter.username} • Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Button variant="ghost" onClick={() => handleCancelInvite(inv)}>
                    <IconClose size={14} />
                    <span>Cancel</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions Legend */}
      <div
        style={{
          marginTop: '1rem',
          padding: '1.25rem',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h4
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <IconShield size={16} />
          <span>Role Permissions Matrix</span>
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.85rem',
            fontSize: '0.75rem',
          }}
        >
          <div>
            <span style={{ fontWeight: 600, color: '#eab308' }}>Owner:</span> Full control, membership, repository deletion, and ownership transfer.
          </div>
          <div>
            <span style={{ fontWeight: 600, color: '#818cf8' }}>Admin:</span> Invite collaborators, update member roles, and manage tasks/reviews.
          </div>
          <div>
            <span style={{ fontWeight: 600, color: '#34d399' }}>Member:</span> Create, edit, and restore files, branches, tasks, and reviews.
          </div>
          <div>
            <span style={{ fontWeight: 600, color: '#22d3ee' }}>Reviewer:</span> Inspect code, participate in discussions, and submit review approvals.
          </div>
          <div>
            <span style={{ fontWeight: 600, color: '#94a3b8' }}>Viewer:</span> Read-only access to files, history, and traceability maps.
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <InviteMemberModal
          projectId={projectId}
          projectName={projectName}
          currentUserRole={currentUserRole}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
            queryClient.invalidateQueries({ queryKey: ['projectInvitations', projectId] });
          }}
        />
      )}
    </div>
  );
};
