import { apiClient } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import { Project, CreateProjectInput, UpdateProjectInput } from '../types/project';

/**
 * Project Service
 * Interacts with backend project management endpoints:
 * - GET /api/v1/projects (list owned projects)
 * - GET /api/v1/projects/:projectId (get single project)
 * - POST /api/v1/projects (create project)
 * - PATCH /api/v1/projects/:projectId (update project)
 * - DELETE /api/v1/projects/:projectId (delete project)
 */
export const projectService = {
  /**
   * Retrieves all projects owned by the currently authenticated user.
   */
  async getProjects(): Promise<Project[]> {
    const response = await apiClient.get<ApiSuccessResponse<Project[]>>('/v1/projects');
    return response.data;
  },

  /**
   * Retrieves a single project by its primary UUID.
   */
  async getProject(projectId: string): Promise<Project> {
    const response = await apiClient.get<ApiSuccessResponse<Project>>(`/v1/projects/${projectId}`);
    return response.data;
  },

  /**
   * Creates a new project for the authenticated user.
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    const response = await apiClient.post<ApiSuccessResponse<Project>>('/v1/projects', input);
    return response.data;
  },

  /**
   * Updates an owned project's name or description.
   */
  async updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
    const response = await apiClient.patch<ApiSuccessResponse<Project>>(`/v1/projects/${projectId}`, input);
    return response.data;
  },

  /**
   * Deletes an owned project following safe deletion policy.
   */
  async deleteProject(projectId: string): Promise<{ message: string; id: string }> {
    const response = await apiClient.delete<ApiSuccessResponse<{ message: string; id: string }>>(
      `/v1/projects/${projectId}`
    );
    return response.data;
  },
};
