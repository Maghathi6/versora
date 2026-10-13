import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../common/Button';
import {
  IconClose,
  IconThumbUp,
  IconAlertTriangle,
  IconSend,
  IconMessageSquare,
} from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import {
  ProjectMemberItem,
  ReviewDecision,
} from '../../types/collaboration';
import { useAuth } from '../../context/AuthContext';

interface ReviewDetailModalProps {
  projectId: string;
  reviewId: string;
  members: ProjectMemberItem[];
  onClose: () => void;
  onReviewUpdated?: () => void;
}

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: 'Open' },
  approved: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', label: 'Approved' },
  changes_requested: { bg: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', label: 'Changes Requested' },
  closed: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', label: 'Closed' },
};

export const ReviewDetailModal: React.FC<ReviewDetailModalProps> = ({
  projectId,
  reviewId,
  members: _members,
  onClose,
  onReviewUpdated,
}) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [decisionFeedback, setDecisionFeedback] = useState('');
  const [showDecisionBox, setShowDecisionBox] = useState<'approved' | 'changes_requested' | null>(null);
  const [newComment, setNewComment] = useState('');

  // Fetch full review details
  const {
    data: review,
    isLoading: loadingReview,
  } = useQuery({
    queryKey: ['projectReview', projectId, reviewId],
    queryFn: () => collaborationService.getReview(projectId, reviewId),
    refetchInterval: 10000,
  });

  // Fetch review comments
  const {
    data: comments = [],
    isLoading: loadingComments,
  } = useQuery({
    queryKey: ['reviewComments', projectId, reviewId],
    queryFn: () => collaborationService.listReviewComments(projectId, reviewId),
  });

  // Submit decision mutation
  const decisionMutation = useMutation({
    mutationFn: (data: { decision: ReviewDecision; feedback?: string | null }) =>
      collaborationService.submitReviewDecision(projectId, reviewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectReview', projectId, reviewId] });
      queryClient.invalidateQueries({ queryKey: ['projectReviews', projectId] });
      setShowDecisionBox(null);
      setDecisionFeedback('');
      onReviewUpdated?.();
    },
  });

  // Close/reopen mutation
  const toggleCloseMutation = useMutation({
    mutationFn: (newStatus: 'open' | 'closed') =>
      collaborationService.updateReview(projectId, reviewId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectReview', projectId, reviewId] });
      queryClient.invalidateQueries({ queryKey: ['projectReviews', projectId] });
      onReviewUpdated?.();
    },
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      collaborationService.createReviewComment(projectId, reviewId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewComments', projectId, reviewId] });
      setNewComment('');
    },
  });

  const handleDecisionSubmit = () => {
    if (!showDecisionBox) return;
    decisionMutation.mutate({
      decision: showDecisionBox,
      feedback: decisionFeedback.trim() || null,
    });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    commentMutation.mutate(newComment.trim());
  };



  if (loadingReview || !review) {
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
        <div style={{ color: 'var(--text-primary)' }}>Loading review details...</div>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[review.status] || STATUS_BADGES.open;
  const isAuthor = review.creatorId === currentUser?.id;
  const isClosed = review.status === 'closed';

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
          maxWidth: '780px',
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
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: statusBadge.bg,
                  color: statusBadge.color,
                }}
              >
                {statusBadge.label}
              </span>

              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary)',
                }}
              >
                {review.targetType}: {review.targetRef}
              </span>

              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Opened by @{review.creator?.username}
              </span>
            </div>

            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {review.title}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isAuthor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleCloseMutation.mutate(isClosed ? 'open' : 'closed')}
              >
                {isClosed ? 'Reopen Review' : 'Close Review'}
              </Button>
            )}
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

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Description */}
          {review.description && (
            <p
              style={{
                margin: 0,
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                background: 'var(--bg-surface)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {review.description}
            </p>
          )}

          {/* Reviewers & Decisions Grid */}
          <div>
            <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Reviewers & Decisions ({review.reviewers.length})
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {review.reviewers.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No assigned reviewers. Any project reviewer can submit an approval.
                </div>
              ) : (
                review.reviewers.map((rev) => {
                  const dec = rev.decision;
                  const isApproved = dec?.decision === 'approved';
                  const isChanges = dec?.decision === 'changes_requested';
                  const isStale = dec?.isStale;

                  return (
                    <div
                      key={rev.id}
                      style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface)',
                        border: `1px solid ${
                          isStale
                            ? 'var(--status-warning-border)'
                            : isApproved
                              ? 'var(--status-success-border)'
                              : isChanges
                                ? 'var(--status-danger-border)'
                                : 'var(--border-subtle)'
                        }`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                            @{rev.user?.username}
                          </span>
                        </div>

                        {dec ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '0.1rem 0.4rem',
                              borderRadius: 'var(--radius-sm)',
                              background: isApproved ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
                              color: isApproved ? 'var(--status-success)' : 'var(--status-danger)',
                            }}
                          >
                            {isApproved ? 'Approved' : 'Changes'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pending</span>
                        )}
                      </div>

                      {/* Stale Warning Indicator */}
                      {isStale && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--status-warning)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <IconAlertTriangle size={12} />
                          <span>Approval stale (branch updated)</span>
                        </div>
                      )}

                      {/* Decision Feedback */}
                      {dec?.feedback && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          "{dec.feedback}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Decision Action Toolbar */}
          {!isClosed && (
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Submit Your Review Decision
              </h4>

              {showDecisionBox ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <textarea
                    value={decisionFeedback}
                    onChange={(e) => setDecisionFeedback(e.target.value)}
                    placeholder={
                      showDecisionBox === 'approved'
                        ? 'Optional approval note or praise...'
                        : 'Explain required changes or missing tests...'
                    }
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <Button variant="ghost" size="sm" onClick={() => setShowDecisionBox(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant={showDecisionBox === 'approved' ? 'primary' : 'danger'}
                      size="sm"
                      onClick={handleDecisionSubmit}
                      disabled={decisionMutation.isPending}
                    >
                      {decisionMutation.isPending
                        ? 'Submitting...'
                        : showDecisionBox === 'approved'
                          ? 'Confirm Approval'
                          : 'Confirm Request Changes'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowDecisionBox('approved')}
                  >
                    <IconThumbUp size={14} />
                    <span>Approve</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDecisionBox('changes_requested')}
                  >
                    <IconAlertTriangle size={14} />
                    <span>Request Changes</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Discussion & Review Comments */}
          <div>
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
              <span>Review Discussion ({comments.length})</span>
            </h4>

            {/* Comments List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
              {loadingComments ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading discussion...</div>
              ) : comments.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No comments yet on this review. Leave review feedback below!
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
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
                placeholder="Leave review comment... Use @username to notify"
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
                disabled={!newComment.trim() || commentMutation.isPending}
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
