import { apiClient } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import {
  ArtifactRelationshipSummary,
  CreateRelationshipInput,
  ArtifactTraceabilityData,
  ImpactAnalysisResponse,
  UpdateImpactReviewInput,
  ProjectActivityItem,
} from '../types/intelligence';

export const intelligenceService = {
  /**
   * Creates an explicit relationship between two artifacts in a project.
   */
  async createRelationship(
    projectId: string,
    input: CreateRelationshipInput
  ): Promise<ArtifactRelationshipSummary> {
    const res = await apiClient.post<ApiSuccessResponse<ArtifactRelationshipSummary>>(
      `/v1/projects/${projectId}/relationships`,
      input
    );
    return res.data;
  },

  /**
   * Lists all artifact relationships established within a project.
   */
  async listRelationships(projectId: string): Promise<ArtifactRelationshipSummary[]> {
    const res = await apiClient.get<ApiSuccessResponse<ArtifactRelationshipSummary[]>>(
      `/v1/projects/${projectId}/relationships`
    );
    return res.data;
  },

  /**
   * Deletes an artifact relationship by ID.
   */
  async deleteRelationship(
    projectId: string,
    relationshipId: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<ApiSuccessResponse<{ success: boolean; message: string }>>(
      `/v1/projects/${projectId}/relationships/${relationshipId}`
    );
    return res.data;
  },

  /**
   * Retrieves full traceability graph and authentic Git file history for an artifact.
   */
  async getArtifactTraceability(
    projectId: string,
    artifactId: string
  ): Promise<ArtifactTraceabilityData> {
    const res = await apiClient.get<ApiSuccessResponse<ArtifactTraceabilityData>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}/traceability`
    );
    return res.data;
  },

  /**
   * Runs rule-based change-impact analysis against active Git status and relationship graph.
   */
  async getImpactAnalysis(projectId: string): Promise<ImpactAnalysisResponse> {
    const res = await apiClient.get<ApiSuccessResponse<ImpactAnalysisResponse>>(
      `/v1/projects/${projectId}/intelligence/impact`
    );
    return res.data;
  },

  /**
   * Marks a potential change impact item as reviewed or dismissed.
   */
  async updateImpactReview(
    projectId: string,
    input: UpdateImpactReviewInput
  ): Promise<{ status: string; impactKey: string }> {
    const res = await apiClient.post<ApiSuccessResponse<{ status: string; impactKey: string }>>(
      `/v1/projects/${projectId}/intelligence/impact/review`,
      input
    );
    return res.data;
  },

  /**
   * Retrieves chronological audit activity records for a project workspace.
   */
  async listActivities(
    projectId: string,
    limit: number = 50,
    entityType?: string,
    offset: number = 0
  ): Promise<ProjectActivityItem[]> {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (entityType && entityType !== 'all') {
      query.set('entityType', entityType);
    }

    const res = await apiClient.get<ApiSuccessResponse<ProjectActivityItem[]>>(
      `/v1/projects/${projectId}/activities?${query.toString()}`
    );
    return res.data;
  },
};
