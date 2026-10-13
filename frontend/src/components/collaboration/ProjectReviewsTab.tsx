import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconReviews,
  IconPlus,
  IconMessageSquare,
  IconThumbUp,
  IconAlertTriangle,
} from '../common/Icons';
import { collaborationService } from '../../services/collaborationService';
import { GitBranchItem } from '../../types/git';
import { ArtifactItem } from '../../types/artifact';
import { CreateReviewModal } from './CreateReviewModal';
import { ReviewDetailModal } from './ReviewDetailModal';

interface ProjectReviewsTabProps {
  projectId: string;
  projectName: string;
  branches?: GitBranchItem[];
  artifacts?: ArtifactItem[];
}

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: 'Open' },
  approved: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', label: 'Approved' },
  changes_requested: { bg: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', label: 'Changes Requested' },
  closed: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', label: 'Closed' },
};

export const ProjectReviewsTab: React.FC<ProjectReviewsTabProps> = ({
  projectId,
  projectName: _projectName,
  branches = [],
  artifacts = [],
}) => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  // Load project members
  const { data: members = [] } = useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: () => collaborationService.listMembers(projectId),
  });

  // Load reviews
  const {
    data: reviews = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['projectReviews', projectId],
    queryFn: () => collaborationService.listReviews(projectId),
    refetchInterval: 10000,
  });

  const filteredReviews = reviews.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

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
            <IconReviews size={20} />
            <span>Code & Branch Reviews</span>
            <Badge variant="neutral">{reviews.length} Total</Badge>
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Peer review workflows, approvals, and change requests linked to real Git history.
          </p>
        </div>

        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <IconPlus size={16} />
          <span>Request Review</span>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {['all', 'open', 'approved', 'changes_requested', 'closed'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: statusFilter === st ? 'var(--brand-primary)' : 'var(--bg-surface-elevated)',
              color: statusFilter === st ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading reviews...
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', color: 'var(--status-danger)', textAlign: 'center' }}>
            Failed to load reviews.
          </div>
        ) : filteredReviews.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No reviews found matching the selected filter.
          </div>
        ) : (
          filteredReviews.map((review) => {
            const badge = STATUS_BADGES[review.status] || STATUS_BADGES.open;

            return (
              <div
                key={review.id}
                onClick={() => setSelectedReviewId(review.id)}
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.45rem',
                        borderRadius: 'var(--radius-sm)',
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>

                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {review.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        padding: '0.05rem 0.35rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {review.targetType}: {review.targetRef}
                    </span>
                    <span>Opened by @{review.creator?.username}</span>
                    <span>•</span>
                    <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Decisions Summary */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                    {review.decisionsCount.approved > 0 && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          color: 'var(--status-success)',
                          fontWeight: 600,
                        }}
                      >
                        <IconThumbUp size={12} />
                        {review.decisionsCount.approved}
                      </span>
                    )}

                    {review.decisionsCount.changesRequested > 0 && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          color: 'var(--status-danger)',
                          fontWeight: 600,
                        }}
                      >
                        <IconAlertTriangle size={12} />
                        {review.decisionsCount.changesRequested}
                      </span>
                    )}
                  </div>

                  {review.commentsCount !== undefined && review.commentsCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <IconMessageSquare size={14} />
                      <span>{review.commentsCount}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateReviewModal
          projectId={projectId}
          members={members}
          branches={branches}
          artifacts={artifacts}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['projectReviews', projectId] });
          }}
        />
      )}

      {selectedReviewId && (
        <ReviewDetailModal
          projectId={projectId}
          reviewId={selectedReviewId}
          members={members}
          onClose={() => setSelectedReviewId(null)}
          onReviewUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['projectReviews', projectId] });
          }}
        />
      )}
    </div>
  );
};
