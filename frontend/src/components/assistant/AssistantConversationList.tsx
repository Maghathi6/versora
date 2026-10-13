import React, { useState } from 'react';
import { AssistantConversation } from '../../types/assistant';
import {
  IconMessageSquare,
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconClose,
} from '../common/Icons';

interface AssistantConversationListProps {
  conversations: AssistantConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  isLoading?: boolean;
}

export const AssistantConversationList: React.FC<AssistantConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  isLoading = false,
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
    if (!window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
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
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-surface-900/60 border-r border-surface-800">
      {/* Header with New Chat button */}
      <div className="p-3.5 border-b border-surface-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconMessageSquare size={18} className="text-primary-400" />
          <span className="font-semibold text-sm text-surface-200">Conversations</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-surface-800 text-surface-400 font-mono">
            {conversations.length}
          </span>
        </div>
        <button
          onClick={onNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium shadow-sm transition-colors"
          title="Start a new conversation"
        >
          <IconPlus size={14} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-surface-400">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-surface-400">
            <p className="font-medium text-surface-300 mb-1">No chats yet</p>
            <p>Start a new conversation to ask questions grounded in this project.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = conv.id === editingId;
            const isDeleting = conv.id === deletingId;

            return (
              <div
                key={conv.id}
                onClick={() => !isEditing && onSelectConversation(conv.id)}
                className={`group relative rounded-xl px-3 py-2.5 text-xs transition-all cursor-pointer flex items-center justify-between gap-2 border ${
                  isActive
                    ? 'bg-primary-500/10 border-primary-500/40 text-surface-100 shadow-sm'
                    : 'bg-surface-850/40 hover:bg-surface-800/80 border-transparent text-surface-300 hover:text-surface-100'
                } ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveRename(conv.id, e)}
                    className="flex items-center gap-1.5 w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 px-2 py-1 rounded bg-surface-900 border border-primary-500 text-xs text-surface-100 focus:outline-none"
                      autoFocus
                      disabled={isSubmitting}
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !editTitle.trim()}
                      className="p-1 rounded bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                      title="Save"
                    >
                      <IconCheck size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                      title="Cancel"
                    >
                      <IconClose size={13} />
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-medium truncate text-surface-200 group-hover:text-white">
                        {conv.title}
                      </div>
                      <div className="text-[10px] text-surface-500 mt-0.5">
                        {formatDate(conv.updatedAt)}
                      </div>
                    </div>

                    {/* Actions on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => startEditing(conv, e)}
                        className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                        title="Rename conversation"
                      >
                        <IconEdit size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(conv.id, e)}
                        className="p-1 rounded hover:bg-red-500/20 text-surface-400 hover:text-red-400 transition-colors"
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
    </div>
  );
};
