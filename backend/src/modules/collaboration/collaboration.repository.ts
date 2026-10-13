import { eq, and, or, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  projectMembers,
  projectInvitations,
  artifactComments,
  projectTasks,
  projectTaskComments,
  projectReviews,
  projectReviewers,
  projectReviewDecisions,
  projectReviewComments,
  notifications,
  ProjectMember,
  NewProjectMember,
  ProjectInvitation,
  NewProjectInvitation,
  ArtifactComment,
  NewArtifactComment,
  ProjectTask,
  NewProjectTask,
  ProjectTaskComment,
  NewProjectTaskComment,
  ProjectReview,
  NewProjectReview,
  ProjectReviewer,
  NewProjectReviewer,
  ProjectReviewDecision,
  NewProjectReviewDecision,
  ProjectReviewComment,
  NewProjectReviewComment,
  Notification,
  NewNotification,
} from '../../db/schema/collaboration';
import { users } from '../../db/schema/users';
import { projects } from '../../db/schema/projects';
import { artifacts } from '../../db/schema/artifacts';
import {
  ProjectRole,
  InvitationStatus,
  ProjectMemberResponse,
  ProjectInvitationResponse,
  ArtifactCommentResponse,
  ProjectTaskResponse,
  TaskCommentResponse,
  ProjectReviewResponse,
  ReviewCommentResponse,
  NotificationResponse,
  CollaborationUserSummary,
} from './collaboration.types';
import { QueryTasksInput } from './collaboration.schemas';

export interface ICollaborationRepository {
  // Members
  findMember(projectId: string, userId: string): Promise<ProjectMember | null>;
  listMembers(projectId: string): Promise<ProjectMemberResponse[]>;
  addMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember>;
  updateMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember | null>;
  removeMember(projectId: string, userId: string): Promise<boolean>;
  countOwners(projectId: string): Promise<number>;
  listUserProjectIds(userId: string): Promise<string[]>;

  // Invitations
  createInvitation(data: NewProjectInvitation): Promise<ProjectInvitation>;
  findInvitationById(id: string): Promise<ProjectInvitation | null>;
  findInvitationByToken(token: string): Promise<ProjectInvitation | null>;
  findPendingInvitation(projectId: string, inviteeId: string): Promise<ProjectInvitation | null>;
  listProjectInvitations(projectId: string): Promise<ProjectInvitationResponse[]>;
  listUserInvitations(userId: string): Promise<ProjectInvitationResponse[]>;
  updateInvitationStatus(id: string, status: InvitationStatus): Promise<ProjectInvitation | null>;

  // Comments
  createComment(data: NewArtifactComment): Promise<ArtifactComment>;
  findCommentById(id: string): Promise<ArtifactComment | null>;
  listArtifactComments(artifactId: string): Promise<ArtifactCommentResponse[]>;
  updateComment(id: string, content: string): Promise<ArtifactComment | null>;
  deleteComment(id: string): Promise<boolean>;
  setCommentResolved(id: string, isResolved: boolean, resolvedById: string | null): Promise<ArtifactComment | null>;

  // Tasks
  createTask(data: NewProjectTask): Promise<ProjectTask>;
  findTaskById(id: string): Promise<ProjectTaskResponse | null>;
  listTasks(projectId: string, filters?: QueryTasksInput): Promise<ProjectTaskResponse[]>;
  updateTask(id: string, data: Partial<NewProjectTask>): Promise<ProjectTask | null>;
  deleteTask(id: string): Promise<boolean>;

  // Task Comments
  createTaskComment(data: NewProjectTaskComment): Promise<ProjectTaskComment>;
  listTaskComments(taskId: string): Promise<TaskCommentResponse[]>;

  // Reviews
  createReview(data: NewProjectReview): Promise<ProjectReview>;
  findReviewById(id: string): Promise<ProjectReviewResponse | null>;
  listReviews(projectId: string): Promise<ProjectReviewResponse[]>;
  updateReview(id: string, data: Partial<NewProjectReview>): Promise<ProjectReview | null>;
  addReviewer(reviewId: string, reviewerId: string): Promise<ProjectReviewer>;
  removeReviewer(reviewId: string, reviewerId: string): Promise<boolean>;
  upsertDecision(data: NewProjectReviewDecision): Promise<ProjectReviewDecision>;
  createReviewComment(data: NewProjectReviewComment): Promise<ProjectReviewComment>;
  listReviewComments(reviewId: string): Promise<ReviewCommentResponse[]>;

