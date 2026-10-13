import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectActivityItem } from '../../types/intelligence';
import { intelligenceService } from '../../services/intelligenceService';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { IconActivity, IconSparkles } from '../common/Icons';

interface ProjectActivityTimelineProps {
  projectId: string;
}

const PAGE_SIZE = 50;

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'artifact', label: 'Artifacts' },
  { id: 'git', label: 'Git' },
  { id: 'github', label: 'GitHub' },
  { id: 'relationship', label: 'Connections' },
];

export const ProjectActivityTimeline: React.FC<ProjectActivityTimelineProps> = ({ projectId }) => {
  const [activities, setActivities] = useState<ProjectActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Request race condition guard: track latest request ID
  const latestRequestIdRef = useRef<number>(0);

  const fetchActivities = useCallback(
    async (isRefresh = false) => {
      const requestId = ++latestRequestIdRef.current;
      setIsLoading(true);
      setError(null);
      if (!isRefresh) {
        setActivities([]); // Clear stale activities when switching category
      }

      try {
        const entityType = selectedCategory !== 'all' ? selectedCategory : undefined;
        const data = await intelligenceService.listActivities(projectId, PAGE_SIZE, entityType, 0);

        // Only update if this is still the active request
        if (requestId === latestRequestIdRef.current) {
          setActivities(data);
          setHasMore(data.length === PAGE_SIZE);
        }
      } catch (err: any) {
        if (requestId === latestRequestIdRef.current) {
          setError(err.message || 'Failed to load project activity records.');
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [projectId, selectedCategory]
  );

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const entityType = selectedCategory !== 'all' ? selectedCategory : undefined;
      const data = await intelligenceService.listActivities(
        projectId,
        PAGE_SIZE,
        entityType,
        activities.length
      );

      setActivities((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err.message || 'Failed to load additional activity records.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getEventBadge = (eventType: string, entityType: string) => {
    switch (entityType) {
      case 'artifact': {
        const action = eventType.replace('artifact.', '').replace('_', ' ').toUpperCase();
        return { label: action, variant: 'brand' as const };
      }
      case 'git': {
        const action = eventType.replace('git.', '').replace('_', ' ').toUpperCase();
        return { label: action, variant: 'success' as const };
      }
      case 'github': {
        const action = eventType.replace('github.', '').replace('_', ' ').toUpperCase();
        return {
          label: action,
          variant: eventType.includes('fail') ? ('danger' as const) : ('info' as const),
        };
      }
      case 'relationship': {
        const action = eventType.replace('relationship.', '').replace('_', ' ').toUpperCase();
        return { label: action, variant: 'warning' as const };
      }
      default:
        return { label: eventType.toUpperCase(), variant: 'neutral' as const };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const currentCategoryLabel =
    CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'All';

  return (
    <div className="card" style={{ padding: '1.75rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-color, #334155)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-primary-light, #818cf8)',
            }}
          >
            <IconActivity size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              Project Activity Timeline
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Real-time audit log of file changes, Git commits, GitHub syncs, and relationships
            </p>
          </div>
        </div>

        {/* Filter categories & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              padding: '0.25rem',
              border: '1px solid var(--border-color, #334155)',
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  background: selectedCategory === cat.id ? '#334155' : 'transparent',
                  color: selectedCategory === cat.id ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: selectedCategory === cat.id ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchActivities(true)}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh Feed'}
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading project activity log...
        </div>
      ) : error ? (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            borderRadius: '12px',
            border: '1px dashed var(--border-color, #334155)',
            color: 'var(--text-secondary)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-primary, #6366f1)',
              margin: '0 auto 1rem auto',
            }}
          >
            <IconSparkles size={22} />
          </div>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
            {selectedCategory === 'all'
              ? 'No Activity Recorded Yet'
              : `No ${currentCategoryLabel} Activity Found`}
          </h4>
          <p style={{ margin: 0, fontSize: '0.875rem', maxWidth: '450px', marginInline: 'auto' }}>
            {selectedCategory === 'all'
              ? 'Operations like creating and uploading files, saving in Monaco, committing with Git, pushing to GitHub, or connecting artifacts will appear in this timeline.'
              : `There is no recorded activity in the '${currentCategoryLabel}' category for this project yet. Try switching to 'All' or perform a relevant action.`}
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
          {/* Vertical timeline rule */}
          <div
            style={{
              position: 'absolute',
              top: '0.5rem',
              bottom: '0.5rem',
              left: '5px',
              width: '2px',
              backgroundColor: 'var(--border-color, #334155)',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activities.map((item) => {
              const badge = getEventBadge(item.eventType, item.entityType);
              const isExpanded = expandedId === item.id;

              return (
                <div key={item.id} style={{ position: 'relative' }}>
                  {/* Timeline dot */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '-1.5rem',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--brand-primary, #6366f1)',
                      border: '2px solid var(--surface-color, #1e293b)',
                      transform: 'translateX(-5px)',
                    }}
                  />

                  {/* Activity Card */}
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      borderRadius: '10px',
                      backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                      border: '1px solid var(--border-color, #334155)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.summary}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {item.actorUsername && (
                          <span>
                            by <strong>@{item.actorUsername}</strong>
                          </span>
                        )}
                        <span>•</span>
                        <span title={new Date(item.createdAt).toLocaleString()}>
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Metadata details */}
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--brand-primary-light, #818cf8)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {isExpanded ? 'Hide Details ▲' : 'Show Details ▼'}
                        </button>

                        {isExpanded && (
                          <div
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '6px',
                              backgroundColor: '#020617',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              maxHeight: '180px',
                              overflowY: 'auto',
                            }}
                          >
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {JSON.stringify(item.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination Load More */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading more activities...' : 'Load More Activities'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
