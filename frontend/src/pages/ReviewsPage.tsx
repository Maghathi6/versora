import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/common/PageHeader';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  IconReviews,
  IconThumbUp,
  IconAlertTriangle,
  IconArrowRight,
  IconProjects,
} from '../components/common/Icons';
import { projectService } from '../services/projectService';
import { collaborationService } from '../services/collaborationService';
import { ProjectReviewItem } from '../types/collaboration';
import { Project } from '../types/project';

interface ProjectWithReviews {
  projectId: string;
  projectName: string;
  reviews: ProjectReviewItem[];
}

export const ReviewsPage: React.FC = () => {
  const navigate = useNavigate();

  // Load user's projects
  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ['userProjects'],
    queryFn: () => projectService.getProjects(),
  });

  // Load reviews across user's projects
  const { data: projectsWithReviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ['allProjectReviews', projects.map((p: Project) => p.id)],
    queryFn: async () => {
      const results: ProjectWithReviews[] = [];
      for (const p of projects) {
        try {
          const revs = await collaborationService.listReviews(p.id);
          if (revs.length > 0) {
            results.push({
              projectId: p.id,
              projectName: p.name,
              reviews: revs,
            });
          }
        } catch {
          // Ignore projects user doesn't have review read permissions for
        }
      }
      return results;
    },
    enabled: projects.length > 0,
  });

  const totalReviewsCount = projectsWithReviews.reduce((sum, p) => sum + p.reviews.length, 0);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Reviews & Approvals"
        subtitle="Inspect pending peer reviews, track reviewer decisions, and manage change requests."
        badge={<Badge variant="neutral">{totalReviewsCount} Total Reviews</Badge>}
      />

      {loadingProjects || loadingReviews ? (
        <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading review requests...
        </div>
      ) : projectsWithReviews.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <IconReviews size={36} style={{ opacity: 0.35, marginBottom: '0.85rem' }} />
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            No Active Reviews Found
          </h3>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            You do not have any open review requests. You can request reviews on any branch or artifact within your project workspaces.
          </p>
          <Button variant="primary" onClick={() => navigate('/projects')}>
            <IconProjects size={16} />
            <span>Go to Projects</span>
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {projectsWithReviews.map((group) => (
            <div
              key={group.projectId}
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconProjects size={18} color="var(--brand-primary-light)" />
                  <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {group.projectName}
                  </span>
                  <Badge variant="neutral">{group.reviews.length} reviews</Badge>
                </div>

                <Link
                  to={`/projects/${group.projectId}?tab=reviews`}
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--brand-primary-light)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: 500,
                  }}
                >
                  <span>Open workspace reviews</span>
                  <IconArrowRight size={14} />
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {group.reviews.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/projects/${group.projectId}?tab=reviews`)}
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '1rem',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.1rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            background:
                              r.status === 'approved'
                                ? 'var(--status-success-bg)'
                                : r.status === 'changes_requested'
                                  ? 'var(--status-danger-bg)'
                                  : 'var(--status-info-bg)',
                            color:
                              r.status === 'approved'
                                ? 'var(--status-success)'
                                : r.status === 'changes_requested'
                                  ? 'var(--status-danger)'
                                  : 'var(--status-info)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {r.title}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.targetType}: {r.targetRef} • Opened by @{r.creator?.username}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                      {r.decisionsCount.approved > 0 && (
                        <span style={{ color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <IconThumbUp size={12} /> {r.decisionsCount.approved}
                        </span>
                      )}
                      {r.decisionsCount.changesRequested > 0 && (
                        <span style={{ color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <IconAlertTriangle size={12} /> {r.decisionsCount.changesRequested}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
