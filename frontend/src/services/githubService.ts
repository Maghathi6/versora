import { apiClient } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import {
  GitHubOAuthStatusResponse,
  GitHubAuthorizeResponse,
  GitHubRemoteStatusResponse,
  GitHubPublishInput,
  GitHubLinkInput,
  GitHubPushResult,
  GitHubPullResult,
  GitHubFetchResult,
  GitHubRemoteInfo,
} from '../types/github';

export const githubService = {
  /**
   * Retrieves GitHub OAuth connection status for current user.
   */
  async getOAuthStatus(): Promise<GitHubOAuthStatusResponse> {
    const response = await apiClient.get<ApiSuccessResponse<GitHubOAuthStatusResponse>>(
      '/v1/github/oauth/status'
    );
    return response.data;
  },

  /**
   * Generates authorization URL with state token to connect GitHub account.
   */
  async getAuthorizeUrl(returnTo?: string): Promise<GitHubAuthorizeResponse> {
    const response = await apiClient.get<ApiSuccessResponse<GitHubAuthorizeResponse>>(
      '/v1/github/oauth/authorize',
      {
        params: returnTo ? { returnTo } : undefined,
      }
    );
    return response.data;
  },

  /**
   * Disconnects linked GitHub account and cleans up encrypted credentials.
   */
  async disconnectAccount(): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete<ApiSuccessResponse<{ success: boolean; message: string }>>(
      '/v1/github/oauth/disconnect'
    );
    return response.data;
  },

  /**
   * Retrieves synchronization status and commit counts between local Git repo and GitHub remote.
   */
  async getRemoteStatus(projectId: string): Promise<GitHubRemoteStatusResponse> {
    const response = await apiClient.get<ApiSuccessResponse<GitHubRemoteStatusResponse>>(
      `/v1/projects/${projectId}/github/status`
    );
    return response.data;
  },

  /**
   * Creates a new GitHub repository and publishes the local Git repository to it.
   */
  async publish(
    projectId: string,
    input: GitHubPublishInput
  ): Promise<{ remote: GitHubRemoteInfo; message: string }> {
    const response = await apiClient.post<ApiSuccessResponse<{ remote: GitHubRemoteInfo; message: string }>>(
      `/v1/projects/${projectId}/github/publish`,
      input
    );
    return response.data;
  },

  /**
   * Links an existing GitHub repository to the local Versora project.
   */
  async link(
    projectId: string,
    input: GitHubLinkInput
  ): Promise<{ remote: GitHubRemoteInfo; message: string }> {
    const response = await apiClient.post<ApiSuccessResponse<{ remote: GitHubRemoteInfo; message: string }>>(
      `/v1/projects/${projectId}/github/link`,
      input
    );
    return response.data;
  },

  /**
   * Unlinks the remote GitHub repository from the Versora project.
   */
  async unlink(projectId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete<ApiSuccessResponse<{ success: boolean; message: string }>>(
      `/v1/projects/${projectId}/github/unlink`
    );
    return response.data;
  },

  /**
   * Fetches latest references from GitHub remote without modifying local working tree.
   */
  async fetchRemote(projectId: string): Promise<GitHubFetchResult> {
    const response = await apiClient.post<ApiSuccessResponse<GitHubFetchResult>>(
      `/v1/projects/${projectId}/github/fetch`
    );
    return response.data;
  },

  /**
   * Pushes local committed changes to the configured GitHub remote.
   */
  async push(
    projectId: string,
    options?: { branch?: string }
  ): Promise<GitHubPushResult> {
    const response = await apiClient.post<ApiSuccessResponse<GitHubPushResult>>(
      `/v1/projects/${projectId}/github/push`,
      options || {}
    );
    return response.data;
  },

  /**
   * Safely fast-forward pulls incoming remote changes and reconciles working tree with artifacts.
   */
  async pull(
    projectId: string,
    options?: { branch?: string }
  ): Promise<GitHubPullResult> {
    const response = await apiClient.post<ApiSuccessResponse<GitHubPullResult>>(
      `/v1/projects/${projectId}/github/pull`,
      options || {}
    );
    return response.data;
  },
};
