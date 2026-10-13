import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconTasks,
  IconPlus,
  IconSearch,
  IconMessageSquare,
} from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import {
  TaskStatus,
  TaskPriority,
} from '../../types/collaboration';
import { ArtifactItem } from '../../types/artifact';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskDetailModal } from './TaskDetailModal';

interface ProjectTasksTabProps {
  projectId: string;
  projectName: string;
  artifacts?: ArtifactItem[];
}

const STATUS_COLUMNS: Array<{ status: TaskStatus; title: string; color: string }> = [
  { status: 'todo', title: 'To Do', color: '#94a3b8' },
  { status: 'in_progress', title: 'In Progress', color: '#6366f1' },
  { status: 'in_review', title: 'In Review', color: '#f59e0b' },
  { status: 'done', title: 'Done', color: '#10b981' },
];

const PRIORITY_BADGES: Record<TaskPriority, { bg: string; color: string }> = {
  low: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' },
  medium: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' },
  high: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  urgent: { bg: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' },
};

export const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({
  projectId,
  projectName: _projectName,
  artifacts = [],
}) => {
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Load project members (for assignees)
  const { data: members = [] } = useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: () => collaborationService.listMembers(projectId),
  });

  // Load tasks
  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['projectTasks', projectId, statusFilter, priorityFilter, assigneeFilter, search],
    queryFn: () =>
      collaborationService.listTasks(projectId, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        assigneeId: assigneeFilter || undefined,
        search: search.trim() || undefined,
      }),
  });

  // Quick status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) =>
      collaborationService.updateTask(projectId, taskId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
    },
  });

  const getInitials = (name?: string, fallback = 'U'): string => {
    if (!name) return fallback;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Toolbar */}
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
            <IconTasks size={20} />
            <span>Project Tasks & Issues</span>
            <Badge variant="neutral">{tasks.length} Tasks</Badge>
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Track features, bugs, assignments, and reviews connected to your codebase.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* View Mode Toggle */}
          <div
            style={{
              display: 'inline-flex',
              padding: '0.2rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('board')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: viewMode === 'board' ? 'var(--brand-primary)' : 'none',
                color: viewMode === 'board' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: viewMode === 'list' ? 'var(--brand-primary)' : 'none',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              List
            </button>
          </div>

          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <IconPlus size={16} />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
          <IconSearch size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or description..."
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="done">Done</option>
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
          }}
        >
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        {/* Assignee Filter */}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          style={{
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
          }}
        >
          <option value="">All Assignees</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              @{m.user?.username}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading tasks...
        </div>
      ) : error ? (
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--status-danger-bg)',
            color: 'var(--status-danger)',
          }}
        >
          Failed to load tasks.
        </div>
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(250px, 1fr))',
            gap: '1rem',
            alignItems: 'flex-start',
            overflowX: 'auto',
            paddingBottom: '1rem',
          }}
        >
          {STATUS_COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.status);

            return (
              <div
                key={col.status}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  minHeight: '380px',
                }}
              >
                {/* Column Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 'var(--radius-full)',
                        background: col.color,
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {col.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {columnTasks.length}
                  </span>
                </div>

                {/* Task Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {columnTasks.length === 0 ? (
                    <div
                      style={{
                        padding: '2rem 1rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      No tasks
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const pBadge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
                        >
                          {/* Priority & Status Controls */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                padding: '0.1rem 0.4rem',
                                borderRadius: 'var(--radius-sm)',
                                background: pBadge.bg,
                                color: pBadge.color,
                              }}
                            >
                              {task.priority}
                            </span>

                            {/* Status mover select */}
                            <select
                              value={task.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                updateStatusMutation.mutate({
                                  taskId: task.id,
                                  newStatus: e.target.value as TaskStatus,
                                })
                              }
                              style={{
                                fontSize: '0.7rem',
                                background: 'none',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-muted)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.1rem 0.35rem',
                                outline: 'none',
                              }}
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="in_review">In Review</option>
                              <option value="done">Done</option>
                            </select>
                          </div>

                          {/* Title */}
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                              lineHeight: 1.4,
                            }}
                          >
                            {task.title}
                          </div>

                          {/* Labels */}
                          {task.labels && task.labels.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {task.labels.map((lbl, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '0.65rem',
                                    padding: '0.05rem 0.35rem',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  #{lbl}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Footer: Assignee & Comments */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '0.35rem',
                              borderTop: '1px solid var(--border-subtle)',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <div
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 'var(--radius-full)',
                                  background: task.assignee ? 'var(--brand-primary-glow)' : 'rgba(255, 255, 255, 0.05)',
                                  color: task.assignee ? 'var(--brand-primary-light)' : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                }}
                              >
                                {task.assignee ? getInitials(task.assignee.displayName || task.assignee.username) : '?'}
                              </div>
                              <span>{task.assignee ? `@${task.assignee.username}` : 'Unassigned'}</span>
                            </div>

                            {task.commentsCount !== undefined && task.commentsCount > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <IconMessageSquare size={12} />
                                <span>{task.commentsCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {tasks.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No tasks found matching your filter criteria.
            </div>
          ) : (
            tasks.map((task) => {
              const pBadge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  style={{
                    padding: '0.85rem 1.25rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        background: pBadge.bg,
                        color: pBadge.color,
                      }}
                    >
                      {task.priority}
                    </span>

                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {task.title}
                    </span>

                    {task.labels &&
                      task.labels.map((lbl, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.05rem 0.35rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          #{lbl}
                        </span>
                      ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-secondary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {task.status.replace('_', ' ')}
                    </span>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {task.assignee ? `@${task.assignee.username}` : 'Unassigned'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTaskModal
          projectId={projectId}
          members={members}
          artifacts={artifacts}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
          }}
        />
      )}

      {selectedTaskId && (
        <TaskDetailModal
          projectId={projectId}
          taskId={selectedTaskId}
          members={members}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
          }}
        />
      )}
    </div>
  );
};
