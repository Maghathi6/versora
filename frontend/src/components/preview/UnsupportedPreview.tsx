import React from 'react';
import { UnsupportedPreviewResult, ArtifactItem } from '../../types/artifact';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { IconFileText, IconDownload, IconClose } from '../common/Icons';

interface UnsupportedPreviewProps {
  artifact: ArtifactItem;
  data: UnsupportedPreviewResult;
  onDownload: () => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const UnsupportedPreview: React.FC<UnsupportedPreviewProps> = ({
  artifact,
  data,
  onDownload,
  onClose,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '600px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.65rem 1rem',
          background: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-medium)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <span style={{ color: '#8b5cf6', flexShrink: 0 }}>
            <IconFileText size={18} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                }}
              >
                {artifact.name}
              </span>
              <Badge variant="neutral">Download Only</Badge>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {artifact.path} &bull; {data.formatName}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button
            variant="primary"
            size="sm"
            icon={<IconDownload size={14} />}
            onClick={onDownload}
          >
            Download File
          </Button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            title="Close inspection"
          >
            <IconClose size={18} />
          </button>
        </div>
      </div>

      {/* Main Metadata & Reason View */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 2rem',
          textAlign: 'center',
          background: 'var(--bg-surface)',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(139, 92, 246, 0.15)',
            color: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          <IconFileText size={38} />
        </div>

        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          {data.formatName}
        </h3>

        <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          {data.reason}
        </p>

        {/* Technical Specification Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            width: '100%',
            maxWidth: '680px',
            textAlign: 'left',
            padding: '1.25rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '2rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              File Size
            </span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              {formatBytes(artifact.sizeBytes)}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              MIME Type
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {artifact.mimeType || 'application/octet-stream'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Last Updated
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {new Date(artifact.updatedAt).toLocaleString()}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              SHA-256 Hash
            </span>
            <code style={{ fontSize: '0.75rem', color: 'var(--brand-trace-light)', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              {artifact.hash ? `${artifact.hash.slice(0, 16)}...` : 'Computed on storage'}
            </code>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="primary"
            size="lg"
            icon={<IconDownload size={18} />}
            onClick={onDownload}
          >
            Download File ({formatBytes(artifact.sizeBytes)})
          </Button>
          <Button variant="outline" size="lg" onClick={onClose}>
            Back to Workspace
          </Button>
        </div>
      </div>
    </div>
  );
};
