import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconNotifications,
  IconUsers,
  IconTasks,
  IconReviews,
  IconMessageSquare,
} from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import { NotificationItem } from '../../types/collaboration';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Unread count query
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notificationUnreadCount'],
    queryFn: () => collaborationService.getUnreadNotificationCount(),
    refetchInterval: 10000,
  });

  // Recent notifications query (loaded when open or cached)
  const { data: notifications = [] } = useQuery({
    queryKey: ['recentNotifications'],
    queryFn: () => collaborationService.listNotifications({ limit: 10 }),
    refetchInterval: 15000,
  });

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => collaborationService.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['recentNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => collaborationService.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['recentNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
    },
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    setIsOpen(false);

    if (n.projectId) {
      if (n.entityType === 'task') {
        navigate(`/projects/${n.projectId}?tab=tasks`);
      } else if (n.entityType === 'review') {
        navigate(`/projects/${n.projectId}?tab=reviews`);
      } else if (n.type === 'invitation') {
        navigate('/notifications');
      } else {
        navigate(`/projects/${n.projectId}`);
      }
    } else {
      navigate('/notifications');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invitation':
        return <IconUsers size={16} color="var(--brand-primary-light)" />;
      case 'task_assigned':
      case 'task_updated':
        return <IconTasks size={16} color="var(--status-info)" />;
      case 'review_requested':
      case 'review_decision':
        return <IconReviews size={16} color="var(--status-warning)" />;
      default:
        return <IconMessageSquare size={16} color="var(--brand-primary-light)" />;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          color: isOpen ? 'var(--brand-primary-light)' : 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '0.45rem',
          borderRadius: 'var(--radius-full)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'color var(--transition-fast)',
        }}
        aria-label="Notifications"
        title="Notifications"
      >
        <IconNotifications size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              borderRadius: 'var(--radius-full)',
              background: 'var(--status-danger)',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              boxShadow: '0 0 8px rgba(244, 63, 94, 0.5)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '360px',
            maxWidth: '90vw',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--status-danger-bg)',
                    color: 'var(--status-danger)',
                    fontWeight: 600,
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-primary-light)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = n.isRead
                      ? 'transparent'
                      : 'rgba(99, 102, 241, 0.05)')
                  }
                >
                  <div style={{ marginTop: '0.15rem' }}>{getNotificationIcon(n.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontWeight: n.isRead ? 500 : 700,
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.title}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '0.2rem 0 0',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {n.message}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--brand-primary)',
                        marginTop: '0.4rem',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '0.65rem 1rem',
              borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-primary-light)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View all notifications &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
