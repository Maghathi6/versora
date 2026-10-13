import React, { useState, useId } from 'react';
import { ArtifactItem } from '../../types/artifact';
import { RelationshipType } from '../../types/intelligence';
import { intelligenceService } from '../../services/intelligenceService';
import { Button } from '../common/Button';
import { IconClose, IconSparkles } from '../common/Icons';

interface ArtifactRelationshipModalProps {
  projectId: string;
  sourceArtifact: ArtifactItem;
  allArtifacts: ArtifactItem[];
  isOpen: boolean;
  onClose: () => void;
  onRelationshipCreated: () => void;
}

const RELATIONSHIP_OPTIONS: Array<{
  type: RelationshipType;
  label: string;
  description: string;
  badgeVariant: 'brand' | 'success' | 'warning' | 'info' | 'neutral';
}> = [
  {
    type: 'depends_on',
    label: 'Depends On',
    description: 'This artifact relies on the target artifact for functionality or compilation.',
    badgeVariant: 'warning',
  },
  {
    type: 'tests',
    label: 'Tests',
    description: 'This artifact acts as a test suite or verification harness for the target.',
    badgeVariant: 'success',
  },
  {
    type: 'documents',
    label: 'Documents',
    description: 'This artifact provides documentation, guides, or specifications for the target.',
    badgeVariant: 'info',
  },
  {
    type: 'generated_from',
    label: 'Generated From',
    description: 'This artifact is a compiled or generated artifact derived from the target.',
    badgeVariant: 'brand',
  },
  {
    type: 'related_to',
    label: 'Related To',
    description: 'General associative link between related project artifacts.',
    badgeVariant: 'neutral',
  },
];

export const ArtifactRelationshipModal: React.FC<ArtifactRelationshipModalProps> = ({
  projectId,
  sourceArtifact,
  allArtifacts,
  isOpen,
  onClose,
  onRelationshipCreated,
}) => {
  const [targetArtifactId, setTargetArtifactId] = useState<string>('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('depends_on');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const targetSelectId = useId();
  const relTypeSelectId = useId();
  const descInputId = useId();

  if (!isOpen) return null;

  // Filter out self and folders to prevent self-relationships and focus on file artifacts
  const eligibleTargets = allArtifacts.filter(
    (a) => a.id !== sourceArtifact.id && a.type === 'file'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetArtifactId) {
      setError('Please select a target artifact.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await intelligenceService.createRelationship(projectId, {
        sourceArtifactId: sourceArtifact.id,
        targetArtifactId,
        relationshipType,
        description: description.trim() || null,
      });
      onRelationshipCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create artifact relationship.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOption = RELATIONSHIP_OPTIONS.find((opt) => opt.type === relationshipType);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
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
          maxWidth: '560px',
          background: 'var(--surface-color, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
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
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-primary, #6366f1)',
              }}
            >
              <IconSparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Connect Artifact
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Create an explicit traceability relationship
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Source Artifact display */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Source Artifact
            </label>
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
              }}
            >
              {sourceArtifact.path}
            </div>
          </div>

          {/* Relationship Type Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor={relTypeSelectId}
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              Relationship Type
            </label>
            <select
              id={relTypeSelectId}
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <option key={opt.type} value={opt.type}>
                  {opt.label} ({opt.type})
                </option>
              ))}
            </select>
            {selectedOption && (
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {selectedOption.description}
              </p>
            )}
          </div>

          {/* Target Artifact Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor={targetSelectId}
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              Target Artifact (Destination)
            </label>
            <select
              id={targetSelectId}
              value={targetArtifactId}
              onChange={(e) => setTargetArtifactId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
              required
            >
              <option value="">-- Choose target artifact --</option>
              {eligibleTargets.map((art) => (
                <option key={art.id} value={art.id}>
                  {art.path} ({art.artifactType})
                </option>
              ))}
            </select>
            {eligibleTargets.length === 0 && (
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem', color: '#f59e0b' }}>
                No other file artifacts exist in this project to link with.
              </p>
            )}
          </div>

          {/* Optional Notes */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor={descInputId}
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              Relationship Notes (Optional)
            </label>
            <textarea
              id={descInputId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Verifies export function contracts; regenerated on schema updates"
              rows={2}
              maxLength={1000}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-color-subtle, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting || !targetArtifactId || eligibleTargets.length === 0}
            >
              {isSubmitting ? 'Connecting...' : 'Establish Connection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