  // Notifications
  createNotification(data: NewNotification): Promise<Notification>;
  findDuplicateNotification(
    recipientId: string,
    type: string,
    entityType: string,
    entityId: string,
    actorId?: string | null
  ): Promise<Notification | null>;
  listNotifications(recipientId: string, limit?: number, offset?: number): Promise<NotificationResponse[]>;
  getUnreadNotificationCount(recipientId: string): Promise<number>;
  markNotificationAsRead(id: string, recipientId: string): Promise<boolean>;
  markAllNotificationsAsRead(recipientId: string): Promise<number>;
}

export const collaborationRepository: ICollaborationRepository = {
  // ---------------- MEMBERS ----------------
  async findMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    const rows = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .limit(1);
    return rows[0] || null;
  },

  async listMembers(projectId: string): Promise<ProjectMemberResponse[]> {
    const rows = await db
      .select({
        member: projectMembers,
        user: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.createdAt));

    return rows.map((r) => ({
      id: r.member.id,
      projectId: r.member.projectId,
      userId: r.member.userId,
      role: r.member.role as ProjectRole,
      createdAt: r.member.createdAt.toISOString(),
      updatedAt: r.member.updatedAt.toISOString(),
      user: r.user,
    }));
  },

  async addMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
    const rows = await db
      .insert(projectMembers)
      .values({
        projectId,
        userId,
        role,
      })
      .returning();
    return rows[0];
  },

  async updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole
  ): Promise<ProjectMember | null> {
    const rows = await db
      .update(projectMembers)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .returning();
    return rows[0] || null;
  },

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    const rows = await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .returning({ id: projectMembers.id });
    return rows.length > 0;
  },

  async countOwners(projectId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')));
    return Number(rows[0]?.count || 0);
  },

  async listUserProjectIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    return rows.map((r) => r.projectId);
  },

  // ---------------- INVITATIONS ----------------
  async createInvitation(data: NewProjectInvitation): Promise<ProjectInvitation> {
    const rows = await db.insert(projectInvitations).values(data).returning();
    return rows[0];
  },

  async findInvitationById(id: string): Promise<ProjectInvitation | null> {
    const rows = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, id))
      .limit(1);
    return rows[0] || null;
  },

  async findInvitationByToken(token: string): Promise<ProjectInvitation | null> {
    const rows = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.token, token))
      .limit(1);
    return rows[0] || null;
  },

  async findPendingInvitation(projectId: string, inviteeId: string): Promise<ProjectInvitation | null> {
    const rows = await db
      .select()
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, projectId),
          eq(projectInvitations.inviteeId, inviteeId),
          eq(projectInvitations.status, 'pending')
        )
      )
      .limit(1);
    return rows[0] || null;
  },

  async listProjectInvitations(projectId: string): Promise<ProjectInvitationResponse[]> {
    const rows = await db
      .select({
        invitation: projectInvitations,
        inviter: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectInvitations)
      .innerJoin(users, eq(projectInvitations.inviterId, users.id))
      .where(eq(projectInvitations.projectId, projectId))
      .orderBy(desc(projectInvitations.createdAt));

    // Fetch invitees
    const inviteeIds = [...new Set(rows.map((r) => r.invitation.inviteeId))];
    let inviteesMap = new Map<string, CollaborationUserSummary>();
    if (inviteeIds.length > 0) {
      const invitees = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.id, inviteeIds));
      inviteesMap = new Map(invitees.map((u) => [u.id, u]));
    }

    return rows.map((r) => ({
      id: r.invitation.id,
      projectId: r.invitation.projectId,
      inviterId: r.invitation.inviterId,
      inviteeId: r.invitation.inviteeId,
      role: r.invitation.role as ProjectRole,
      status: r.invitation.status as InvitationStatus,
      token: r.invitation.token,
      expiresAt: r.invitation.expiresAt.toISOString(),
      createdAt: r.invitation.createdAt.toISOString(),
      updatedAt: r.invitation.updatedAt.toISOString(),
      inviter: r.inviter,
      invitee: inviteesMap.get(r.invitation.inviteeId) || {
        id: r.invitation.inviteeId,
        email: '',
        username: 'unknown',
        displayName: null,
        avatarUrl: null,
      },
    }));
  },

  async listUserInvitations(userId: string): Promise<ProjectInvitationResponse[]> {
    const rows = await db
      .select({
        invitation: projectInvitations,
        project: {
          id: projects.id,
          name: projects.name,
        },
        inviter: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectInvitations)
      .innerJoin(projects, eq(projectInvitations.projectId, projects.id))
      .innerJoin(users, eq(projectInvitations.inviterId, users.id))
      .where(and(eq(projectInvitations.inviteeId, userId), eq(projectInvitations.status, 'pending')))
      .orderBy(desc(projectInvitations.createdAt));

    const currentUser = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userSummary: CollaborationUserSummary = currentUser[0] || {
      id: userId,
      email: '',
      username: '',
      displayName: null,
      avatarUrl: null,
    };

    return rows.map((r) => ({
      id: r.invitation.id,
      projectId: r.invitation.projectId,
      inviterId: r.invitation.inviterId,
      inviteeId: r.invitation.inviteeId,
      role: r.invitation.role as ProjectRole,
      status: r.invitation.status as InvitationStatus,
      token: r.invitation.token,
      expiresAt: r.invitation.expiresAt.toISOString(),
      createdAt: r.invitation.createdAt.toISOString(),
      updatedAt: r.invitation.updatedAt.toISOString(),
      inviter: r.inviter,
      invitee: userSummary,
      projectName: r.project.name,
    }));
  },

  async updateInvitationStatus(id: string, status: InvitationStatus): Promise<ProjectInvitation | null> {
    const rows = await db
      .update(projectInvitations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(projectInvitations.id, id))
      .returning();
    return rows[0] || null;
  },

  // ---------------- COMMENTS ----------------
  async createComment(data: NewArtifactComment): Promise<ArtifactComment> {
    const rows = await db.insert(artifactComments).values(data).returning();
    return rows[0];
  },

  async findCommentById(id: string): Promise<ArtifactComment | null> {
    const rows = await db
      .select()
      .from(artifactComments)
      .where(eq(artifactComments.id, id))
      .limit(1);
    return rows[0] || null;
  },

  async listArtifactComments(artifactId: string): Promise<ArtifactCommentResponse[]> {
    const rows = await db
      .select({
        comment: artifactComments,
        author: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(artifactComments)
      .innerJoin(users, eq(artifactComments.authorId, users.id))
      .where(eq(artifactComments.artifactId, artifactId))
      .orderBy(asc(artifactComments.createdAt));

    const commentsMap = new Map<string, ArtifactCommentResponse>();
    const topLevel: ArtifactCommentResponse[] = [];

    // First pass: create all comment objects
    for (const r of rows) {
      const resp: ArtifactCommentResponse = {
        id: r.comment.id,
        projectId: r.comment.projectId,
        artifactId: r.comment.artifactId,
        authorId: r.comment.authorId,
        parentId: r.comment.parentId,
        content: r.comment.content,
        isResolved: r.comment.isResolved,
        resolvedById: r.comment.resolvedById,
        resolvedAt: r.comment.resolvedAt ? r.comment.resolvedAt.toISOString() : null,
        revisionCommitHash: r.comment.revisionCommitHash,
        createdAt: r.comment.createdAt.toISOString(),
        updatedAt: r.comment.updatedAt.toISOString(),
        author: r.author,
        replyCount: 0,
        replies: [],
      };
      commentsMap.set(resp.id, resp);
    }

    // Second pass: nest replies
    for (const comment of commentsMap.values()) {
      if (comment.parentId && commentsMap.has(comment.parentId)) {
        const parent = commentsMap.get(comment.parentId)!;
        parent.replies = parent.replies || [];
        parent.replies.push(comment);
        parent.replyCount = (parent.replyCount || 0) + 1;
      } else {
        topLevel.push(comment);
      }
    }

    return topLevel;
  },

  async updateComment(id: string, content: string): Promise<ArtifactComment | null> {
    const rows = await db
      .update(artifactComments)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(artifactComments.id, id))
      .returning();
    return rows[0] || null;
  },

  async deleteComment(id: string): Promise<boolean> {
    const rows = await db
      .delete(artifactComments)
      .where(eq(artifactComments.id, id))
      .returning({ id: artifactComments.id });
    return rows.length > 0;
  },

  async setCommentResolved(
    id: string,
    isResolved: boolean,
    resolvedById: string | null
  ): Promise<ArtifactComment | null> {
    const rows = await db
      .update(artifactComments)
      .set({
        isResolved,
        resolvedById: isResolved ? resolvedById : null,
        resolvedAt: isResolved ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(artifactComments.id, id))
      .returning();
    return rows[0] || null;
  },

  // ---------------- TASKS ----------------
  async createTask(data: NewProjectTask): Promise<ProjectTask> {
    const rows = await db.insert(projectTasks).values(data).returning();
    return rows[0];
  },

  async findTaskById(id: string): Promise<ProjectTaskResponse | null> {
    const rows = await db
      .select({
        task: projectTasks,
        creator: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectTasks)
      .innerJoin(users, eq(projectTasks.creatorId, users.id))
      .where(eq(projectTasks.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];

    let assignee: CollaborationUserSummary | null = null;
    if (r.task.assigneeId) {
      const aRows = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, r.task.assigneeId))
        .limit(1);
      assignee = aRows[0] || null;
    }

    let linkedArtifact: { id: string; name: string; path: string } | null = null;
    if (r.task.linkedArtifactId) {
      const artRows = await db
        .select({
          id: artifacts.id,
          name: artifacts.name,
          path: artifacts.path,
        })
        .from(artifacts)
        .where(eq(artifacts.id, r.task.linkedArtifactId))
        .limit(1);
      linkedArtifact = artRows[0] || null;
    }

    // Comment count
    const commentCountRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectTaskComments)
      .where(eq(projectTaskComments.taskId, id));

    let labels: string[] = [];
    if (r.task.labels) {
      try {
        labels = JSON.parse(r.task.labels);
      } catch {
        labels = [];
      }
    }

    return {
      id: r.task.id,
      projectId: r.task.projectId,
      creatorId: r.task.creatorId,
      assigneeId: r.task.assigneeId,
      title: r.task.title,
      description: r.task.description,
      status: r.task.status as any,
      priority: r.task.priority as any,
      dueDate: r.task.dueDate ? r.task.dueDate.toISOString() : null,
      labels,
      linkedArtifactId: r.task.linkedArtifactId,
      linkedCommitHash: r.task.linkedCommitHash,
      linkedReviewId: r.task.linkedReviewId,
      createdAt: r.task.createdAt.toISOString(),
      updatedAt: r.task.updatedAt.toISOString(),
      creator: r.creator,
      assignee,
      linkedArtifact,
      commentsCount: Number(commentCountRows[0]?.count || 0),
    };
  },

  async listTasks(projectId: string, filters?: QueryTasksInput): Promise<ProjectTaskResponse[]> {
    const conditions = [eq(projectTasks.projectId, projectId)];

    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(projectTasks.status, filters.status));
    }
    if (filters?.priority && filters.priority !== 'all') {
      conditions.push(eq(projectTasks.priority, filters.priority));
    }
    if (filters?.assigneeId) {
      conditions.push(eq(projectTasks.assigneeId, filters.assigneeId));
    }

    const rows = await db
      .select({
        task: projectTasks,
        creator: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectTasks)
      .innerJoin(users, eq(projectTasks.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(projectTasks.createdAt));

    // Batch load assignees
    const assigneeIds = [...new Set(rows.map((r) => r.task.assigneeId).filter(Boolean))] as string[];
    let assigneesMap = new Map<string, CollaborationUserSummary>();
    if (assigneeIds.length > 0) {
      const aUsers = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.id, assigneeIds));
      assigneesMap = new Map(aUsers.map((u) => [u.id, u]));
    }

    // Filter in-memory for search query and labels if specified
    return rows
      .map((r) => {
        let labels: string[] = [];
        if (r.task.labels) {
          try {
            labels = JSON.parse(r.task.labels);
          } catch {
            labels = [];
          }
        }

        return {
          id: r.task.id,
          projectId: r.task.projectId,
          creatorId: r.task.creatorId,
          assigneeId: r.task.assigneeId,
          title: r.task.title,
          description: r.task.description,
          status: r.task.status as any,
          priority: r.task.priority as any,
          dueDate: r.task.dueDate ? r.task.dueDate.toISOString() : null,
          labels,
          linkedArtifactId: r.task.linkedArtifactId,
          linkedCommitHash: r.task.linkedCommitHash,
          linkedReviewId: r.task.linkedReviewId,
          createdAt: r.task.createdAt.toISOString(),
          updatedAt: r.task.updatedAt.toISOString(),
          creator: r.creator,
          assignee: r.task.assigneeId ? assigneesMap.get(r.task.assigneeId) || null : null,
          linkedArtifact: null,
        };
      })
      .filter((task) => {
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          const matchTitle = task.title.toLowerCase().includes(s);
          const matchDesc = task.description?.toLowerCase().includes(s);
          if (!matchTitle && !matchDesc) return false;
        }
        if (filters?.label) {
          if (!task.labels.includes(filters.label)) return false;
        }
        return true;
      });
  },

  async updateTask(id: string, data: Partial<NewProjectTask>): Promise<ProjectTask | null> {
    const rows = await db
      .update(projectTasks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projectTasks.id, id))
      .returning();
    return rows[0] || null;
  },

  async deleteTask(id: string): Promise<boolean> {
    const rows = await db
      .delete(projectTasks)
      .where(eq(projectTasks.id, id))
      .returning({ id: projectTasks.id });
    return rows.length > 0;
  },

  // ---------------- TASK COMMENTS ----------------
  async createTaskComment(data: NewProjectTaskComment): Promise<ProjectTaskComment> {
    const rows = await db.insert(projectTaskComments).values(data).returning();
    return rows[0];
  },

  async listTaskComments(taskId: string): Promise<TaskCommentResponse[]> {
    const rows = await db
      .select({
        comment: projectTaskComments,
        author: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectTaskComments)
      .innerJoin(users, eq(projectTaskComments.authorId, users.id))
      .where(eq(projectTaskComments.taskId, taskId))
      .orderBy(asc(projectTaskComments.createdAt));

    return rows.map((r) => ({
      id: r.comment.id,
      taskId: r.comment.taskId,
      authorId: r.comment.authorId,
      content: r.comment.content,
      createdAt: r.comment.createdAt.toISOString(),
      updatedAt: r.comment.updatedAt.toISOString(),
      author: r.author,
    }));
  },

  // ---------------- REVIEWS ----------------
  async createReview(data: NewProjectReview): Promise<ProjectReview> {
    const rows = await db.insert(projectReviews).values(data).returning();
    return rows[0];
  },

  async findReviewById(id: string): Promise<ProjectReviewResponse | null> {
    const rows = await db
      .select({
        review: projectReviews,
        creator: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectReviews)
      .innerJoin(users, eq(projectReviews.creatorId, users.id))
      .where(eq(projectReviews.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];

    // Fetch Reviewers with Decisions
    const reviewerRows = await db
      .select({
        assignment: projectReviewers,
        user: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectReviewers)
      .innerJoin(users, eq(projectReviewers.reviewerId, users.id))
      .where(eq(projectReviewers.reviewId, id));

    // Fetch decisions for this review
    const decisions = await db
      .select()
      .from(projectReviewDecisions)
      .where(eq(projectReviewDecisions.reviewId, id));
    const decisionsMap = new Map(decisions.map((d) => [d.reviewerId, d]));

    let approvedCount = 0;
    let changesRequestedCount = 0;

    const mappedReviewers = reviewerRows.map((rev) => {
      const dec = decisionsMap.get(rev.user.id);
      if (dec) {
        if (dec.decision === 'approved') approvedCount++;
        if (dec.decision === 'changes_requested') changesRequestedCount++;
      }
      return {
        id: rev.assignment.id,
        reviewId: rev.assignment.reviewId,
        reviewerId: rev.assignment.reviewerId,
        createdAt: rev.assignment.createdAt.toISOString(),
        user: rev.user,
        decision: dec
          ? {
              decision: dec.decision as any,
              feedback: dec.feedback,
              commitHashAtDecision: dec.commitHashAtDecision,
              createdAt: dec.createdAt.toISOString(),
              updatedAt: dec.updatedAt.toISOString(),
            }
          : null,
      };
    });

    // Comments count
    const commentCountRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectReviewComments)
      .where(eq(projectReviewComments.reviewId, id));

    return {
      id: r.review.id,
      projectId: r.review.projectId,
      creatorId: r.review.creatorId,
      title: r.review.title,
      description: r.review.description,
      targetType: r.review.targetType as any,
      targetRef: r.review.targetRef,
      status: r.review.status as any,
      closedById: r.review.closedById,
      closedAt: r.review.closedAt ? r.review.closedAt.toISOString() : null,
      createdAt: r.review.createdAt.toISOString(),
      updatedAt: r.review.updatedAt.toISOString(),
      creator: r.creator,
      reviewers: mappedReviewers,
      decisionsCount: {
        approved: approvedCount,
        changesRequested: changesRequestedCount,
      },
      commentsCount: Number(commentCountRows[0]?.count || 0),
    };
  },

  async listReviews(projectId: string): Promise<ProjectReviewResponse[]> {
    const rows = await db
      .select({
        review: projectReviews,
        creator: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectReviews)
      .innerJoin(users, eq(projectReviews.creatorId, users.id))
      .where(eq(projectReviews.projectId, projectId))
      .orderBy(desc(projectReviews.createdAt));

    // Batch load reviewers for all reviews in this project
    const reviewIds = rows.map((r) => r.review.id);
    if (reviewIds.length === 0) return [];

    const allReviewers = await db
      .select({
        assignment: projectReviewers,
        user: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectReviewers)
      .innerJoin(users, eq(projectReviewers.reviewerId, users.id))
      .where(inArray(projectReviewers.reviewId, reviewIds));

    const allDecisions = await db
      .select()
      .from(projectReviewDecisions)
      .where(inArray(projectReviewDecisions.reviewId, reviewIds));

    const decisionsByReviewAndUser = new Map<string, ProjectReviewDecision>();
    for (const d of allDecisions) {
      decisionsByReviewAndUser.set(`${d.reviewId}:${d.reviewerId}`, d);
    }

    const reviewersByReview = new Map<string, any[]>();
    for (const rev of allReviewers) {
      const dec = decisionsByReviewAndUser.get(`${rev.assignment.reviewId}:${rev.user.id}`);
      const list = reviewersByReview.get(rev.assignment.reviewId) || [];
      list.push({
        id: rev.assignment.id,
        reviewId: rev.assignment.reviewId,
        reviewerId: rev.assignment.reviewerId,
        createdAt: rev.assignment.createdAt.toISOString(),
        user: rev.user,
        decision: dec
          ? {
              decision: dec.decision as any,
              feedback: dec.feedback,
              commitHashAtDecision: dec.commitHashAtDecision,
              createdAt: dec.createdAt.toISOString(),
              updatedAt: dec.updatedAt.toISOString(),
            }
          : null,
      });
      reviewersByReview.set(rev.assignment.reviewId, list);
    }

    return rows.map((r) => {
      const reviewers = reviewersByReview.get(r.review.id) || [];
      let approvedCount = 0;
      let changesRequestedCount = 0;
      for (const rev of reviewers) {
        if (rev.decision?.decision === 'approved') approvedCount++;
        if (rev.decision?.decision === 'changes_requested') changesRequestedCount++;
      }

      return {
        id: r.review.id,
        projectId: r.review.projectId,
        creatorId: r.review.creatorId,
        title: r.review.title,
        description: r.review.description,
        targetType: r.review.targetType as any,
        targetRef: r.review.targetRef,
        status: r.review.status as any,
        closedById: r.review.closedById,
        closedAt: r.review.closedAt ? r.review.closedAt.toISOString() : null,
        createdAt: r.review.createdAt.toISOString(),
        updatedAt: r.review.updatedAt.toISOString(),
        creator: r.creator,
        reviewers,
        decisionsCount: {
          approved: approvedCount,
          changesRequested: changesRequestedCount,
        },
      };
    });
  },

  async updateReview(id: string, data: Partial<NewProjectReview>): Promise<ProjectReview | null> {
    const rows = await db
      .update(projectReviews)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projectReviews.id, id))
      .returning();
    return rows[0] || null;
  },

  async addReviewer(reviewId: string, reviewerId: string): Promise<ProjectReviewer> {
    const rows = await db
      .insert(projectReviewers)
      .values({ reviewId, reviewerId })
      .onConflictDoNothing()
      .returning();
    if (rows.length > 0) return rows[0];
    const existing = await db
      .select()
      .from(projectReviewers)
      .where(and(eq(projectReviewers.reviewId, reviewId), eq(projectReviewers.reviewerId, reviewerId)))
      .limit(1);
    return existing[0];
  },

  async removeReviewer(reviewId: string, reviewerId: string): Promise<boolean> {
    const rows = await db
      .delete(projectReviewers)
      .where(and(eq(projectReviewers.reviewId, reviewId), eq(projectReviewers.reviewerId, reviewerId)))
      .returning({ id: projectReviewers.id });
    return rows.length > 0;
  },

  async upsertDecision(data: NewProjectReviewDecision): Promise<ProjectReviewDecision> {
    const existing = await db
      .select()
      .from(projectReviewDecisions)
      .where(
        and(
          eq(projectReviewDecisions.reviewId, data.reviewId),
          eq(projectReviewDecisions.reviewerId, data.reviewerId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(projectReviewDecisions)
        .set({
          decision: data.decision,
          feedback: data.feedback,
          commitHashAtDecision: data.commitHashAtDecision,
          updatedAt: new Date(),
        })
        .where(eq(projectReviewDecisions.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const created = await db.insert(projectReviewDecisions).values(data).returning();
      return created[0];
    }
  },

  async createReviewComment(data: NewProjectReviewComment): Promise<ProjectReviewComment> {
    const rows = await db.insert(projectReviewComments).values(data).returning();
    return rows[0];
  },

  async listReviewComments(reviewId: string): Promise<ReviewCommentResponse[]> {
    const rows = await db
      .select({
        comment: projectReviewComments,
        author: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectReviewComments)
      .innerJoin(users, eq(projectReviewComments.authorId, users.id))
      .where(eq(projectReviewComments.reviewId, reviewId))
      .orderBy(asc(projectReviewComments.createdAt));

    return rows.map((r) => ({
      id: r.comment.id,
      reviewId: r.comment.reviewId,
      authorId: r.comment.authorId,
      content: r.comment.content,
      createdAt: r.comment.createdAt.toISOString(),
      updatedAt: r.comment.updatedAt.toISOString(),
      author: r.author,
    }));
  },

  // ---------------- NOTIFICATIONS ----------------
  async createNotification(data: NewNotification): Promise<Notification> {
    const rows = await db.insert(notifications).values(data).returning();
    return rows[0];
  },

  async findDuplicateNotification(
    recipientId: string,
    type: string,
    entityType: string,
    entityId: string,
    actorId?: string | null
  ): Promise<Notification | null> {
    const conditions = [
      eq(notifications.recipientId, recipientId),
      eq(notifications.type, type),
      eq(notifications.entityType, entityType),
      eq(notifications.entityId, entityId),
    ];
    if (actorId) {
      conditions.push(eq(notifications.actorId, actorId));
    }
    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .limit(1);
    return rows[0] || null;
  },

  async listNotifications(
    recipientId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationResponse[]> {
    const rows = await db
      .select({
        notification: notifications,
        actor: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .leftJoin(projects, eq(notifications.projectId, projects.id))
      .where(eq(notifications.recipientId, recipientId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.notification.id,
      recipientId: r.notification.recipientId,
      actorId: r.notification.actorId,
      projectId: r.notification.projectId,
      type: r.notification.type as any,
      title: r.notification.title,
      message: r.notification.message,
      entityType: r.notification.entityType,
      entityId: r.notification.entityId,
      isRead: r.notification.isRead,
      readAt: r.notification.readAt ? r.notification.readAt.toISOString() : null,
      createdAt: r.notification.createdAt.toISOString(),
      actor: r.actor?.id ? r.actor : null,
      projectName: r.project?.name || null,
    }));
  },

  async getUnreadNotificationCount(recipientId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, recipientId), eq(notifications.isRead, false)));
    return Number(rows[0]?.count || 0);
  },

  async markNotificationAsRead(id: string, recipientId: string): Promise<boolean> {
    const rows = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, recipientId)))
      .returning({ id: notifications.id });
    return rows.length > 0;
  },

  async markAllNotificationsAsRead(recipientId: string): Promise<number> {
    const rows = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(eq(notifications.recipientId, recipientId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    return rows.length;
  },
};
