import { apiClient } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import {
  GitStatusResponse,
  GitDiffResponse,
  GitCommitItem,
  GitCommitDetail,
  GitBranchItem,
  GitRestorePreviewResponse,
  GitRestoreResult,
  GitInitResponse,
} from '../types/git';

export const gitService = {
  /**
   * Initializes a real Git repository for the project.
   */
  async init(projectId: string): Promise<GitInitResponse> {
    const response = await apiClient.post<ApiSuccessResponse<GitInitResponse>>(
      `/v1/projects/${projectId}/git/init`
    );
    return response.data;
  },

  async initRepository(projectId: string): Promise<GitInitResponse> {
    return this.init(projectId);
  },

  /**
   * Retrieves actual Git status for the project workspace.
   */
  async getStatus(projectId: string): Promise<GitStatusResponse> {
    const response = await apiClient.get<ApiSuccessResponse<GitStatusResponse>>(
      `/v1/projects/${projectId}/git/status`
    );
    return response.data;
  },

  /**
   * Retrieves unified diffs for pending changes.
   */
  async getDiff(projectId: string, file?: string, staged?: boolean): Promise<GitDiffResponse> {
    const params: Record<string, string | undefined> = {};
    if (file) params.file = file;
    if (staged !== undefined) params.staged = String(staged);

    const response = await apiClient.get<ApiSuccessResponse<GitDiffResponse>>(
      `/v1/projects/${projectId}/git/diff`,
      { params }
    );
    return response.data;
  },

  /**
   * Commits staged/modified files (Save Version).
   */
  async commit(projectId: string, message: string, files?: string[]): Promise<GitCommitItem> {
    const response = await apiClient.post<ApiSuccessResponse<GitCommitItem>>(
      `/v1/projects/${projectId}/git/commit`,
      { message, files }
    );
    return response.data;
  },

  /**
   * Retrieves commit history (log).
   */
  async getHistory(projectId: string, limit?: number, branch?: string): Promise<GitCommitItem[]> {
    const params: Record<string, string | undefined> = {};
    if (limit) params.limit = String(limit);
    if (branch) params.branch = branch;

    const response = await apiClient.get<ApiSuccessResponse<GitCommitItem[]>>(
      `/v1/projects/${projectId}/git/history`,
      { params }
    );
    return response.data;
  },

  /**
   * Retrieves detailed changes for a specific commit.
   */
  async getCommit(projectId: string, commitHash: string): Promise<GitCommitDetail> {
    const response = await apiClient.get<ApiSuccessResponse<GitCommitDetail>>(
      `/v1/projects/${projectId}/git/commits/${commitHash}`
    );
    return response.data;
  },

  /**
   * Lists local branches.
   */
  async listBranches(projectId: string): Promise<GitBranchItem[]> {
    const response = await apiClient.get<ApiSuccessResponse<GitBranchItem[]>>(
      `/v1/projects/${projectId}/git/branches`
    );
    return response.data;
  },

  async getBranches(projectId: string): Promise<GitBranchItem[]> {
    return this.listBranches(projectId);
  },

  /**
   * Creates a new branch.
   */
  async createBranch(projectId: string, name: string, fromCommit?: string): Promise<GitBranchItem> {
    const response = await apiClient.post<ApiSuccessResponse<GitBranchItem>>(
      `/v1/projects/${projectId}/git/branches`,
      { name, fromCommit }
    );
    return response.data;
  },

  /**
   * Switches to an existing branch.
   */
  async switchBranch(projectId: string, branch: string): Promise<{ currentBranch: string; message: string }> {
    const response = await apiClient.post<ApiSuccessResponse<{ currentBranch: string; message: string }>>(
      `/v1/projects/${projectId}/git/branches/switch`,
      { branch }
    );
    return response.data;
  },

  /**
   * Previews restoration before executing.
   */
  async previewRestore(projectId: string, commitHash: string, filePath?: string): Promise<GitRestorePreviewResponse> {
    const response = await apiClient.post<ApiSuccessResponse<GitRestorePreviewResponse>>(
      `/v1/projects/${projectId}/git/restore/preview`,
      { commitHash, filePath }
    );
    return response.data;
  },

  /**
   * Safely restores a file or project snapshot from an earlier commit.
   */
  async restore(
    projectId: string,
    commitHash: string,
    mode: 'file' | 'project' = 'project',
    filePath?: string
  ): Promise<GitRestoreResult> {
    const response = await apiClient.post<ApiSuccessResponse<GitRestoreResult>>(
      `/v1/projects/${projectId}/git/restore`,
      { commitHash, mode, filePath }
    );
    return response.data;
  },
};
