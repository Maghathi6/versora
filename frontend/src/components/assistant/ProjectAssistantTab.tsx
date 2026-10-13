import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<AssistantMessage[]>([]);

  // 1. Fetch AI Configuration using TanStack Query
  const { data: config = null } = useQuery<AssistantConfigResponse>({
    queryKey: ['assistant-config', projectId],
    queryFn: () => assistantService.getConfig(projectId),
    enabled: Boolean(projectId),
    staleTime: 60000,
  });

  // 2. Fetch Conversations using TanStack Query
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    error: rawConversationsError,
    refetch: refetchConversations,
  } = useQuery<AssistantConversation[]>({
    queryKey: ['assistant-conversations', projectId],
    queryFn: () => assistantService.listConversations(projectId),
    enabled: Boolean(projectId),
    staleTime: 15000,
  });

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // 3. Fetch Active Conversation Detail & Messages
  const {
    data: conversationDetail,
    isLoading: isLoadingMessages,
    error: rawMessagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['assistant-conversation', projectId, activeConversationId],
    queryFn: () => assistantService.getConversation(projectId, activeConversationId!),
    enabled: Boolean(projectId && activeConversationId),
    staleTime: 10000,
  });

  // Combine persisted messages with any in-flight optimistic messages
  const baseMessages = conversationDetail?.messages || [];
  const currentConversation = conversationDetail?.conversation || conversations.find((c) => c.id === activeConversationId) || null;
  const messages = [...baseMessages, ...optimisticMessages];

  // Format clean errors
  const conversationsError = rawConversationsError
    ? (rawConversationsError as any)?.message || 'Failed to load conversations.'
    : null;

  const activeError = chatError || (rawMessagesError ? (rawMessagesError as any)?.message || 'Failed to load conversation.' : null);

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      setChatError(null);
      const newConv = await assistantService.createConversation(projectId, 'New Conversation');
      queryClient.setQueryData<AssistantConversation[]>(
        ['assistant-conversations', projectId],
        (prev = []) => [newConv, ...prev]
      );
      setActiveConversationId(newConv.id);
      setIsMobileSidebarOpen(false);
    } catch (err: any) {
      setChatError(err?.message || 'Failed to create conversation.');
    }
  };

  // Rename conversation
  const handleRenameConversation = async (conversationId: string, newTitle: string) => {
    try {
      setChatError(null);
      const updated = await assistantService.renameConversation(projectId, conversationId, newTitle);
      queryClient.setQueryData<AssistantConversation[]>(
        ['assistant-conversations', projectId],
        (prev = []) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: updated.title } : c))
      );
      queryClient.invalidateQueries({
        queryKey: ['assistant-conversation', projectId, conversationId],
      });
    } catch (err: any) {
      setChatError(err?.message || 'Failed to rename conversation.');
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      setChatError(null);
      await assistantService.deleteConversation(projectId, conversationId);
      queryClient.setQueryData<AssistantConversation[]>(
        ['assistant-conversations', projectId],
        (prev = []) => prev.filter((c) => c.id !== conversationId)
      );

      if (activeConversationId === conversationId) {
        const remaining = conversations.filter((c) => c.id !== conversationId);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      setChatError(err?.message || 'Failed to delete conversation.');
    }
  };

  // Send message
  const handleSendMessage = async (content: string) => {
    try {
      setChatError(null);
      setIsSending(true);

      let targetConvId = activeConversationId;

      // If no active conversation exists, create one with the user's first query
      if (!targetConvId) {
        const titleSnippet = content.substring(0, 36) + (content.length > 36 ? '...' : '');
        const newConv = await assistantService.createConversation(projectId, titleSnippet);
        queryClient.setQueryData<AssistantConversation[]>(
          ['assistant-conversations', projectId],
          (prev = []) => [newConv, ...prev]
        );
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
      setOptimisticMessages([tempUserMsg]);

      // Call API
      const res = await assistantService.sendMessage(projectId, targetConvId, content);

      // Invalidate queries so TanStack Query refreshes genuine persisted messages
      queryClient.setQueryData(
        ['assistant-conversation', projectId, targetConvId],
        (prevData: any) => {
          if (!prevData) return prevData;
          return {
            ...prevData,
            messages: [...prevData.messages, res.userMessage, res.assistantMessage],
          };
        }
      );

      // Update conversation in list (timestamp or title)
      queryClient.setQueryData<AssistantConversation[]>(
        ['assistant-conversations', projectId],
        (prev = []) =>
          prev.map((c) =>
            c.id === targetConvId
              ? { ...c, updatedAt: res.assistantMessage.createdAt }
              : c
          )
      );
    } catch (err: any) {
      const errMsg =
        err?.message ||
        'Failed to generate assistant response. Please check your provider configuration.';
      setChatError(errMsg);
      throw err;
    } finally {
      setOptimisticMessages([]);
      setIsSending(false);
    }
  };

  // Trigger quick action
  const handleTriggerQuickAction = async (action: QuickActionType, targetId?: string) => {
    try {
      setChatError(null);
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
        queryClient.setQueryData<AssistantConversation[]>(
          ['assistant-conversations', projectId],
          (prev = []) => [newConv, ...prev]
        );
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

      queryClient.setQueryData(
        ['assistant-conversation', projectId, targetConvId],
        (prevData: any) => {
          if (!prevData) return prevData;
          return {
            ...prevData,
            messages: [...prevData.messages, userMsg, assistantMsg],
          };
        }
      );
    } catch (err: any) {
      const errMsg =
        err?.message ||
        'Quick action failed. Please verify provider configuration.';
      setChatError(errMsg);
    } finally {
      setIsSending(false);
    }
  };

  // Execute initialAction prop once if provided
  useEffect(() => {
    if (initialAction) {
      handleTriggerQuickAction(initialAction.action, initialAction.targetId);
    }
  }, [initialAction]);

  return (
    <div className="assistant-container">
      {/* Sidebar: Conversations */}
      <AssistantConversationList
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewConversation={handleNewConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        isLoading={isLoadingConversations}
        error={conversationsError}
        onRetry={() => refetchConversations()}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Chat Panel */}
      <AssistantChatView
        conversation={currentConversation}
        messages={messages}
        config={config}
        isLoading={isLoadingMessages}
        isSending={isSending}
        error={activeError}
        onSendMessage={handleSendMessage}
        onTriggerQuickAction={handleTriggerQuickAction}
        onRetryLastMessage={() => {
          if (rawMessagesError) {
            refetchMessages();
            return;
          }
          if (messages.length > 0) {
            const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
            if (lastUserMsg) {
              handleSendMessage(lastUserMsg.content);
            }
          }
        }}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        onNavigateToArtifact={onNavigateToArtifact}
        onNavigateToCommit={onNavigateToCommit}
        onNavigateToTask={onNavigateToTask}
        onNavigateToReview={onNavigateToReview}
      />
    </div>
  );
};
