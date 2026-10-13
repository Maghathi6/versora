import React, { useState, useEffect } from 'react';
import { ImpactAnalysisResponse, ImpactAnalysisItem } from '../../types/intelligence';
import { intelligenceService } from '../../services/intelligenceService';
import { Button } from '../common/Button';
import { Badge, BadgeVariant } from '../common/Badge';
import { IconSparkles } from '../common/Icons';

interface ImpactAnalysisCardProps {
  projectId: string;
  hasWorkingTreeChanges: boolean;
  onInspectArtifact?: (artifactId: string) => void;
}

export const ImpactAnalysisCard: React.FC<ImpactAnalysisCardProps> = ({
  projectId,
  hasWorkingTreeChanges,
  onInspectArtifact,
}) => {
  const [impactData, setImpactData] = useState<ImpactAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'reviewed'>('all');

  const fetchImpact = async () => {
    if (!hasWorkingTreeChanges) {
      setImpactData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await intelligenceService.getImpactAnalysis(projectId);
      setImpactData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to compute change-impact analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImpact();
  }, [projectId, hasWorkingTreeChanges]);

  if (!hasWorkingTreeChanges) {
    return null;
  }

  const handleReviewAction = async (impactKey: string, status: 'reviewed' | 'dismissed') => {
    setUpdatingKey(impactKey);
    try {
      await intelligenceService.updateImpactReview(projectId, {
        impactKey,
        status,
      });
      await fetchImpact();
    } catch (err: any) {
      alert(err.message || 'Failed to update review status.');
    } finally {
      setUpdatingKey(null);
    }
  };

  const getSeverityBadgeVariant = (severity: ImpactAnalysisItem['severity']): BadgeVariant => {
    switch (severity) {
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getRelationshipBadgeVariant = (type: string): BadgeVariant => {
    switch (type) {
      case 'depends_on':
        return 'warning';
      case 'tests':
        return 'success';
      case 'documents':
        return 'info';
      case 'generated_from':
        return 'brand';
      default:
        return 'neutral';
    }
  };

  const filteredItems =
    impactData?.items.filter((item) => {
      if (filter === 'active') return item.status === 'active';
      if (filter === 'reviewed') return item.status === 'reviewed' || item.status === 'dismissed';
      return true;
    }) || [];

  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color, #334155)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-primary-light, #818cf8)',
            }}
          >
            <IconSparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Rule-Based Change Impact Analysis
              </h3>
              <Badge variant="brand">
                {impactData ? `${impactData.impactCount} Potential Impacts` : 'Analyzing'}
              </Badge>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Explainable graph inspection comparing pending Git changes with artifact relationships
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#0f172a', padding: '0.25rem', borderRadius: '6px' }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                background: filter === 'all' ? '#334155' : 'transparent',
                color: filter === 'all' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              All ({impactData?.items.length || 0})
            </button>
            <button
              onClick={() => setFilter('active')}
              style={{
                background: filter === 'active' ? '#334155' : 'transparent',
                color: filter === 'active' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Action Required ({impactData?.items.filter((i) => i.status === 'active').length || 0})
            </button>
            <button
              onClick={() => setFilter('reviewed')}
              style={{
                background: filter === 'reviewed' ? '#334155' : 'transparent',
                color: filter === 'reviewed' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Reviewed ({impactData?.items.filter((i) => i.status !== 'active').length || 0})
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={fetchImpact} disabled={isLoading}>
            {isLoading ? 'Checking...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Notice Banner */}
      <div
        style={{
          padding: '0.65rem 1.5rem',
          backgroundColor: 'rgba(99, 102, 241, 0.06)',
          borderBottom: '1px solid var(--border-color, #334155)',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>
          ℹ️ <strong>Rule-based potential impact:</strong> Suggests artifacts needing review based
          on your established relationship graph. Not guaranteed semantic code breakage.
        </span>
        {impactData?.generatedAt && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
            Updated: {new Date(impactData.generatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Body / Impact Items */}
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Evaluating relationship graph against modified Git artifacts...
          </div>
        ) : error ? (
          <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>
        ) : filteredItems.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              borderRadius: '8px',
              border: '1px dashed var(--border-color, #334155)',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            {impactData?.impactCount === 0
              ? 'No established relationships connect to the currently modified files. No cross-artifact impacts detected.'
              : 'No impact items matching the selected filter.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredItems.map((item) => (
              <div
                key={item.impactKey}
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                  border:
                    item.status === 'reviewed'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : item.status === 'dismissed'
                      ? '1px solid rgba(100, 116, 139, 0.3)'
                      : '1px solid var(--border-color, #334155)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Item Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Badge variant={getSeverityBadgeVariant(item.severity)}>
                      {item.severity.toUpperCase()} IMPACT
                    </Badge>
                    <Badge variant={getRelationshipBadgeVariant(item.relationshipType)}>
                      {item.relationshipType.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {item.status !== 'active' && (
                      <Badge variant={item.status === 'reviewed' ? 'success' : 'neutral'}>
                        {item.status.toUpperCase()}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {item.status === 'active' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingKey === item.impactKey}
                          onClick={() => handleReviewAction(item.impactKey, 'reviewed')}
                        >
                          Mark Reviewed
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingKey === item.impactKey}
                          onClick={() => handleReviewAction(item.impactKey, 'dismissed')}
                        >
                          Dismiss
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingKey === item.impactKey}
                        onClick={() => handleReviewAction(item.impactKey, 'reviewed')}
                      >
                        Re-evaluate
                      </Button>
                    )}

                    {onInspectArtifact && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onInspectArtifact(item.affectedArtifact.id)}
                      >
                        Inspect Artifact
                      </Button>
                    )}
                  </div>
                </div>

                {/* Explanation Reason */}
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {item.reason}
                </p>

                {/* Provenance details */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                  }}
                >
                  <span>
                    Changed:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {item.changedArtifact.path}
                    </strong>{' '}
                    ({item.changedArtifact.changeType})
                  </span>
                  <span>→</span>
                  <span>
                    Potentially Affected:{' '}
                    <strong style={{ color: 'var(--brand-primary-light, #818cf8)' }}>
                      {item.affectedArtifact.path}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
