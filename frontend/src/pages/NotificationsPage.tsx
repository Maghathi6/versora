import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/common/PageHeader';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  IconNotifications,
  IconCheck,
  IconClose,
  IconUsers,
  IconTasks,
  IconReviews,
  IconMessageSquare,
} from '../components/common/Icons';
import { collaborationService } from '../services/collaborationService';
import { NotificationItem } from '../types/collaboration';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [invitationMessage, setInvitationMessage] = useState<string | null>(null);

  // Load all notifications
  const {
    data: notifications = [],
    isLoading: loadingNotifications,
  } = useQuery({
    queryKey: ['allNotifications'],
    queryFn: () => collaborationService.listNotifications({ limit: 100 }),
    refetchInterval: 10000,
  });

  // Load user's pending invitations
  const {
    data: invitations = [],
  } = useQuery({
    queryKey: ['userInvitations'],
    queryFn: () => collaborationService.listUserInvitations(),
    refetchInterval: 10000,
  });

  // Mark single read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => collaborationService.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['recentNotifications'] });
    },
  });

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => collaborationService.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['recentNotifications'] });
    },
  });

  // Accept invitation mutation
  const acceptInviteMutation = useMutation({
    mutationFn: (token: string) => collaborationService.acceptInvitation(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['userProjects'] });
      setInvitationMessage(`Joined "${data.projectName || 'project'}" as ${data.role}!`);
    },
    onError: (err: any) => {
      setInvitationMessage(err?.message || 'Failed to accept invitation.');
    },
  });

  // Reject invitation mutation
  const rejectInviteMutation = useMutation({
    mutationFn: (token: string) => collaborationService.rejectInvitation(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userInvitations'] });
      setInvitationMessage('Invitation declined.');
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }

    if (n.projectId) {
      if (n.entityType === 'task') {
        navigate(`/projects/${n.projectId}?tab=tasks`);
      } else if (n.entityType === 'review') {
        navigate(`/projects/${n.projectId}?tab=reviews`);
      } else {
        navigate(`/projects/${n.projectId}`);
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invitation':
        return <IconUsers size={18} color="var(--brand-primary-light)" />;
      case 'task_assigned':
      case 'task_updated':
        return <IconTasks size={18} color="var(--status-info)" />;
      case 'review_requested':
      case 'review_decision':
        return <IconReviews size={18} color="var(--status-warning)" />;
      default:
        return <IconMessageSquare size={18} color="var(--brand-primary-light)" />;
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Notifications"
        subtitle="Manage invitations, review requests, task assignments, and mentions."
        badge={unreadCount > 0 ? <Badge variant="warning">{unreadCount} Unread</Badge> : <Badge variant="neutral">All Caught Up</Badge>}
      />

      {invitationMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--status-success-bg)',
            border: '1px solid var(--status-success-border)',
            color: 'var(--status-success)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{invitationMessage}</span>
          <button
            type="button"
            onClick={() => setInvitationMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <IconClose size={16} />
          </button>
        </div>
      )}

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconUsers size={18} color="var(--brand-primary-light)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Pending Project Invitations ({invitations.length})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {inv.projectName}
                    </span>
                    <Badge variant="neutral">Role: {inv.role}</Badge>
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Invited by @{inv.inviter?.username} • Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectInviteMutation.mutate(inv.token)}
                    disabled={rejectInviteMutation.isPending}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => acceptInviteMutation.mutate(inv.token)}
                    disabled={acceptInviteMutation.isPending}
                  >
                    <IconCheck size={14} />
                    <span>Accept Invitation</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: filter === 'all' ? 'var(--brand-primary)' : 'var(--bg-surface-elevated)',
              color: filter === 'all' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All Notifications ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: filter === 'unread' ? 'var(--brand-primary)' : 'var(--bg-surface-elevated)',
              color: filter === 'unread' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <IconCheck size={14} />
            <span>Mark all as read</span>
          </Button>
        )}
      </div>

      {/* Notifications Feed */}
      <div
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {loadingNotifications ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <IconNotifications size={32} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications found'}
            </p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
              You will be alerted here when colleagues invite you, assign tasks, request reviews, or mention you.
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-subtle)',
                background: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.04)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = n.isRead
                  ? 'transparent'
                  : 'rgba(99, 102, 241, 0.04)')
              }
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '0.15rem',
                }}
              >
                {getNotificationIcon(n.type)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontWeight: n.isRead ? 500 : 700,
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {n.title}
                    </span>
                    {n.projectName && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.05rem 0.4rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {n.projectName}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {new Date(n.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {n.message}
                </p>
              </div>

              {!n.isRead && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    markReadMutation.mutate(n.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  title="Mark as read"
                >
                  <IconCheck size={16} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
