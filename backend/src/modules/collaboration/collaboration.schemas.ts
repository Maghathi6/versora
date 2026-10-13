import { z } from 'zod';
import {
  PROJECT_ROLES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  REVIEW_STATUSES,
  REVIEW_DECISIONS,
} from './collaboration.types';

export const inviteMemberSchema = z.object({
  usernameOrEmail: z.string().trim().min(1, 'Username or email is required'),
  role: z.enum(PROJECT_ROLES).default('member'),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(PROJECT_ROLES),
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content cannot be empty').max(5000),
  parentId: z.string().uuid().optional().nullable(),
  revisionCommitHash: z.string().trim().max(128).optional().nullable(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content cannot be empty').max(5000),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const resolveCommentSchema = z.object({
  isResolved: z.boolean(),
});
export type ResolveCommentInput = z.infer<typeof resolveCommentSchema>;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().trim().max(10000).optional().nullable(),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  labels: z.array(z.string().trim().max(50)).default([]),
  linkedArtifactId: z.string().uuid().optional().nullable(),
  linkedCommitHash: z.string().trim().max(128).optional().nullable(),
  linkedReviewId: z.string().uuid().optional().nullable(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10000).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  labels: z.array(z.string().trim().max(50)).optional(),
  linkedArtifactId: z.string().uuid().optional().nullable(),
  linkedCommitHash: z.string().trim().max(128).optional().nullable(),
  linkedReviewId: z.string().uuid().optional().nullable(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const createTaskCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content cannot be empty').max(5000),
});
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;

export const createReviewSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().trim().max(10000).optional().nullable(),
  targetType: z.enum(['branch', 'commit', 'artifact']).default('branch'),
  targetRef: z.string().trim().min(1, 'Target reference is required').max(255),
  reviewerIds: z.array(z.string().uuid()).default([]),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10000).optional().nullable(),
  status: z.enum(REVIEW_STATUSES).optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const submitReviewDecisionSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  feedback: z.string().trim().max(5000).optional().nullable(),
  commitHashAtDecision: z.string().trim().max(128).optional().nullable(),
});
export type SubmitReviewDecisionInput = z.infer<typeof submitReviewDecisionSchema>;

export const createReviewCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content cannot be empty').max(5000),
});
export type CreateReviewCommentInput = z.infer<typeof createReviewCommentSchema>;

export const assignReviewersSchema = z.object({
  reviewerIds: z.array(z.string().uuid()),
});
export type AssignReviewersInput = z.infer<typeof assignReviewersSchema>;

export const queryTasksSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  search: z.string().optional(),
  label: z.string().optional(),
});
export type QueryTasksInput = z.infer<typeof queryTasksSchema>;
