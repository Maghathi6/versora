import React from 'react';
import { DocxPreviewResult, ArtifactItem } from '../../types/artifact';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { IconFileText, IconDownload, IconClose } from '../common/Icons';

interface DocxPreviewProps {
  artifact: ArtifactItem;
  data: DocxPreviewResult;
  onDownload: () => void;
  onClose: () => void;
}

export const DocxPreview: React.FC<DocxPreviewProps> = ({
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
          <span style={{ color: '#3b82f6', flexShrink: 0 }}>
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
              <Badge variant="brand">Word Document</Badge>
              <Badge variant="neutral">Read-Only Preview</Badge>
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
              {artifact.path} &bull; {data.metadata.wordCount.toLocaleString()} words &bull;{' '}
              {data.metadata.charCount.toLocaleString()} characters
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button
            variant="primary"
            size="sm"
            icon={<IconDownload size={14} />}
            onClick={onDownload}
            title="Download original .docx file"
          >
            Download Word Doc
          </Button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            title="Close preview"
          >
            <IconClose size={18} />
          </button>
        </div>
      </div>

      {/* Document Body Container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          padding: '2.5rem 1.5rem',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {/* Document Page Canvas */}
        <div
          style={{
            width: '100%',
            maxWidth: '820px',
            minHeight: '700px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            padding: '3rem 3.5rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-subtle)',
            fontSize: '1rem',
            lineHeight: 1.7,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <style>{`
            .docx-content h1 { font-size: 1.85rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-primary); border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem; }
            .docx-content h2 { font-size: 1.45rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.6rem; color: var(--text-primary); }
            .docx-content h3 { font-size: 1.2rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; color: var(--text-primary); }
            .docx-content p { margin-bottom: 1rem; color: var(--text-secondary); line-height: 1.75; }
            .docx-content ul, .docx-content ol { margin-left: 1.75rem; margin-bottom: 1rem; color: var(--text-secondary); }
            .docx-content li { margin-bottom: 0.35rem; }
            .docx-content table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.92rem; }
            .docx-content th, .docx-content td { border: 1px solid var(--border-medium); padding: 0.6rem 0.85rem; text-align: left; }
            .docx-content th { background: var(--bg-surface-elevated); font-weight: 700; color: var(--text-primary); }
            .docx-content blockquote { border-left: 4px solid var(--brand-primary); margin: 1.25rem 0; padding-left: 1rem; font-style: italic; color: var(--text-muted); }
            .docx-content a { color: var(--brand-primary-light); text-decoration: underline; }
            .docx-content strong, .docx-content b { font-weight: 700; color: var(--text-primary); }
            .docx-content img { max-width: 100%; height: auto; border-radius: var(--radius-sm); margin: 1rem 0; }
          `}</style>
          <div
            className="docx-content"
            dangerouslySetInnerHTML={{ __html: data.html }}
          />
        </div>
      </div>
    </div>
  );
};
