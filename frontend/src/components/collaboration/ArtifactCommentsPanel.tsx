import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconMessageSquare,
  IconSend,
  IconCheck,
  IconClose,
  IconTrash,
  IconEdit,
  IconGitCommit,
} from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import { ProjectMemberItem } from '../../types/collaboration';
import { useAuth } from '../../context/AuthContext';

interface ArtifactCommentsPanelProps {
  projectId: string;
  artifactId: string;
  artifactName: string;
  currentCommitHash?: string | null;
  members?: ProjectMemberItem[];
  onClose?: () => void;
}

export const ArtifactCommentsPanel: React.FC<ArtifactCommentsPanelProps> = ({
  projectId,
  artifactId,
  artifactName,
  currentCommitHash,
  members: _members = [],
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [newContent, setNewContent] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [filterUnresolved, setFilterUnresolved] = useState(false);
  const [linkRevision, setLinkRevision] = useState(false);

  // Fetch comments for artifact
  const {
    data: comments = [],
    isLoading,
  } = useQuery({
    queryKey: ['artifactComments', projectId, artifactId],
    queryFn: () => collaborationService.listArtifactComments(projectId, artifactId),
    refetchInterval: 10000,
  });

  // Create comment mutation
  const createMutation = useMutation({
    mutationFn: (data: { content: string; parentId?: string | null; revisionCommitHash?: string | null }) =>
      collaborationService.createComment(projectId, artifactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifactComments', projectId, artifactId] });
      setNewContent('');
      setReplyParentId(null);
      setReplyContent('');
    },
  });

  // Update comment mutation
  const updateMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      collaborationService.updateComment(projectId, commentId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifactComments', projectId, artifactId] });
      setEditingCommentId(null);
    },
  });

  // Delete comment mutation
  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => collaborationService.deleteComment(projectId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifactComments', projectId, artifactId] });
    },
  });

  // Resolve comment mutation
  const resolveMutation = useMutation({
    mutationFn: ({ commentId, isResolved }: { commentId: string; isResolved: boolean }) =>
      collaborationService.resolveComment(projectId, commentId, isResolved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifactComments', projectId, artifactId] });
    },
  });

  const handleCreateTopLevel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    createMutation.mutate({
      content: newContent.trim(),
      revisionCommitHash: linkRevision && currentCommitHash ? currentCommitHash : null,
    });
  };

  const handleCreateReply = (parentId: string) => {
    if (!replyContent.trim()) return;

    createMutation.mutate({
      content: replyContent.trim(),
      parentId,
    });
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editContent.trim()) return;
    updateMutation.mutate({ commentId, content: editContent.trim() });
  };

  const getInitials = (name?: string, fallback = 'U'): string => {
    if (!name) return fallback;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const filteredComments = filterUnresolved
    ? comments.filter((c) => !c.isResolved)
    : comments;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-surface-elevated)',
        borderLeft: '1px solid var(--border-medium)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <IconMessageSquare size={18} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Discussions & Comments
          </span>
          <Badge variant="neutral">{comments.length}</Badge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <input
              type="checkbox"
              checked={filterUnresolved}
              onChange={(e) => setFilterUnresolved(e.target.checked)}
            />
            <span>Unresolved only</span>
          </label>
          {onClose && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '0.2rem', color: 'var(--text-muted)' }}
              onClick={onClose}
              title="Close Discussions"
            >
              <IconClose size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Comments List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading discussion threads...
          </div>
        ) : filteredComments.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No comments yet on {artifactName}.</p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem' }}>
              Start a discussion thread below. Use @username to mention collaborators.
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const isAuthor = comment.authorId === currentUser?.id;
            const isEditing = editingCommentId === comment.id;

            return (
              <div
                key={comment.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${comment.isResolved ? 'var(--status-success-border)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                {/* Comment Author Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--brand-primary-glow)',
                        color: 'var(--brand-primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {getInitials(comment.author?.displayName || comment.author?.username)}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {comment.author?.displayName || comment.author?.username}
                      </span>
                      <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        @{comment.author?.username}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {comment.revisionCommitHash && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                        title={`Linked to commit ${comment.revisionCommitHash}`}
                      >
                        <IconGitCommit size={10} />
                        {comment.revisionCommitHash.substring(0, 7)}
                      </span>
                    )}

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Comment Content / Edit Form */}
                {isEditing ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                      <Button variant="primary" size="sm" onClick={() => handleSaveEdit(comment.id)}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingCommentId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {comment.content}
                  </div>
                )}

                {/* Comment Footer & Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.45rem',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyParentId(replyParentId === comment.id ? null : comment.id);
                        setReplyContent('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--brand-primary-light)',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 500,
                      }}
                    >
                      Reply ({comment.replyCount || 0})
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        resolveMutation.mutate({
                          commentId: comment.id,
                          isResolved: !comment.isResolved,
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: comment.isResolved ? 'var(--status-success)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <IconCheck size={12} />
                      <span>{comment.isResolved ? 'Resolved' : 'Resolve'}</span>
                    </button>
                  </div>

                  {isAuthor && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditContent(comment.content);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '0.2rem',
                        }}
                        title="Edit Comment"
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Delete this comment?')) {
                            deleteMutation.mutate(comment.id);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--status-danger)',
                          cursor: 'pointer',
                          padding: '0.2rem',
                        }}
                        title="Delete Comment"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Nested Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div
                    style={{
                      marginLeft: '1rem',
                      paddingLeft: '0.75rem',
                      borderLeft: '2px solid var(--border-medium)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      marginTop: '0.35rem',
                    }}
                  >
                    {comment.replies.map((reply) => (
                      <div
                        key={reply.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                            {reply.author?.displayName || reply.author?.username}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Reply Form */}
                {replyParentId === comment.id && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write a reply... Use @username to mention"
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                      <Button variant="ghost" size="sm" onClick={() => setReplyParentId(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!replyContent.trim()}
                        onClick={() => handleCreateReply(comment.id)}
                      >
                        Send Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Top-Level Comment Form */}
      <form
        onSubmit={handleCreateTopLevel}
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={`Add a comment to ${artifactName}... Use @username to notify team`}
          rows={3}
          style={{
            width: '100%',
            padding: '0.65rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            resize: 'vertical',
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          {currentCommitHash ? (
            <label
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={linkRevision}
                onChange={(e) => setLinkRevision(e.target.checked)}
              />
              <span>Link to commit {currentCommitHash.substring(0, 7)}</span>
            </label>
          ) : (
            <div />
          )}

          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={!newContent.trim() || createMutation.isPending}
          >
            <IconSend size={14} />
            <span>{createMutation.isPending ? 'Posting...' : 'Post Comment'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
