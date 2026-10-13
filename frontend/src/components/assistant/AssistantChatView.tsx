import React, { useState, useRef, useEffect } from 'react';
import {
  AssistantConversation,
  AssistantMessage,
  AssistantConfigResponse,
  QuickActionType,
} from '../../types/assistant';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import {
  IconSparkles,
  IconSend,
  IconAlertTriangle,
  IconGitCommit,
  IconActivity,
  IconTasks,
  IconRefreshCw,
  IconFileText,
  IconMenu,
} from '../common/Icons';

interface AssistantChatViewProps {
  conversation: AssistantConversation | null;
  messages: AssistantMessage[];
  config: AssistantConfigResponse | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  onSendMessage: (content: string) => Promise<void>;
  onTriggerQuickAction: (action: QuickActionType, targetId?: string) => Promise<void>;
  onRetryLastMessage?: () => void;
  onToggleSidebar?: () => void;
  onNavigateToArtifact?: (pathOrId: string) => void;
  onNavigateToCommit?: (hash: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToReview?: (reviewId: string) => void;
  selectedArtifactId?: string;
  selectedCommitHash?: string;
}

export const AssistantChatView: React.FC<AssistantChatViewProps> = ({
  conversation,
  messages,
  config,
  isLoading,
  isSending,
  error,
  onSendMessage,
  onTriggerQuickAction,
  onRetryLastMessage,
  onToggleSidebar,
  onNavigateToArtifact,
  onNavigateToCommit,
  onNavigateToTask,
  onNavigateToReview,
  selectedArtifactId,
  selectedCommitHash,
}) => {
  const [input, setInput] = useState('');
  const [lastDraft, setLastDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        Math.max(textareaRef.current.scrollHeight, 28),
        140
      )}px`;
    }
  }, [input]);

  // If an error happens, allow restoring previous draft
  useEffect(() => {
    if (error && lastDraft && !input) {
      setInput(lastDraft);
    }
  }, [error, lastDraft]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isSending || isLoading) return;

    const content = input.trim();
    setLastDraft(content);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await onSendMessage(content);
      setLastDraft('');
    } catch {
      // Input restored by useEffect if error is set
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isConfigured = config?.configured ?? true;
  const isOllama = config?.provider?.toLowerCase() === 'ollama';

  // 6 Essential Suggested Questions & Quick Actions
  const QUICK_ACTION_CARDS = [
    {
      action: 'project-summary' as QuickActionType,
      title: 'Project Summary',
      description: 'Comprehensive overview of repositories, artifacts, and key metadata.',
      icon: <IconSparkles size={16} style={{ color: 'var(--brand-primary-light)' }} />,
      targetId: undefined,
    },
    {
      action: 'explain-impact' as QuickActionType,
      title: 'Explain Impact',
      description: 'Analyze downstream blast radius for recent working tree changes.',
      icon: <IconActivity size={16} style={{ color: 'var(--brand-trace-light)' }} />,
      targetId: undefined,
    },
    {
      action: 'summarize-commit' as QuickActionType,
      title: 'Recent Changes',
      description: 'Review recent commits, modifications, and developer contributions.',
      icon: <IconGitCommit size={16} style={{ color: 'var(--status-warning)' }} />,
      targetId: selectedCommitHash,
    },
    {
      action: 'review-assistance' as QuickActionType,
      title: 'Review Assistance',
      description: 'Examine open peer reviews, approval statuses, and pending tasks.',
      icon: <IconTasks size={16} style={{ color: 'var(--status-success)' }} />,
      targetId: undefined,
    },
    {
      action: 'explain-artifact' as QuickActionType,
      title: selectedArtifactId ? 'Explain Selected File' : 'Explain Artifacts',
      description: 'Deep architectural walkthrough of core source files and schemas.',
      icon: <IconFileText size={16} style={{ color: 'var(--brand-trace)' }} />,
      targetId: selectedArtifactId,
    },
    {
      action: 'summarize-commit' as QuickActionType,
      title: 'Inspect Commits',
      description: 'Inspect line additions, deletions, and structural git changes.',
      icon: <IconGitCommit size={16} style={{ color: 'var(--brand-primary)' }} />,
      targetId: selectedCommitHash,
    },
  ];

  return (
    <div className="assistant-main">
      {/* Header */}
      <header className="assistant-header">
        <div className="assistant-header-left">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="btn-icon-subtle md-hide"
              title="Toggle Chats List"
              style={{ display: 'none' }}
            >
              <IconMenu size={18} />
            </button>
          )}

          <div className="assistant-avatar-badge">
            <IconSparkles size={18} />
          </div>

          <div className="assistant-header-meta">
            <h2>{conversation ? conversation.title : 'AI Project Assistant'}</h2>
            <p>Grounded in verified files, Git history, impacts, tasks, and reviews</p>
          </div>
        </div>

        {/* Truthful Provider Status Badge */}
        <div>
          {config ? (
            <span
              className={`provider-status-badge ${config.configured ? 'online' : 'offline'}`}
              title={
                isOllama
                  ? 'Local Ollama LLM provider active on Windows localhost:11434'
                  : `Configured provider: ${config.provider || 'none'}`
              }
            >
              <span className="status-dot-pulse" />
              <span>
                {config.configured
                  ? `${config.provider} (${config.model || 'active'})`
                  : 'AI Not Configured'}
              </span>
            </span>
          ) : (
            <span className="provider-status-badge">
              <IconRefreshCw size={12} className="animate-spin" />
              <span>Checking AI Provider...</span>
            </span>
          )}
        </div>
      </header>

      {/* Unconfigured Provider Guidance Banner */}
      {!isConfigured && (
        <div className="assistant-banner warning">
          <IconAlertTriangle size={18} style={{ color: 'var(--status-warning)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              AI Model Provider Not Configured
            </strong>
            <p style={{ marginBottom: '0.5rem' }}>
              To enable assistant responses, configure local Ollama or an API key in your <code>backend/.env</code>:
            </p>
            <div
              style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--brand-trace-light)',
                lineHeight: 1.5,
              }}
            >
              <div>AI_PROVIDER=ollama</div>
              <div>AI_MODEL=qwen3.5:4b</div>
              <div>AI_BASE_URL=http://localhost:11434/v1</div>
            </div>
            <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Make sure Ollama is running on your machine (e.g. run <code>ollama serve</code> in Command Prompt).
            </p>
          </div>
        </div>
      )}

      {/* Error Alert Banner */}
      {error && (
        <div className="assistant-banner danger">
          <IconAlertTriangle size={18} style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
              Assistant Generation Error
            </strong>
            <span>{error}</span>
          </div>
          {onRetryLastMessage && (
            <div className="assistant-banner-actions">
              <button
                type="button"
                onClick={onRetryLastMessage}
                className="btn-retry-sm"
                style={{ background: 'rgba(244, 63, 94, 0.2)', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#ffffff' }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="assistant-messages-scroll">
        {isLoading ? (
          <div className="sidebar-state-box" style={{ margin: 'auto' }}>
            <IconRefreshCw size={26} className="animate-spin" style={{ color: 'var(--brand-primary-light)' }} />
            <span>Loading conversation messages...</span>
          </div>
        ) : messages.length === 0 ? (
          /* Empty State: Welcoming Screen & 6 Quick Actions Cards */
          <div className="assistant-empty-state">
            <div className="empty-state-icon-circle">
              <IconSparkles size={28} />
            </div>

            <div className="empty-state-header">
              <h3>Ask anything about your project</h3>
              <p>
                Versora grounded intelligence queries real artifact contents, Git commits, relationship links, review requests, and task issues to provide factual developer answers.
              </p>
            </div>

            {/* Quick Action Cards Grid */}
            <div className="quick-actions-cards-grid">
              {QUICK_ACTION_CARDS.map((card, idx) => (
                <div
                  key={idx}
                  onClick={() => onTriggerQuickAction(card.action, card.targetId)}
                  className="quick-action-card"
                >
                  <div className="quick-action-card-header">
                    {card.icon}
                    <span>{card.title}</span>
                  </div>
                  <div className="quick-action-card-desc">
                    {card.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Populated Message List */
          <>
            {messages.map((msg) => (
              <AssistantMessageBubble
                key={msg.id}
                message={msg}
                onNavigateToArtifact={onNavigateToArtifact}
                onNavigateToCommit={onNavigateToCommit}
                onNavigateToTask={onNavigateToTask}
                onNavigateToReview={onNavigateToReview}
              />
            ))}

            {/* In-Flight Thinking Indicator */}
            {isSending && (
              <div className="loading-indicator-row">
                <div className="message-avatar" style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.35)', color: 'var(--brand-primary-light)' }}>
                  <IconSparkles size={16} />
                </div>
                <div className="loading-bubble">
                  <div className="loading-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>
                    {isOllama
                      ? 'Local Ollama (qwen3.5:4b) is analyzing project evidence...'
                      : 'AI Assistant is analyzing project context and citations...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Composer Section */}
      <footer className="assistant-composer-section">
        {/* Quick Action Chips Bar */}
        <div className="composer-chips-bar">
          <span className="chips-label">Quick Actions:</span>
          <button
            type="button"
            onClick={() => onTriggerQuickAction('project-summary')}
            disabled={isSending}
            className="composer-chip-btn"
          >
            <IconSparkles size={12} style={{ color: 'var(--brand-primary-light)' }} />
            <span>Project Summary</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerQuickAction('explain-impact')}
            disabled={isSending}
            className="composer-chip-btn"
          >
            <IconActivity size={12} style={{ color: 'var(--brand-trace-light)' }} />
            <span>Explain Impact</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerQuickAction('summarize-commit', selectedCommitHash)}
            disabled={isSending}
            className="composer-chip-btn"
          >
            <IconGitCommit size={12} style={{ color: 'var(--status-warning)' }} />
            <span>Recent Changes</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerQuickAction('review-assistance')}
            disabled={isSending}
            className="composer-chip-btn"
          >
            <IconTasks size={12} style={{ color: 'var(--status-success)' }} />
            <span>Review Assistance</span>
          </button>
        </div>

        {/* Multiline Composer Form */}
        <form onSubmit={handleSubmit} className="composer-box">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this project... (Enter sends, Shift+Enter for newline)"
            rows={1}
            disabled={isSending}
            className="composer-textarea"
          />

          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="btn-send-message"
            title="Send prompt"
          >
            {isSending ? (
              <IconRefreshCw size={16} className="animate-spin" />
            ) : (
              <IconSend size={16} />
            )}
          </button>
        </form>

        <div className="composer-footer-note">
          Versora responses are grounded in this project's real files, commits, reviews, and tasks. Internal credentials are strictly redacted.
        </div>
      </footer>
    </div>
  );
};
