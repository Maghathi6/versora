import React, { useState } from 'react';
import { AssistantMessage, EvidenceReference } from '../../types/assistant';
import {
  IconSparkles,
  IconGitCommit,
  IconTasks,
  IconReviews,
  IconFileText,
  IconAlertTriangle,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
} from '../common/Icons';

interface AssistantMessageBubbleProps {
  message: AssistantMessage;
  onNavigateToArtifact?: (pathOrId: string) => void;
  onNavigateToCommit?: (hash: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToReview?: (reviewId: string) => void;
}

export const AssistantMessageBubble: React.FC<AssistantMessageBubbleProps> = ({
  message,
  onNavigateToArtifact,
  onNavigateToCommit,
  onNavigateToTask,
  onNavigateToReview,
}) => {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCitationClick = (type: string, id: string) => {
    if (type === 'artifact' && onNavigateToArtifact) {
      onNavigateToArtifact(id);
    } else if (type === 'commit' && onNavigateToCommit) {
      onNavigateToCommit(id);
    } else if (type === 'task' && onNavigateToTask) {
      onNavigateToTask(id);
    } else if (type === 'review' && onNavigateToReview) {
      onNavigateToReview(id);
    }
  };

  const formatSourceIcon = (type: EvidenceReference['type']) => {
    switch (type) {
      case 'artifact':
        return <IconFileText size={13} style={{ color: 'var(--brand-trace-light)' }} />;
      case 'commit':
        return <IconGitCommit size={13} style={{ color: 'var(--status-warning)' }} />;
      case 'task':
        return <IconTasks size={13} style={{ color: 'var(--status-success)' }} />;
      case 'review':
        return <IconReviews size={13} style={{ color: 'var(--brand-primary-light)' }} />;
      default:
        return <IconSparkles size={13} style={{ color: 'var(--brand-primary-light)' }} />;
    }
  };

  // Separate reasoning / thinking process if present
  let rawContent = message.content || '';
  let extractedReasoning = (message.metadata?.reasoning as string) || '';

  if (!extractedReasoning) {
    const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      extractedReasoning = thinkMatch[1].trim();
      rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    } else if (rawContent.startsWith('Thinking Process:\n')) {
      const parts = rawContent.split(/\n\n(?=[A-Z0-9])/);
      if (parts.length > 1) {
        extractedReasoning = parts[0].trim();
        rawContent = parts.slice(1).join('\n\n').trim();
      }
    }
  }

