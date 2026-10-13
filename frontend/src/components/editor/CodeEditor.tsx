import React, { useRef, useEffect, useState, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  IconClose,
  IconCheck,
  IconAlertCircle,
  IconLayers,
  IconSparkles,
} from '../common/Icons';

export interface CodeEditorProps {
  filename: string;
  filePath: string;
  language: string;
  initialValue: string;
  isDirty: boolean;
  isSaving: boolean;
  errorMessage?: string | null;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onSave: (currentValue?: string) => void;
  onClose: () => void;
  onDownload?: () => void;
  onAskAI?: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  filename,
  filePath,
  language,
  initialValue,
  isDirty,
  isSaving,
  errorMessage,
  readOnly = false,
  onChange,
  onSave,
  onClose,
  onDownload,
  onAskAI,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [lineCount, setLineCount] = useState<number>(1);
  const [charCount, setCharCount] = useState<number>(initialValue.length);

  // Keep latest onSave and isSaving references to prevent stale closures
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  const isSavingRef = useRef(isSaving);
  useEffect(() => {
    isSavingRef.current = isSaving;
  });

  // Calculate stats on initial load
  useEffect(() => {
    const lines = initialValue.split('\n').length;
    setLineCount(lines);
    setCharCount(initialValue.length);
  }, [initialValue]);

  // Reliable deduped save invoker
  const lastSaveTimeRef = useRef<number>(0);
  const triggerSave = useCallback(() => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 250) {
      return; // Deduplicate rapid events within 250ms
    }
    lastSaveTimeRef.current = now;
    if (isSavingRef.current || readOnly) return;
    const currentVal = editorRef.current ? editorRef.current.getValue() : undefined;
    onSaveRef.current(currentVal);
  }, [readOnly]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    // Track model content updates for stats
    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (model) {
        setLineCount(model.getLineCount());
        setCharCount(model.getValueLength());
      }
    });

    // Monaco onKeyDown listener: intercept Ctrl+S (Windows/Linux) and Cmd+S (macOS)
    editor.onKeyDown((e) => {
      const isS = e.code === 'KeyS' || e.browserEvent?.key?.toLowerCase() === 's';
      if ((e.ctrlKey || e.metaKey) && isS) {
        e.preventDefault();
        e.stopPropagation();
        triggerSave();
      }
    });

    // Register Ctrl+S / Cmd+S save command directly inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      triggerSave();
    });

    // Focus editor on load
    editor.focus();
  };

  // Global keyboard shortcut listener in capture phase (prevents browser Save Page dialog)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        triggerSave();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [triggerSave]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const val = value ?? '';
      onChange(val);
      const lines = val.split('\n').length;
      setLineCount(lines);
      setCharCount(val.length);
    },
    [onChange]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '560px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Editor Top Bar */}
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
        {/* File Identification */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <span style={{ color: 'var(--brand-primary-light)', flexShrink: 0 }}>
            <IconLayers size={18} />
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
                {filename}
              </span>

              {/* Saved vs Unsaved Indicator */}
              {isDirty ? (
                <span
                  title="You have unsaved changes"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                  Unsaved
                </span>
              ) : (
                <span
                  title="All changes saved to storage"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: 600,
                  }}
                >
                  <IconCheck size={12} />
                  Saved
                </span>
              )}
            </div>

            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filePath}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant="neutral">{language.toUpperCase()}</Badge>

          {onAskAI && (
            <Button
              variant="outline"
              size="sm"
              icon={<IconSparkles size={14} className="text-primary-400" />}
              onClick={onAskAI}
              title="Explain this file with AI Assistant"
            >
              Ask AI
            </Button>
          )}

          {onDownload && (
            <Button variant="ghost" size="sm" onClick={onDownload} title="Download current file">
              Download
            </Button>
          )}

          <Button
            variant={isDirty ? 'primary' : 'outline'}
            size="sm"
            onClick={triggerSave}
            isLoading={isSaving}
            disabled={!isDirty || readOnly || isSaving}
            title="Save changes (Ctrl+S / Cmd+S)"
          >
            {isSaving ? 'Saving...' : isDirty ? 'Save (Ctrl+S)' : 'Saved'}
          </Button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            title="Close editor"
          >
            <IconClose size={18} />
          </button>
        </div>
      </div>

      {/* Error notification if save failed */}
      {errorMessage && (
        <div
          style={{
            padding: '0.6rem 1rem',
            background: 'rgba(244, 63, 94, 0.12)',
            borderBottom: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <IconAlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Monaco Editor Container */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Editor
          height="100%"
          language={language}
          value={initialValue}
          theme="vs-dark"
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={{
            readOnly,
            fontSize: 13.5,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            renderWhitespace: 'selection',
            automaticLayout: true,
            minimap: { enabled: true, maxColumn: 80 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
          }}
          loading={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                background: '#1e1e1e',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
              }}
            >
              Loading editor environment...
            </div>
          }
        />
      </div>

      {/* Editor Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.35rem 1rem',
          background: 'rgba(0, 0, 0, 0.35)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span>{lineCount} lines</span>
          <span>{charCount} chars</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>UTF-8</span>
          <span>Spaces: 2</span>
          <span style={{ color: 'var(--brand-primary-light)' }}>Versora Editor</span>
        </div>
      </div>
    </div>
  );
};
