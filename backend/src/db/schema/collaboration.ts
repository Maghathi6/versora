import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';
import { artifacts } from './artifacts';

export const PROJECT_ROLES = ['owner', 'admin', 'member', 'reviewer', 'viewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const INVITATION_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'expired',
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const REVIEW_STATUSES = ['open', 'approved', 'changes_requested', 'closed'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_DECISIONS = ['approved', 'changes_requested'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const NOTIFICATION_TYPES = [
  'invitation',
  'mention',
  'task_assigned',
  'task_updated',
  'review_requested',
  'review_decision',
  'comment_reply',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * 1. Project Members Table
 * Tracks users who belong to a project and their scoped permission roles.
 */
export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_members_project_idx').on(table.projectId),
    index('project_members_user_idx').on(table.userId),
    unique('project_members_project_user_unique').on(table.projectId, table.userId),
  ]
);

/**
 * 2. Project Invitations Table
 * Manages pending, accepted, rejected, cancelled, and expired invites.
 */
export const projectInvitations = pgTable(
  'project_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    token: varchar('token', { length: 128 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_invitations_project_status_idx').on(table.projectId, table.status),
    index('project_invitations_invitee_status_idx').on(table.inviteeId, table.status),
  ]
);

/**
 * 3. Artifact Comments Table
 * Threaded discussions on project artifacts with resolution state and author tracking.
 */
export const artifactComments = pgTable(
  'artifact_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    artifactId: uuid('artifact_id')
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'), // Null for top-level comments, parent ID for threaded replies
    content: text('content').notNull(),
    isResolved: boolean('is_resolved').default(false).notNull(),
    resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    revisionCommitHash: varchar('revision_commit_hash', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('artifact_comments_artifact_created_idx').on(table.artifactId, table.createdAt),
    index('artifact_comments_project_idx').on(table.projectId),
    index('artifact_comments_parent_idx').on(table.parentId),
  ]
);

/**
 * 4. Project Tasks Table
 * Tracks tasks/issues scoped to a project with priority, status, and entity links.
 */
export const projectTasks = pgTable(
  'project_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('todo'),
    priority: varchar('priority', { length: 32 }).notNull().default('medium'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    labels: text('labels'), // JSON stringified array of label tags
    linkedArtifactId: uuid('linked_artifact_id').references(() => artifacts.id, {
      onDelete: 'set null',
    }),
    linkedCommitHash: varchar('linked_commit_hash', { length: 128 }),
    linkedReviewId: uuid('linked_review_id'), // Reference to review if connected
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_tasks_project_status_idx').on(table.projectId, table.status),
    index('project_tasks_project_assignee_idx').on(table.projectId, table.assigneeId),
    index('project_tasks_project_created_idx').on(table.projectId, table.createdAt),
  ]
);

/**
 * 5. Project Task Comments Table
 * Discussions and updates on individual project tasks.
 */
export const projectTaskComments = pgTable(
  'project_task_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => projectTasks.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('project_task_comments_task_created_idx').on(table.taskId, table.createdAt)]
);

/**
 * 6. Project Reviews Table
 * Formal review requests for branches, commits, or artifacts.
 */
export const projectReviews = pgTable(
  'project_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    targetType: varchar('target_type', { length: 32 }).notNull().default('branch'), // 'branch' | 'commit' | 'artifact'
    targetRef: varchar('target_ref', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    closedById: uuid('closed_by_id').references(() => users.id, { onDelete: 'set null' }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_reviews_project_status_idx').on(table.projectId, table.status),
    index('project_reviews_project_created_idx').on(table.projectId, table.createdAt),
  ]
);

/**
 * 7. Project Reviewers Table
 * Reviewer assignments for a review request.
 */
export const projectReviewers = pgTable(
  'project_reviewers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => projectReviews.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_reviewers_review_idx').on(table.reviewId),
    unique('project_reviewers_review_user_unique').on(table.reviewId, table.reviewerId),
  ]
);

/**
 * 8. Project Review Decisions Table
 * Approvals and change-requests submitted by assigned reviewers.
 */
export const projectReviewDecisions = pgTable(
  'project_review_decisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => projectReviews.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    decision: varchar('decision', { length: 32 }).notNull(), // 'approved' | 'changes_requested'
    feedback: text('feedback'),
    commitHashAtDecision: varchar('commit_hash_at_decision', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_review_decisions_review_idx').on(table.reviewId),
    unique('project_review_decisions_review_user_unique').on(table.reviewId, table.reviewerId),
  ]
);

/**
 * 9. Project Review Comments Table
 * Feedback and discussion comments attached to a review request.
 */
export const projectReviewComments = pgTable(
  'project_review_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => projectReviews.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('project_review_comments_review_created_idx').on(table.reviewId, table.createdAt)]
);

/**
 * 10. Notifications Table
 * Persisted in-app notifications scoped to users for invites, assignments, reviews, mentions.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    entityType: varchar('entity_type', { length: 32 }).notNull(),
    entityId: varchar('entity_id', { length: 128 }).notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_recipient_read_idx').on(table.recipientId, table.isRead),
    index('notifications_recipient_created_idx').on(table.recipientId, table.createdAt),
  ]
);

// Type Exports
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;

export type ProjectInvitation = typeof projectInvitations.$inferSelect;
export type NewProjectInvitation = typeof projectInvitations.$inferInsert;

export type ArtifactComment = typeof artifactComments.$inferSelect;
export type NewArtifactComment = typeof artifactComments.$inferInsert;

export type ProjectTask = typeof projectTasks.$inferSelect;
export type NewProjectTask = typeof projectTasks.$inferInsert;

export type ProjectTaskComment = typeof projectTaskComments.$inferSelect;
export type NewProjectTaskComment = typeof projectTaskComments.$inferInsert;

export type ProjectReview = typeof projectReviews.$inferSelect;
export type NewProjectReview = typeof projectReviews.$inferInsert;

export type ProjectReviewer = typeof projectReviewers.$inferSelect;
export type NewProjectReviewer = typeof projectReviewers.$inferInsert;

export type ProjectReviewDecision = typeof projectReviewDecisions.$inferSelect;
export type NewProjectReviewDecision = typeof projectReviewDecisions.$inferInsert;

export type ProjectReviewComment = typeof projectReviewComments.$inferSelect;
export type NewProjectReviewComment = typeof projectReviewComments.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
