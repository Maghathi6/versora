import React, { useState, useEffect } from 'react';
import { ArtifactItem } from '../../types/artifact';
import { ArtifactTraceabilityData } from '../../types/intelligence';
import { intelligenceService } from '../../services/intelligenceService';
import { Button } from '../common/Button';
import { Badge, BadgeVariant } from '../common/Badge';
import { IconClose, IconSparkles } from '../common/Icons';
import { ArtifactRelationshipModal } from './ArtifactRelationshipModal';

interface ArtifactTraceabilityModalProps {
  projectId: string;
  artifact: ArtifactItem;
  allArtifacts: ArtifactItem[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToArtifact?: (artifactId: string) => void;
}

export const ArtifactTraceabilityModal: React.FC<ArtifactTraceabilityModalProps> = ({
  projectId,
  artifact,
  allArtifacts,
  isOpen,
  onClose,
  onNavigateToArtifact,
}) => {
  const [data, setData] = useState<ArtifactTraceabilityData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'relationships' | 'git'>('relationships');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [deletingRelId, setDeletingRelId] = useState<string | null>(null);

  const fetchTraceability = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await intelligenceService.getArtifactTraceability(projectId, artifact.id);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load traceability details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTraceability();
    }
  }, [isOpen, artifact.id, projectId]);

  if (!isOpen) return null;

  const handleDeleteRelationship = async (relationshipId: string) => {
    if (!window.confirm('Are you sure you want to remove this connection?')) return;
    setDeletingRelId(relationshipId);
    try {
      await intelligenceService.deleteRelationship(projectId, relationshipId);
      await fetchTraceability();
    } catch (err: any) {
      alert(err.message || 'Failed to remove relationship.');
    } finally {
      setDeletingRelId(null);
    }
  };

  const getRelBadgeVariant = (type: string): BadgeVariant => {
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

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 950,
          padding: '1rem',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="card"
          style={{
            width: '100%',
            maxWidth: '720px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface-color, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '12px',
            boxShadow: '0 25px 30px -5px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-primary, #6366f1)',
                }}
              >
                <IconSparkles size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Artifact Traceability & Provenance
                </h3>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {artifact.path}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              <IconClose size={20} />
            </button>
          </div>

          {/* Subheader / Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 1.5rem',
              borderBottom: '1px solid var(--border-color, #334155)',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setActiveTab('relationships')}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: activeTab === 'relationships' ? 700 : 500,
                  borderRadius: '6px',
                  border: 'none',
                  background:
                    activeTab === 'relationships'
                      ? 'var(--surface-color, #1e293b)'
                      : 'transparent',
                  color:
                    activeTab === 'relationships'
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Explicit Relationships (
                {(data?.outgoingRelationships.length || 0) +
                  (data?.incomingRelationships.length || 0)}
                )
              </button>
              <button
                onClick={() => setActiveTab('git')}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: activeTab === 'git' ? 700 : 500,
                  borderRadius: '6px',
                  border: 'none',
                  background:
                    activeTab === 'git'
                      ? 'var(--surface-color, #1e293b)'
                      : 'transparent',
                  color:
                    activeTab === 'git'
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Git Version History ({data?.gitHistory.length || 0})
              </button>
            </div>

            {data?.currentGitStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Working Tree:
                </span>
                <Badge
                  variant={
                    data.currentGitStatus.status === 'clean'
                      ? 'success'
                      : data.currentGitStatus.status === 'modified'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {data.currentGitStatus.status.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>

          {/* Content Body */}
          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading traceability details...
              </div>
            ) : error ? (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                }}
              >
                {error}
              </div>
            ) : activeTab === 'relationships' ? (
              <div>
                {/* Notice distinguishing explicit relationships */}
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <strong style={{ color: 'var(--brand-primary-light, #a5b4fc)' }}>
                    Explicit User-Created Relationships:
                  </strong>{' '}
                  These links represent explicit structural associations established by project
                  maintainers. They do not claim automatic semantic code parsing.
                </div>

                {/* Outgoing Connections */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                      Outgoing Connections (This file points to)
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConnectModalOpen(true)}
                    >
                      + Connect Another Artifact
                    </Button>
                  </div>

                  {data?.outgoingRelationships.length === 0 ? (
                    <div
                      style={{
                        padding: '1rem',
                        textAlign: 'center',
                        borderRadius: '8px',
                        border: '1px dashed var(--border-color, #334155)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      No outgoing relationships recorded for this artifact.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {data?.outgoingRelationships.map((rel) => (
                        <div
                          key={rel.id}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                            border: '1px solid var(--border-color, #334155)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Badge variant={getRelBadgeVariant(rel.relationshipType)}>
                              {rel.relationshipType.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <div>
                              <button
                                onClick={() =>
                                  onNavigateToArtifact && onNavigateToArtifact(rel.targetArtifactId)
                                }
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: 'var(--brand-primary-light, #818cf8)',
                                  fontWeight: 600,
                                  fontSize: '0.875rem',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                {rel.targetArtifact?.path || rel.targetArtifactId}
                              </button>
                              {rel.description && (
                                <p
                                  style={{
                                    margin: '0.2rem 0 0 0',
                                    fontSize: '0.78rem',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {rel.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="danger"
                            size="sm"
                            disabled={deletingRelId === rel.id}
                            onClick={() => handleDeleteRelationship(rel.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Incoming Connections */}
                <div>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                    Incoming Connections (Referenced by other files)
                  </h4>

                  {data?.incomingRelationships.length === 0 ? (
                    <div
                      style={{
                        padding: '1rem',
                        textAlign: 'center',
                        borderRadius: '8px',
                        border: '1px dashed var(--border-color, #334155)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      No incoming relationships reference this artifact.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {data?.incomingRelationships.map((rel) => (
                        <div
                          key={rel.id}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                            border: '1px solid var(--border-color, #334155)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Badge variant={getRelBadgeVariant(rel.relationshipType)}>
                              {rel.relationshipType.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <div>
                              <button
                                onClick={() =>
                                  onNavigateToArtifact && onNavigateToArtifact(rel.sourceArtifactId)
                                }
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: 'var(--brand-primary-light, #818cf8)',
                                  fontWeight: 600,
                                  fontSize: '0.875rem',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                {rel.sourceArtifact?.path || rel.sourceArtifactId}
                              </button>
                              {rel.description && (
                                <p
                                  style={{
                                    margin: '0.2rem 0 0 0',
                                    fontSize: '0.78rem',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {rel.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="danger"
                            size="sm"
                            disabled={deletingRelId === rel.id}
                            onClick={() => handleDeleteRelationship(rel.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {/* Git Commit History */}
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <strong style={{ color: '#10b981' }}>Authentic Git Commit History:</strong>{' '}
                  Derived directly from Git commit history touching this file path. Commits indicate
                  historical file changes, not guaranteed runtime dependencies.
                </div>

                {data?.gitHistory.length === 0 ? (
                  <div
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color, #334155)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    No commits found in Git repository history modifying this file.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {data?.gitHistory.map((commit) => (
                      <div
                        key={commit.hash}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '8px',
                          backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                          border: '1px solid var(--border-color, #334155)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.35rem',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: 'var(--brand-primary-light, #818cf8)',
                              fontSize: '0.85rem',
                            }}
                          >
                            {commit.shortHash}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(commit.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: '0 0 0.35rem 0',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {commit.message}
                        </p>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Author: {commit.author.name} &lt;{commit.author.email}&gt;
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color, #334155)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="outline" onClick={onClose}>
              Close Traceability View
            </Button>
          </div>
        </div>
      </div>

      {/* Connect Modal nested */}
      <ArtifactRelationshipModal
        projectId={projectId}
        sourceArtifact={artifact}
        allArtifacts={allArtifacts}
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onRelationshipCreated={fetchTraceability}
      />
    </>
  );
};
