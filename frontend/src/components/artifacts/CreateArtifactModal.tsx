import React, { useState, useEffect, useId } from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { IconClose, IconFileText, IconAlertCircle } from '../common/Icons';

interface CreateArtifactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, content?: string) => Promise<void>;
  isSubmitting: boolean;
  currentFolderPath: string;
  existingNames: string[];
}

const ILLEGAL_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1F]/;

/**
 * Returns a human-friendly description of the file type based on extension.
 */
function getFileTypeHint(filename: string): { label: string; editable: boolean } | null {
  const ext = filename.lastIndexOf('.') !== -1 ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
  if (!ext) return null;

  switch (ext) {
    case '.ts':
    case '.tsx':
      return { label: 'TypeScript Code', editable: true };
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return { label: 'JavaScript Code', editable: true };
    case '.py':
      return { label: 'Python Script', editable: true };
    case '.json':
      return { label: 'JSON Data', editable: true };
    case '.md':
    case '.markdown':
      return { label: 'Markdown Document', editable: true };
    case '.html':
    case '.htm':
      return { label: 'HTML Markup', editable: true };
    case '.css':
    case '.scss':
    case '.less':
      return { label: 'CSS Stylesheet', editable: true };
    case '.sql':
      return { label: 'SQL Query', editable: true };
    case '.sh':
    case '.bash':
      return { label: 'Shell Script', editable: true };
    case '.yaml':
    case '.yml':
      return { label: 'YAML Config', editable: true };
    case '.txt':
      return { label: 'Plain Text', editable: true };
    case '.csv':
    case '.tsv':
      return { label: 'Tabular Data', editable: true };
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
    case '.webp':
      return { label: 'Image (Binary / Preview)', editable: false };
    case '.pdf':
      return { label: 'PDF Document (Preview)', editable: false };
    default:
      return { label: 'General File', editable: true };
  }
}

export const CreateArtifactModal: React.FC<CreateArtifactModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isSubmitting,
  currentFolderPath,
  existingNames,
}) => {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [showContentEditor, setShowContentEditor] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputId = useId();
  const contentInputId = useId();

  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setContent('');
      setShowContentEditor(false);
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateInput = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'File name cannot be empty.';
    }
    if (trimmed === '.' || trimmed === '..') {
      return "File name cannot be '.' or '..'.";
    }
    if (trimmed.length > 255) {
      return 'File name must not exceed 255 characters.';
    }
    if (ILLEGAL_CHARS_REGEX.test(trimmed)) {
      return 'File name cannot contain invalid characters (/, \\, :, *, ?, ", <, >, |).';
    }
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      return `A file or folder named "${trimmed}" already exists in this directory.`;
    }
    return null;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setFileName(nextVal);
    if (validationError) {
      setValidationError(validateInput(nextVal));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateInput(fileName);
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      await onCreate(fileName.trim(), content);
    } catch {
      // Error handled by caller
    }
  };

  const typeHint = getFileTypeHint(fileName.trim());
  const hasExtension = fileName.trim().includes('.') && fileName.trim().lastIndexOf('.') < fileName.trim().length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 11, 17, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="card"
        style={{
          maxWidth: '520px',
          width: '100%',
          background: 'var(--bg-surface-elevated, #161f30)',
          border: '1px solid var(--border-medium, #334155)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-medium, #334155)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-primary-light, #818cf8)',
              }}
            >
              <IconFileText size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Create New Artifact
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Location: <strong style={{ color: 'var(--text-secondary)' }}>{currentFolderPath || '/ (Root)'}</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            disabled={isSubmitting}
            title="Close modal"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Validation / Server Error Banner */}
          {validationError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.85rem',
                marginBottom: '1.25rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              <IconAlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{validationError}</span>
            </div>
          )}

          {/* Artifact Name Input */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <label htmlFor={nameInputId} style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                Artifact Name & Extension
              </label>
              {typeHint && (
                <Badge variant={typeHint.editable ? 'brand' : 'neutral'}>
                  {typeHint.label}
                </Badge>
              )}
            </div>

            <input
              id={nameInputId}
              type="text"
              placeholder="e.g. index.ts, main.py, config.json, readme.md"
              value={fileName}
              onChange={handleNameChange}
              maxLength={255}
              autoFocus
              required
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.7rem 0.9rem',
                background: 'var(--bg-app, #0b1120)',
                border: validationError ? '1px solid #ef4444' : '1px solid var(--border-medium, #334155)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '0.92rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>
                Include file extension (e.g. <code>.ts</code>, <code>.py</code>, <code>.md</code>) for editor syntax.
              </span>
              {!hasExtension && fileName.trim().length > 0 && (
                <span style={{ color: '#fbbf24' }}>No extension provided</span>
              )}
            </div>
          </div>

          {/* Collapsible Initial Content Option */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setShowContentEditor(!showContentEditor)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--brand-primary-light, #818cf8)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>{showContentEditor ? '− Hide Initial Content' : '+ Add Initial Content (Optional)'}</span>
            </button>

            {showContentEditor && (
              <div style={{ marginTop: '0.65rem' }}>
                <label htmlFor={contentInputId} style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Initial Text Content
                </label>
                <textarea
                  id={contentInputId}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter initial code or text content here..."
                  rows={4}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-app, #0b1120)',
                    border: '1px solid var(--border-medium, #334155)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting || !fileName.trim()}>
              {isSubmitting ? 'Creating...' : 'Create & Open File'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
