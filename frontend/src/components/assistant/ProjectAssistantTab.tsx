import React, { useState, useEffect, useCallback } from 'react';
import {
  AssistantConversation,
  AssistantMessage,
  AssistantConfigResponse,
  QuickActionType,
} from '../../types/assistant';
import { assistantService } from '../../services/assistantService';
import { AssistantConversationList } from './AssistantConversationList';
import { AssistantChatView } from './AssistantChatView';

interface ProjectAssistantTabProps {
  projectId: string;
  onNavigateToArtifact?: (pathOrId: string) => void;
  onNavigateToCommit?: (hash: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToReview?: (reviewId: string) => void;
  initialAction?: {
    action: QuickActionType;
    targetId?: string;
  } | null;
}

export const ProjectAssistantTab: React.FC<ProjectAssistantTabProps> = ({
  projectId,
  onNavigateToArtifact,
  onNavigateToCommit,
  onNavigateToTask,
  onNavigateToReview,
  initialAction,
}) => {
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<AssistantConversation | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [config, setConfig] = useState<AssistantConfigResponse | null>(null);

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch configuration
  useEffect(() => {
    let mounted = true;
    assistantService
      .getConfig(projectId)
      .then((cfg) => {
        if (mounted) setConfig(cfg);
      })
      .catch((err) => {
        console.warn('Could not load AI configuration:', err);
      });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      const list = await assistantService.listConversations(projectId);
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        setActiveConversationId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      setError(err?.response?.data?.error?.message || 'Failed to load conversations.');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [projectId, activeConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load active conversation messages
  useEffect(() => {
    if (!activeConversationId) {
      setCurrentConversation(null);
      setMessages([]);
      return;
    }

    let mounted = true;
    setIsLoadingMessages(true);
    setError(null);

    assistantService
      .getConversation(projectId, activeConversationId)
      .then((res) => {
        if (!mounted) return;
        setCurrentConversation(res.conversation);
        setMessages(res.messages);
      })
      .catch((err: any) => {
        if (!mounted) return;
        console.error('Failed to load conversation details:', err);
        setError(err?.response?.data?.error?.message || 'Failed to load conversation.');
      })
      .finally(() => {
        if (mounted) setIsLoadingMessages(false);
      });

    return () => {
      mounted = false;
    };
  }, [projectId, activeConversationId]);

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      setError(null);
      const newConv = await assistantService.createConversation(projectId, 'New Conversation');
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      setError(err?.response?.data?.error?.message || 'Failed to create conversation.');
    }
  };

  // Rename conversation
  const handleRenameConversation = async (conversationId: string, newTitle: string) => {
    try {
      setError(null);
      const updated = await assistantService.renameConversation(projectId, conversationId, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title: updated.title } : c))
      );
      if (currentConversation?.id === conversationId) {
        setCurrentConversation((prev) => (prev ? { ...prev, title: updated.title } : null));
      }
    } catch (err: any) {
      console.error('Failed to rename conversation:', err);
      setError(err?.response?.data?.error?.message || 'Failed to rename conversation.');
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      setError(null);
      await assistantService.deleteConversation(projectId, conversationId);
      const remaining = conversations.filter((c) => c.id !== conversationId);
      setConversations(remaining);
      if (activeConversationId === conversationId) {
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
      setError(err?.response?.data?.error?.message || 'Failed to delete conversation.');
    }
  };

  // Send message
  const handleSendMessage = async (content: string) => {
    try {
      setError(null);
      setIsSending(true);

      let targetConvId = activeConversationId;

      // If no active conversation exists, create one with the user's first query
      if (!targetConvId) {
        const titleSnippet = content.substring(0, 40) + (content.length > 40 ? '...' : '');
        const newConv = await assistantService.createConversation(projectId, titleSnippet);
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        targetConvId = newConv.id;
      }

      // Optimistically append user message
      const tempUserMsg: AssistantMessage = {
        id: `temp-${Date.now()}`,
        conversationId: targetConvId,
        role: 'user',
        content,
        sources: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      // Call API
      const res = await assistantService.sendMessage(projectId, targetConvId, content);

      // Replace with genuine stored messages
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        res.userMessage,
        res.assistantMessage,
      ]);

      // Update conversation in list (e.g. timestamp or title)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConvId
            ? { ...c, updatedAt: res.assistantMessage.createdAt }
            : c
        )
      );
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to generate assistant response. Please check your provider configuration.';
      setError(errMsg);
    } finally {
      setIsSending(false);
    }
  };

  // Trigger quick action
  const handleTriggerQuickAction = async (action: QuickActionType, targetId?: string) => {
    try {
      setError(null);
      setIsSending(true);

      let targetConvId = activeConversationId;
      if (!targetConvId) {
        const actionTitleMap: Record<QuickActionType, string> = {
          'explain-artifact': 'Explain Artifact',
          'summarize-commit': 'Summarize Commit',
          'explain-impact': 'Explain Impact',
          'review-assistance': 'Review Assistance',
          'project-summary': 'Project Summary',
        };
        const newConv = await assistantService.createConversation(
          projectId,
          actionTitleMap[action] || 'Quick Action'
        );
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        targetConvId = newConv.id;
      }

      const quickResult = await assistantService.executeQuickAction(projectId, {
        action,
        targetId,
      });

      // Construct question text from action
      const actionPromptMap: Record<QuickActionType, string> = {
        'explain-artifact': `Explain artifact ${targetId || 'selected'}`,
        'summarize-commit': `Summarize commit ${targetId || 'latest'}`,
        'explain-impact': 'Explain change impact analysis',
        'review-assistance': 'Review and task assistance',
        'project-summary': 'Project overview and summary',
      };

      // Append assistant response to current conversation
      const userMsg: AssistantMessage = {
        id: `user-qa-${Date.now()}`,
        conversationId: targetConvId,
        role: 'user',
        content: actionPromptMap[action],
        sources: [],
        createdAt: new Date().toISOString(),
      };

      const assistantMsg: AssistantMessage = {
        id: `asst-qa-${Date.now()}`,
        conversationId: targetConvId,
        role: 'assistant',
        content: quickResult.content,
        sources: quickResult.sources,
        uncertaintyNote: quickResult.uncertaintyNote,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
    } catch (err: any) {
      console.error('Failed to execute quick action:', err);
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Quick action failed. Please verify provider configuration.';
      setError(errMsg);
    } finally {
      setIsSending(false);
    }
  };

  // If initialAction prop was provided (e.g. from artifact editor or git history), execute it once
  useEffect(() => {
    if (initialAction) {
      handleTriggerQuickAction(initialAction.action, initialAction.targetId);
    }
  }, [initialAction]);

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[550px] rounded-2xl overflow-hidden border border-surface-800 bg-surface-950 shadow-2xl">
      {/* Left Sidebar: Conversations */}
      <div className="w-72 sm:w-80 flex-shrink-0 hidden md:block">
        <AssistantConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => setActiveConversationId(id)}
          onNewConversation={handleNewConversation}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          isLoading={isLoadingConversations}
        />
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 min-w-0">
        <AssistantChatView
          conversation={currentConversation}
          messages={messages}
          config={config}
          isLoading={isLoadingMessages}
          isSending={isSending}
          error={error}
          onSendMessage={handleSendMessage}
          onTriggerQuickAction={handleTriggerQuickAction}
          onNavigateToArtifact={onNavigateToArtifact}
          onNavigateToCommit={onNavigateToCommit}
          onNavigateToTask={onNavigateToTask}
          onNavigateToReview={onNavigateToReview}
        />
      </div>
    </div>
  );
};
