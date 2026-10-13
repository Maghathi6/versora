import {
  ProjectRole,
  PROJECT_ROLES,
  InvitationStatus,
  INVITATION_STATUSES,
  TaskStatus,
  TASK_STATUSES,
  TaskPriority,
  TASK_PRIORITIES,
  ReviewStatus,
  REVIEW_STATUSES,
  ReviewDecision,
  REVIEW_DECISIONS,
  NotificationType,
  NOTIFICATION_TYPES,
  ProjectMember,
  ProjectInvitation,
  ArtifactComment,
  ProjectTask,
  ProjectTaskComment,
  ProjectReview,
  ProjectReviewer,
  ProjectReviewDecision,
  ProjectReviewComment,
  Notification,
} from '../../db/schema/collaboration';

export {
  ProjectRole,
  PROJECT_ROLES,
  InvitationStatus,
  INVITATION_STATUSES,
  TaskStatus,
  TASK_STATUSES,
  TaskPriority,
  TASK_PRIORITIES,
  ReviewStatus,
  REVIEW_STATUSES,
  ReviewDecision,
  REVIEW_DECISIONS,
  NotificationType,
  NOTIFICATION_TYPES,
  ProjectMember,
  ProjectInvitation,
  ArtifactComment,
  ProjectTask,
  ProjectTaskComment,
  ProjectReview,
  ProjectReviewer,
  ProjectReviewDecision,
  ProjectReviewComment,
  Notification,
};

export const ROLE_LEVELS: Record<ProjectRole, number> = {
  viewer: 1,
  reviewer: 2,
  member: 3,
  admin: 4,
  owner: 5,
};

export interface CollaborationUserSummary {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ProjectMemberResponse {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
  user: CollaborationUserSummary;
}

export interface ProjectInvitationResponse {
  id: string;
  projectId: string;
  inviterId: string;
  inviteeId: string;
  role: ProjectRole;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  inviter: CollaborationUserSummary;
  invitee: CollaborationUserSummary;
  projectName?: string;
}

export interface ArtifactCommentResponse {
  id: string;
  projectId: string;
  artifactId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  isResolved: boolean;
  resolvedById: string | null;
  resolvedAt: string | null;
  revisionCommitHash: string | null;
  createdAt: string;
  updatedAt: string;
  author: CollaborationUserSummary;
  resolvedBy?: CollaborationUserSummary | null;
  replyCount?: number;
  replies?: ArtifactCommentResponse[];
}

export interface ProjectTaskResponse {
  id: string;
  projectId: string;
  creatorId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  labels: string[];
  linkedArtifactId: string | null;
  linkedCommitHash: string | null;
  linkedReviewId: string | null;
  createdAt: string;
  updatedAt: string;
  creator: CollaborationUserSummary;
  assignee?: CollaborationUserSummary | null;
  linkedArtifact?: { id: string; name: string; path: string } | null;
  commentsCount?: number;
}

export interface TaskCommentResponse {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CollaborationUserSummary;
}

export interface ReviewDecisionSummary {
  decision: ReviewDecision;
  feedback: string | null;
  commitHashAtDecision: string | null;
  createdAt: string;
  updatedAt: string;
  isStale?: boolean;
}

export interface ReviewerWithDecision {
  id: string;
  reviewId: string;
  reviewerId: string;
  createdAt: string;
  user: CollaborationUserSummary;
  decision?: ReviewDecisionSummary | null;
}

export interface ProjectReviewResponse {
  id: string;
  projectId: string;
  creatorId: string;
  title: string;
  description: string | null;
  targetType: 'branch' | 'commit' | 'artifact';
  targetRef: string;
  status: ReviewStatus;
  closedById: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator: CollaborationUserSummary;
  closedBy?: CollaborationUserSummary | null;
  reviewers: ReviewerWithDecision[];
  decisionsCount: {
    approved: number;
    changesRequested: number;
  };
  commentsCount?: number;
  currentCommitHash?: string | null;
}

export interface ReviewCommentResponse {
  id: string;
  reviewId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CollaborationUserSummary;
}

export interface NotificationResponse {
  id: string;
  recipientId: string;
  actorId: string | null;
  projectId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actor?: CollaborationUserSummary | null;
  projectName?: string | null;
}
