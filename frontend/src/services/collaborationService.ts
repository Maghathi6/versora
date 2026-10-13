import { apiClient } from './apiClient';
import { ApiSuccessResponse } from '../types/api';
import {
  ProjectMemberItem,
  ProjectInvitationItem,
  ArtifactCommentItem,
  ProjectTaskItem,
  TaskCommentItem,
  ProjectReviewItem,
  ReviewCommentItem,
  NotificationItem,
  InviteMemberInput,
  UpdateMemberRoleInput,
  CreateCommentInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateReviewInput,
  SubmitReviewDecisionInput,
  QueryTasksInput,
} from '../types/collaboration';

export const collaborationService = {
  // ==================== MEMBERS & INVITATIONS ====================
  async listMembers(projectId: string): Promise<ProjectMemberItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<ProjectMemberItem[]>>(
      `/v1/projects/${projectId}/members`
    );
    return res.data;
  },

  async inviteMember(projectId: string, input: InviteMemberInput): Promise<ProjectInvitationItem> {
    const res = await apiClient.post<ApiSuccessResponse<ProjectInvitationItem>>(
      `/v1/projects/${projectId}/invitations`,
      input
    );
    return res.data;
  },

  async listProjectInvitations(projectId: string): Promise<ProjectInvitationItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<ProjectInvitationItem[]>>(
      `/v1/projects/${projectId}/invitations`
    );
    return res.data;
  },

  async listUserInvitations(): Promise<ProjectInvitationItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<ProjectInvitationItem[]>>('/v1/invitations/me');
    return res.data;
  },

  async acceptInvitation(token: string): Promise<ProjectInvitationItem> {
    const res = await apiClient.post<ApiSuccessResponse<ProjectInvitationItem>>(
      `/v1/invitations/${token}/accept`
    );
    return res.data;
  },

  async rejectInvitation(token: string): Promise<ProjectInvitationItem> {
    const res = await apiClient.post<ApiSuccessResponse<ProjectInvitationItem>>(
      `/v1/invitations/${token}/reject`
    );
    return res.data;
  },

  async cancelInvitation(projectId: string, invitationId: string): Promise<void> {
    await apiClient.delete<ApiSuccessResponse<{ message: string }>>(
      `/v1/projects/${projectId}/invitations/${invitationId}`
    );
  },

  async updateMemberRole(
    projectId: string,
    userId: string,
    input: UpdateMemberRoleInput
  ): Promise<ProjectMemberItem> {
    const res = await apiClient.patch<ApiSuccessResponse<ProjectMemberItem>>(
      `/v1/projects/${projectId}/members/${userId}`,
      input
    );
    return res.data;
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    await apiClient.delete<ApiSuccessResponse<{ message: string }>>(
      `/v1/projects/${projectId}/members/${userId}`
    );
  },

  // ==================== ARTIFACT COMMENTS ====================
  async createComment(
    projectId: string,
    artifactId: string,
    input: CreateCommentInput
  ): Promise<ArtifactCommentItem> {
    const res = await apiClient.post<ApiSuccessResponse<ArtifactCommentItem>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}/comments`,
      input
    );
    return res.data;
  },

  async listArtifactComments(projectId: string, artifactId: string): Promise<ArtifactCommentItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<ArtifactCommentItem[]>>(
      `/v1/projects/${projectId}/artifacts/${artifactId}/comments`
    );
    return res.data;
  },

  async updateComment(
    projectId: string,
    commentId: string,
    content: string
  ): Promise<ArtifactCommentItem> {
    const res = await apiClient.patch<ApiSuccessResponse<ArtifactCommentItem>>(
      `/v1/projects/${projectId}/comments/${commentId}`,
      { content }
    );
    return res.data;
  },

  async deleteComment(projectId: string, commentId: string): Promise<void> {
    await apiClient.delete<ApiSuccessResponse<{ message: string }>>(
      `/v1/projects/${projectId}/comments/${commentId}`
    );
  },

  async resolveComment(
    projectId: string,
    commentId: string,
    isResolved: boolean
  ): Promise<ArtifactCommentItem> {
    const res = await apiClient.patch<ApiSuccessResponse<ArtifactCommentItem>>(
      `/v1/projects/${projectId}/comments/${commentId}/resolve`,
      { isResolved }
    );
    return res.data;
  },

  // ==================== TASKS & ISSUES ====================
  async createTask(projectId: string, input: CreateTaskInput): Promise<ProjectTaskItem> {
    const res = await apiClient.post<ApiSuccessResponse<ProjectTaskItem>>(
      `/v1/projects/${projectId}/tasks`,
      input
    );
    return res.data;
  },

  async getTask(projectId: string, taskId: string): Promise<ProjectTaskItem> {
    const res = await apiClient.get<ApiSuccessResponse<ProjectTaskItem>>(
      `/v1/projects/${projectId}/tasks/${taskId}`
    );
    return res.data;
  },

  async listTasks(projectId: string, query?: QueryTasksInput): Promise<ProjectTaskItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<ProjectTaskItem[]>>(
      `/v1/projects/${projectId}/tasks`,
      { params: query as any }
    );
    return res.data;
  },

  async updateTask(
    projectId: string,
    taskId: string,
    input: UpdateTaskInput
  ): Promise<ProjectTaskItem> {
    const res = await apiClient.patch<ApiSuccessResponse<ProjectTaskItem>>(
      `/v1/projects/${projectId}/tasks/${taskId}`,
      input
    );
    return res.data;
  },

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    await apiClient.delete<ApiSuccessResponse<{ message: string }>>(
      `/v1/projects/${projectId}/tasks/${taskId}`
    );
  },

  async createTaskComment(
    projectId: string,
    taskId: string,
    content: string
  ): Promise<TaskCommentItem> {
    const res = await apiClient.post<ApiSuccessResponse<TaskCommentItem>>(
      `/v1/projects/${projectId}/tasks/${taskId}/comments`,
      { content }
    );
    return res.data;
  },

  async listTaskComments(projectId: string, taskId: string): Promise<TaskCommentItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<TaskCommentItem[]>>(
      `/v1/projects/${projectId}/tasks/${taskId}/comments`
    );
    return res.data;
  },

  // ==================== REVIEWS & APPROVALS ====================
  async createReview(projectId: string, input: CreateReviewInput): Promise<ProjectReviewItem> {
    const res = await apiClient.post<ApiSuccessResponse<ProjectReviewItem>>(
      `/v1/projects/${projectId}/reviews`,
      input
    );
    return res.data;
  },

  async getReview(projectId: string, reviewId: string): Promise<ProjectReviewItem> {
    const res = await apiClient.get<ApiSuccessResponse<ProjectReviewItem>>(
      `/v1/projects/${projectId}/reviews/${reviewId}`
    );
    return res.data;
  },

  async listReviews(projectId: string): Promise<ProjectReviewItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<ProjectReviewItem[]>>(
      `/v1/projects/${projectId}/reviews`
    );
    return res.data;
  },

  async updateReview(
    projectId: string,
    reviewId: string,
    input: { title?: string; description?: string | null; status?: 'open' | 'closed' }
  ): Promise<ProjectReviewItem> {
    const res = await apiClient.patch<ApiSuccessResponse<ProjectReviewItem>>(
      `/v1/projects/${projectId}/reviews/${reviewId}`,
      input
    );
    return res.data;
  },

  async submitReviewDecision(
    projectId: string,
    reviewId: string,
    input: SubmitReviewDecisionInput
  ): Promise<ProjectReviewItem> {
    const res = await apiClient.post<ApiSuccessResponse<ProjectReviewItem>>(
      `/v1/projects/${projectId}/reviews/${reviewId}/decisions`,
      input
    );
    return res.data;
  },

  async assignReviewers(
    projectId: string,
    reviewId: string,
    reviewerIds: string[]
  ): Promise<ProjectReviewItem> {
    const res = await apiClient.post<ApiSuccessResponse<ProjectReviewItem>>(
      `/v1/projects/${projectId}/reviews/${reviewId}/reviewers`,
      { reviewerIds }
    );
    return res.data;
  },

  async createReviewComment(
    projectId: string,
    reviewId: string,
    content: string
  ): Promise<ReviewCommentItem> {
    const res = await apiClient.post<ApiSuccessResponse<ReviewCommentItem>>(
      `/v1/projects/${projectId}/reviews/${reviewId}/comments`,
      { content }
    );
    return res.data;
  },

  async listReviewComments(projectId: string, reviewId: string): Promise<ReviewCommentItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<ReviewCommentItem[]>>(
      `/v1/projects/${projectId}/reviews/${reviewId}/comments`
    );
    return res.data;
  },

  // ==================== IN-APP NOTIFICATIONS ====================
  async listNotifications(params?: { limit?: number; offset?: number }): Promise<NotificationItem[]> {
    const res = await apiClient.get<ApiSuccessResponse<NotificationItem[]>>('/v1/notifications', {
      params,
    });
    return res.data;
  },

  async getUnreadNotificationCount(): Promise<number> {
    const res = await apiClient.get<ApiSuccessResponse<{ count: number }>>(
      '/v1/notifications/unread-count'
    );
    return res.data.count;
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await apiClient.patch<ApiSuccessResponse<{ message: string }>>(
      `/v1/notifications/${notificationId}/read`
    );
  },

  async markAllNotificationsAsRead(): Promise<number> {
    const res = await apiClient.post<ApiSuccessResponse<{ count: number }>>(
      '/v1/notifications/mark-all-read'
    );
    return res.data.count;
  },
};
