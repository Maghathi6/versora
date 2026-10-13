import React, { useState, useEffect, useRef } from 'react';
import { workflowService } from '../../services/workflowService';
import { ProjectSearchResponse, SearchCategory } from '../../types/workflow';
import { Badge } from '../common/Badge';
import {
  IconClose,
  IconFolder,
  IconFileText,
  IconTasks,
  IconReviews,
  IconGitCommit,
} from '../common/Icons';

interface OmniSearchModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onSelectArtifact?: (artifactId: string) => void;
  onNavigateTab?: (tab: 'files' | 'tasks' | 'reviews' | 'history') => void;
}

export const OmniSearchModal: React.FC<OmniSearchModalProps> = ({
  isOpen,
  projectId,
  onClose,
  onSelectArtifact,
  onNavigateTab,
}) => {
  const [query, setQuery] = useState<string>('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [results, setResults] = useState<ProjectSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await workflowService.searchProject(projectId, query.trim(), category);
        setResults(res);
      } catch {
        // error handling
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [projectId, query, category]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artifacts, tasks, reviews, and commits... (ESC to close)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              color: 'var(--text-primary)',
            }}
          />
          {isLoading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Searching...</span>}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '0.25rem',
            }}
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Categories Tab Bar */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.5rem 1.25rem',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
          }}
        >
          {(['all', 'artifacts', 'tasks', 'reviews', 'commits'] as SearchCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                background: category === cat ? 'var(--brand-primary)' : 'transparent',
                color: category === cat ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.6rem',
                cursor: 'pointer',
                fontWeight: category === cat ? 700 : 500,
                textTransform: 'capitalize',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {!query.trim() || query.trim().length < 2 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Type at least 2 characters to search across files, tasks, reviews, and commit history.
            </div>
          ) : results && results.totalCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No results found for "{query}".
            </div>
          ) : results ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Artifacts */}
              {results.artifacts.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Artifacts & Files ({results.artifacts.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {results.artifacts.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => {
                          if (onSelectArtifact) onSelectArtifact(a.id);
                          if (onNavigateTab) onNavigateTab('files');
                          onClose();
                        }}
                        style={{
                          padding: '0.55rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {a.type === 'folder' ? <IconFolder size={15} /> : <IconFileText size={15} />}
                          <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.path}</span>
                        </div>
                        <Badge variant="neutral">{a.artifactType}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks */}
              {results.tasks.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Tasks ({results.tasks.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {results.tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (onNavigateTab) onNavigateTab('tasks');
                          onClose();
                        }}
                        style={{
                          padding: '0.55rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <IconTasks size={15} />
                          <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t.title}</span>
                        </div>
                        <Badge variant={t.priority === 'urgent' ? 'danger' : 'brand'}>{t.priority.toUpperCase()}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews */}
              {results.reviews.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Reviews ({results.reviews.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {results.reviews.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          if (onNavigateTab) onNavigateTab('reviews');
                          onClose();
                        }}
                        style={{
                          padding: '0.55rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <IconReviews size={15} />
                          <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 600 }}>{r.title}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.targetRef}</span>
                        </div>
                        <Badge variant="warning">{r.status.toUpperCase()}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commits */}
              {results.commits.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Commits ({results.commits.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {results.commits.map((c) => (
                      <div
                        key={c.hash}
                        onClick={() => {
                          if (onNavigateTab) onNavigateTab('history');
                          onClose();
                        }}
                        style={{
                          padding: '0.55rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <IconGitCommit size={15} />
                          <code style={{ fontSize: '0.78rem', color: 'var(--brand-primary-light)' }}>{c.shortHash}</code>
                          <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{c.message}</span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{c.author}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
