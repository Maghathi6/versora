import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../common/Button';
import {
  IconClose,
  IconSend,
  IconTrash,
  IconMessageSquare,
} from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import {
  ProjectMemberItem,
  TaskStatus,
  TaskPriority,
} from '../../types/collaboration';

interface TaskDetailModalProps {
  projectId: string;
  taskId: string;
  members: ProjectMemberItem[];
  onClose: () => void;
  onTaskUpdated?: () => void;
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: 'low', label: 'Low', color: '#94a3b8' },
  { value: 'medium', label: 'Medium', color: '#38bdf8' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#f43f5e' },
];

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  projectId,
  taskId,
  members,
  onClose,
  onTaskUpdated,
}) => {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  // Fetch task details
  const {
    data: task,
    isLoading: loadingTask,
  } = useQuery({
    queryKey: ['projectTask', projectId, taskId],
    queryFn: () => collaborationService.getTask(projectId, taskId),
  });

  // Fetch task comments
  const {
    data: comments = [],
    isLoading: loadingComments,
  } = useQuery({
    queryKey: ['taskComments', projectId, taskId],
    queryFn: () => collaborationService.listTaskComments(projectId, taskId),
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: (updates: { status?: TaskStatus; priority?: TaskPriority; assigneeId?: string | null }) =>
      collaborationService.updateTask(projectId, taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTask', projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
      onTaskUpdated?.();
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: () => collaborationService.deleteTask(projectId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
      onTaskUpdated?.();
      onClose();
    },
  });

  // Create task comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => collaborationService.createTaskComment(projectId, taskId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskComments', projectId, taskId] });
      setNewComment('');
    },
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment.trim());
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteTaskMutation.mutate();
    }
  };



  if (loadingTask || !task) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: 'var(--text-primary)' }}>Loading task details...</div>
      </div>
    );
  }

  const priorityColor = PRIORITY_OPTIONS.find((p) => p.value === task.priority)?.color || '#94a3b8';

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
          maxWidth: '720px',
          maxHeight: '90vh',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: priorityColor,
                  border: `1px solid ${priorityColor}40`,
                }}
              >
                {task.priority} Priority
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Created by @{task.creator?.username}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {task.title}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleDelete}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--status-danger)',
                cursor: 'pointer',
                padding: '0.35rem',
              }}
              title="Delete Task"
            >
              <IconTrash size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.35rem',
              }}
            >
              <IconClose size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Status
              </span>
              <select
                value={task.status}
                onChange={(e) => updateTaskMutation.mutate({ status: e.target.value as TaskStatus })}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Priority
              </span>
              <select
                value={task.priority}
                onChange={(e) => updateTaskMutation.mutate({ priority: e.target.value as TaskPriority })}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Assignee
              </span>
              <select
                value={task.assigneeId || ''}
                onChange={(e) => updateTaskMutation.mutate({ assigneeId: e.target.value || null })}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.displayName || m.user?.username} (@{m.user?.username})
                  </option>
                ))}
              </select>
            </div>

            {task.dueDate && (
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Due Date
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 style={{ margin: '0 0 0.45rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Description
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {task.description}
              </p>
            </div>
          )}

          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Labels:</span>
              {task.labels.map((lbl, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--brand-primary-glow)',
                    color: 'var(--brand-primary-light)',
                    border: '1px solid var(--brand-primary-light)40',
                  }}
                >
                  {lbl}
                </span>
              ))}
            </div>
          )}

          {/* Linked Artifact */}
          {task.linkedArtifact && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Linked Artifact: </span>
              <span style={{ fontWeight: 600, color: 'var(--brand-primary-light)' }}>
                {task.linkedArtifact.name}
              </span>{' '}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                ({task.linkedArtifact.path})
              </span>
            </div>
          )}

          {/* Discussion & Comments */}
          <div style={{ marginTop: '0.5rem' }}>
            <h4
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <IconMessageSquare size={16} />
              <span>Discussion ({comments.length})</span>
            </h4>

            {/* Comments List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              {loadingComments ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading comments...</div>
              ) : comments.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No comments yet on this task. Be the first to comment!
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {c.author?.displayName || c.author?.username} (@{c.author?.username})
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {c.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment... Use @username to notify"
                style={{
                  flex: 1,
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <Button
                variant="primary"
                type="submit"
                disabled={!newComment.trim() || createCommentMutation.isPending}
              >
                <IconSend size={14} />
                <span>Post</span>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
