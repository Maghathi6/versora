import { apiClient } from './apiClient';
import {
  ProjectDashboardData,
  ProjectSearchResponse,
  WorkflowContextResponse,
  SearchCategory,
} from '../types/workflow';

export const workflowService = {
  /**
   * Fetches unified project dashboard metrics, pending reviews, tasks, git state, and AI status.
   */
  async getProjectDashboard(projectId: string): Promise<ProjectDashboardData> {
    const res = await apiClient.get<{ success: boolean; data: ProjectDashboardData }>(
      `/projects/${projectId}/dashboard`
    );
    return res.data;
  },

  /**
   * Searches across artifacts, tasks, reviews, and commits.
   */
  async searchProject(
    projectId: string,
    query: string,
    category: SearchCategory = 'all'
  ): Promise<ProjectSearchResponse> {
    const params = new URLSearchParams();
    params.set('q', query);
    if (category !== 'all') {
      params.set('category', category);
    }
    const res = await apiClient.get<{ success: boolean; data: ProjectSearchResponse }>(
      `/projects/${projectId}/search?${params.toString()}`
    );
    return res.data;
  },

  /**
   * Retrieves 360-degree context for an artifact or commit (relationships, impacts, tasks, reviews).
   */
  async getWorkflowContext(
    projectId: string,
    params: { artifactId?: string; commitHash?: string }
  ): Promise<WorkflowContextResponse> {
    const searchParams = new URLSearchParams();
    if (params.artifactId) searchParams.set('artifactId', params.artifactId);
    if (params.commitHash) searchParams.set('commitHash', params.commitHash);

    const res = await apiClient.get<{ success: boolean; data: WorkflowContextResponse }>(
      `/projects/${projectId}/workflow/context?${searchParams.toString()}`
    );
    return res.data;
  },
};