  // Parse markdown formatting into React elements
  const renderFormattedMarkdown = (text: string) => {
    if (!text) return null;

    // Split text into code blocks and normal text
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim().match(/^[a-zA-Z0-9_-]+$/) ? lines[0].trim() : '';
        const code = (lang ? lines.slice(1) : lines).join('\n');
        const codeId = `code-${index}`;

        return (
          <div key={index} style={{ position: 'relative', margin: '0.85rem 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.35rem 0.75rem',
                background: '#090d16',
                borderTopLeftRadius: 'var(--radius-md)',
                borderTopRightRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                borderBottom: 'none',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              <span>{lang || 'code'}</span>
              <button
                type="button"
                onClick={() => handleCopyCode(code, codeId)}
                className="btn-icon-subtle"
                style={{ width: 'auto', padding: '0.15rem 0.5rem', gap: '0.3rem', fontSize: '0.72rem' }}
                title="Copy code"
              >
                {copiedCodeId === codeId ? (
                  <>
                    <IconCheck size={12} style={{ color: 'var(--status-success)' }} />
                    <span style={{ color: 'var(--status-success)' }}>Copied</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              }}
            >
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Normal text: handle paragraphs, headers, bullet points, and inline citations
      const paragraphs = part.split(/\n\n+/);
      return (
        <React.Fragment key={index}>
          {paragraphs.map((para, pIdx) => {
            const trimmed = para.trim();
            if (!trimmed) return null;

            // Headings
            if (trimmed.startsWith('### ')) {
              return <h3 key={pIdx}>{renderInlineElements(trimmed.replace(/^###\s+/, ''))}</h3>;
            }
            if (trimmed.startsWith('## ')) {
              return <h2 key={pIdx}>{renderInlineElements(trimmed.replace(/^##\s+/, ''))}</h2>;
            }
            if (trimmed.startsWith('# ')) {
              return <h1 key={pIdx}>{renderInlineElements(trimmed.replace(/^#\s+/, ''))}</h1>;
            }

            // Bullet Lists
            if (trimmed.includes('\n- ') || trimmed.startsWith('- ') || trimmed.includes('\n* ') || trimmed.startsWith('* ')) {
              const lines = trimmed.split('\n');
              return (
                <ul key={pIdx}>
                  {lines.map((line, lIdx) => {
                    const cleanLine = line.replace(/^[-*]\s+/, '').trim();
                    if (!cleanLine) return null;
                    return <li key={lIdx}>{renderInlineElements(cleanLine)}</li>;
                  })}
                </ul>
              );
            }

            // Numbered Lists
            if (/^\d+\.\s+/.test(trimmed)) {
              const lines = trimmed.split('\n');
              return (
                <ol key={pIdx}>
                  {lines.map((line, lIdx) => {
                    const cleanLine = line.replace(/^\d+\.\s+/, '').trim();
                    if (!cleanLine) return null;
                    return <li key={lIdx}>{renderInlineElements(cleanLine)}</li>;
                  })}
                </ol>
              );
            }

            return <p key={pIdx}>{renderInlineElements(trimmed)}</p>;
          })}
        </React.Fragment>
      );
    });
  };

  // Parse inline elements (bold, italic, inline code, and citations like [artifact:...], [commit:...])
  const renderInlineElements = (text: string) => {
    const citationRegex = /\[(artifact|commit|task|review):([^\]]+)\]/g;
    const parts = text.split(citationRegex);

    if (parts.length === 1) {
      return renderInlineFormatting(text);
    }

    const elements: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i += 3) {
      if (parts[i]) {
        elements.push(<React.Fragment key={`text-${i}`}>{renderInlineFormatting(parts[i])}</React.Fragment>);
      }
      if (i + 1 < parts.length) {
        const type = parts[i + 1];
        const id = parts[i + 2];
        elements.push(
          <button
            key={`cit-${i}`}
            type="button"
            onClick={() => handleCitationClick(type, id)}
            className="citation-chip"
            style={{ display: 'inline-flex', verticalAlign: 'baseline', margin: '0 0.2rem' }}
            title={`View ${type}: ${id}`}
          >
            {formatSourceIcon(type as any)}
            <code>{id}</code>
          </button>
        );
      }
    }
    return elements;
  };

  const renderInlineFormatting = (text: string) => {
    // Process inline code `...`
    const codeParts = text.split(/(`[^`]+`)/g);
    return codeParts.map((sub, sIdx) => {
      if (sub.startsWith('`') && sub.endsWith('`') && sub.length > 2) {
        return <code key={sIdx}>{sub.slice(1, -1)}</code>;
      }
      // Process bold **...**
      const boldParts = sub.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bSub, bIdx) => {
        if (bSub.startsWith('**') && bSub.endsWith('**') && bSub.length > 4) {
          return <strong key={bIdx}>{bSub.slice(2, -2)}</strong>;
        }
        return bSub;
      });
    });
  };

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      {/* Avatar Icon */}
      <div className="message-avatar">
        {isUser ? 'U' : <IconSparkles size={16} />}
      </div>

      {/* Message Content Area */}
      <div className="message-content-wrapper">
        <div className="message-bubble">
          {/* Copy Message Action */}
          <button
            type="button"
            onClick={handleCopyMessage}
            className="btn-copy-message"
            title="Copy message"
          >
            {copiedMessage ? (
              <IconCheck size={13} style={{ color: 'var(--status-success)' }} />
            ) : (
              <IconCopy size={13} />
            )}
          </button>

          {/* Optional Collapsible Thought Process Box */}
          {extractedReasoning && (
            <div className="reasoning-accordion">
              <div
                className="reasoning-summary"
                onClick={() => setIsReasoningOpen(!isReasoningOpen)}
              >
                {isReasoningOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                <span>Thought process ({extractedReasoning.split(/\s+/).length} words)</span>
              </div>
              {isReasoningOpen && (
                <div className="reasoning-content">
                  {extractedReasoning}
                </div>
              )}
            </div>
          )}

          {/* Formatted Markdown Content */}
          <div className="markdown-body">
            {renderFormattedMarkdown(rawContent)}
          </div>

          {/* Uncertainty Note Alert */}
          {message.uncertaintyNote && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-warning-bg)',
                border: '1px solid var(--status-warning-border)',
                color: '#fef3c7',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
            >
              <IconAlertTriangle size={15} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: '2px' }} />
              <span>{message.uncertaintyNote}</span>
            </div>
          )}

          {/* Verified Evidence Citations */}
          {isAssistant && message.sources && message.sources.length > 0 && (
            <div className="citations-container">
              <div className="citations-label">
                Verified Evidence Sources ({message.sources.length})
              </div>
              <div className="citations-chips">
                {message.sources.map((src, idx) => (
                  <button
                    key={`${src.type}-${src.identifier}-${idx}`}
                    type="button"
                    onClick={() => handleCitationClick(src.type, src.identifier)}
                    className="citation-chip"
                    title={`Inspect ${src.type}: ${src.title} (${src.identifier})`}
                  >
                    {formatSourceIcon(src.type)}
                    <code>{src.title || src.identifier}</code>
                    {src.location && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {src.location}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message Timestamp & Metadata */}
        <div className="message-meta">
          <span>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isAssistant && message.metadata && (
            <>
              <span>•</span>
              <span style={{ color: 'var(--brand-trace-light)' }}>
                {String((message.metadata as any).provider || 'grounded')}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
