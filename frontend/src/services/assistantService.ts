import { apiClient } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import {
  AssistantConfigResponse,
  AssistantConversation,
  ConversationDetailResponse,
  SendMessageResponse,
  QuickActionInput,
} from '../types/assistant';

export const assistantService = {
  /**
   * Check AI provider availability and configuration for a project.
   */
  async getConfig(projectId: string): Promise<AssistantConfigResponse> {
    const res = await apiClient.get<ApiSuccessResponse<AssistantConfigResponse>>(
      `/v1/projects/${projectId}/assistant/config`
    );
    return res.data;
  },

  /**
   * List the current user's conversations within a project.
   */
  async listConversations(projectId: string): Promise<AssistantConversation[]> {
    const res = await apiClient.get<ApiSuccessResponse<AssistantConversation[]>>(
      `/v1/projects/${projectId}/assistant/conversations`
    );
    return res.data;
  },

  /**
   * Create a new conversation.
   */
  async createConversation(projectId: string, title?: string): Promise<AssistantConversation> {
    const res = await apiClient.post<ApiSuccessResponse<AssistantConversation>>(
      `/v1/projects/${projectId}/assistant/conversations`,
      { title }
    );
    return res.data;
  },

  /**
   * Retrieve a conversation and its messages.
   */
  async getConversation(
    projectId: string,
    conversationId: string
  ): Promise<ConversationDetailResponse> {
    const res = await apiClient.get<ApiSuccessResponse<ConversationDetailResponse>>(
      `/v1/projects/${projectId}/assistant/conversations/${conversationId}`
    );
    return res.data;
  },

  /**
   * Rename a conversation.
   */
  async renameConversation(
    projectId: string,
    conversationId: string,
    title: string
  ): Promise<AssistantConversation> {
    const res = await apiClient.patch<ApiSuccessResponse<AssistantConversation>>(
      `/v1/projects/${projectId}/assistant/conversations/${conversationId}`,
      { title }
    );
    return res.data;
  },

  /**
   * Delete a conversation.
   */
  async deleteConversation(
    projectId: string,
    conversationId: string
  ): Promise<void> {
    await apiClient.delete(
      `/v1/projects/${projectId}/assistant/conversations/${conversationId}`
    );
  },

  /**
   * Send a message to an ongoing conversation.
   */
  async sendMessage(
    projectId: string,
    conversationId: string,
    content: string
  ): Promise<SendMessageResponse> {
    const res = await apiClient.post<ApiSuccessResponse<SendMessageResponse>>(
      `/v1/projects/${projectId}/assistant/conversations/${conversationId}/messages`,
      { content }
    );
    return res.data;
  },

  /**
   * Trigger a contextual quick action (e.g., explain-artifact, summarize-commit, explain-impact).
   */
  async executeQuickAction(
    projectId: string,
    input: QuickActionInput
  ): Promise<{
    content: string;
    sources: any[];
    uncertaintyNote?: string | null;
  }> {
    const res = await apiClient.post<
      ApiSuccessResponse<{
        content: string;
        sources: any[];
        uncertaintyNote?: string | null;
      }>
    >(`/v1/projects/${projectId}/assistant/quick-action`, input);
    return res.data;
  },
};
