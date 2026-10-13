import React, { useState } from 'react';
import { AssistantConversation } from '../../types/assistant';
import {
  IconMessageSquare,
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconClose,
  IconRefreshCw,
  IconAlertCircle,
} from '../common/Icons';

interface AssistantConversationListProps {
  conversations: AssistantConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const AssistantConversationList: React.FC<AssistantConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  isLoading = false,
  error = null,
  onRetry,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEditing = (conv: AssistantConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const handleSaveRename = async (convId: string, e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await onRenameConversation(convId, editTitle.trim());
      setEditingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation and its messages? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(convId);
      await onDeleteConversation(convId);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {isOpenMobile && onCloseMobile && (
        <div className="assistant-sidebar-backdrop" onClick={onCloseMobile} />
      )}
      <aside className={`assistant-sidebar ${isOpenMobile ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div className="assistant-sidebar-header">
          <div className="assistant-sidebar-title">
            <IconMessageSquare size={17} style={{ color: 'var(--brand-primary-light)' }} />
            <span>Chats</span>
            <span className="assistant-count-pill">{conversations.length}</span>
          </div>

          <button
            type="button"
            onClick={onNewConversation}
            className="btn-new-chat"
            title="Start new grounded conversation"
          >
            <IconPlus size={14} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Sidebar Body */}
        <div className="assistant-conversation-list">
          {isLoading ? (
            <div className="sidebar-state-box">
              <IconRefreshCw size={22} className="animate-spin" style={{ color: 'var(--brand-primary-light)' }} />
              <span>Loading conversations...</span>
            </div>
          ) : error ? (
            <div className="sidebar-state-box error">
              <IconAlertCircle size={22} />
              <span>{error}</span>
              {onRetry && (
                <button type="button" onClick={onRetry} className="btn-retry-sm">
                  Retry Loading
                </button>
              )}
            </div>
          ) : conversations.length === 0 ? (
            <div className="sidebar-state-box">
              <IconMessageSquare size={24} style={{ opacity: 0.4 }} />
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                  No conversations yet
                </strong>
                <span>Start a new chat to ask questions grounded in your project's repository.</span>
              </div>
              <button
                type="button"
                onClick={onNewConversation}
                className="btn-retry-sm"
                style={{ marginTop: '0.25rem' }}
              >
                + Create First Chat
              </button>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isEditing = conv.id === editingId;
              const isDeleting = conv.id === deletingId;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectConversation(conv.id);
                      if (onCloseMobile) onCloseMobile();
                    }
                  }}
                  className={`assistant-conversation-item ${isActive ? 'active' : ''}`}
                  style={{ opacity: isDeleting ? 0.4 : 1 }}
                >
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleSaveRename(conv.id, e)}
                      className="conv-rename-form"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="conv-rename-input"
                        autoFocus
                        disabled={isSubmitting}
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting || !editTitle.trim()}
                        className="btn-icon-subtle"
                        style={{ color: 'var(--status-success)' }}
                        title="Save rename"
                      >
                        <IconCheck size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="btn-icon-subtle"
                        title="Cancel"
                      >
                        <IconClose size={14} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="conv-info">
                        <div className="conv-title" title={conv.title}>
                          {conv.title}
                        </div>
                        <div className="conv-date">{formatDate(conv.updatedAt)}</div>
                      </div>

                      <div className="conv-actions">
                        <button
                          type="button"
                          onClick={(e) => startEditing(conv, e)}
                          className="btn-icon-subtle"
                          title="Rename conversation"
                        >
                          <IconEdit size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(conv.id, e)}
                          className="btn-icon-subtle danger"
                          title="Delete conversation"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
