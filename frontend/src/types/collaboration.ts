export type ProjectRole = 'owner' | 'admin' | 'member' | 'reviewer' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ReviewStatus = 'open' | 'approved' | 'changes_requested' | 'closed';
export type ReviewDecision = 'approved' | 'changes_requested';
export type NotificationType =
  | 'invitation'
  | 'mention'
  | 'task_assigned'
  | 'task_updated'
  | 'review_requested'
  | 'review_decision'
  | 'comment_reply';

export interface CollaborationUserSummary {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ProjectMemberItem {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
  user: CollaborationUserSummary;
}

export interface ProjectInvitationItem {
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

export interface ArtifactCommentItem {
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
  replies?: ArtifactCommentItem[];
}

export interface ProjectTaskItem {
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

export interface TaskCommentItem {
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

export interface ProjectReviewItem {
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

export interface ReviewCommentItem {
  id: string;
  reviewId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CollaborationUserSummary;
}

export interface NotificationItem {
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

export interface InviteMemberInput {
  usernameOrEmail: string;
  role: ProjectRole;
}

export interface UpdateMemberRoleInput {
  role: ProjectRole;
}

export interface CreateCommentInput {
  content: string;
  parentId?: string | null;
  revisionCommitHash?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  labels?: string[];
  linkedArtifactId?: string | null;
  linkedCommitHash?: string | null;
  linkedReviewId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  labels?: string[];
  linkedArtifactId?: string | null;
  linkedCommitHash?: string | null;
  linkedReviewId?: string | null;
}

export interface CreateReviewInput {
  title: string;
  description?: string | null;
  targetType?: 'branch' | 'commit' | 'artifact';
  targetRef: string;
  reviewerIds?: string[];
}

export interface SubmitReviewDecisionInput {
  decision: ReviewDecision;
  feedback?: string | null;
  commitHashAtDecision?: string | null;
}

export interface QueryTasksInput {
  status?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
  label?: string;
}
