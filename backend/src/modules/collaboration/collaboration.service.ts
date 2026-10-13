import crypto from 'node:crypto';
import {
  ICollaborationRepository,
  collaborationRepository,
} from './collaboration.repository';
import { IProjectRepository, projectRepository } from '../projects/project.repository';
import { IUserRepository, userRepository } from '../users/user.repository';
import { IArtifactRepository, artifactRepository } from '../artifacts/artifact.repository';
import { IGitService, gitService } from '../git/git.service';
import {
  IIntelligenceService,
  intelligenceService,
} from '../intelligence/intelligence.service';
import { Project } from '../projects/project.types';
import {
  ProjectRole,
  ROLE_LEVELS,
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
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  createCommentSchema,
  updateCommentSchema,
  resolveCommentSchema,
  createTaskSchema,
  updateTaskSchema,
  createTaskCommentSchema,
  createReviewSchema,
  updateReviewSchema,
  submitReviewDecisionSchema,
  createReviewCommentSchema,
  assignReviewersSchema,
  queryTasksSchema,
  InviteMemberInput,
  UpdateMemberRoleInput,
  CreateCommentInput,
  UpdateCommentInput,
  ResolveCommentInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTaskCommentInput,
  CreateReviewInput,
  UpdateReviewInput,
  SubmitReviewDecisionInput,
  CreateReviewCommentInput,
  AssignReviewersInput,
  QueryTasksInput,
} from './collaboration.schemas';
import {
  CollaborationValidationError,
  CollaborationNotFoundError,
  CollaborationForbiddenError,
  LastOwnerCannotBeRemovedError,
  RoleEscalationError,
  CannotInviteSelfError,
  UserAlreadyMemberError,
  PendingInvitationExistsError,
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyHandledError,
  UnauthorizedInvitationActionError,
  InvalidReviewTargetError,
  ReviewClosedError,
} from './collaboration.errors';
import { ProjectNotFoundError, ProjectForbiddenError } from '../projects/project.errors';
import { ArtifactNotFoundError } from '../artifacts/artifact.errors';

function sanitizeContent(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

export interface ICollaborationService {
  checkProjectAccess(
    userId: string,
    projectId: string,
    minRole?: ProjectRole
  ): Promise<{ project: Project; effectiveRole: ProjectRole }>;

  // Team
  listMembers(userId: string, projectId: string): Promise<ProjectMemberResponse[]>;
  inviteMember(userId: string, projectId: string, rawInput: unknown): Promise<ProjectInvitationResponse>;
  listProjectInvitations(userId: string, projectId: string): Promise<ProjectInvitationResponse[]>;
  listUserInvitations(userId: string): Promise<ProjectInvitationResponse[]>;
  respondToInvitation(userId: string, token: string, action: 'accept' | 'reject'): Promise<ProjectInvitationResponse>;
  cancelInvitation(userId: string, projectId: string, invitationId: string): Promise<void>;
  updateMemberRole(userId: string, projectId: string, targetUserId: string, rawInput: unknown): Promise<ProjectMemberResponse>;
  removeMember(userId: string, projectId: string, targetUserId: string): Promise<void>;

  // Comments
  createComment(userId: string, projectId: string, artifactId: string, rawInput: unknown): Promise<ArtifactCommentResponse>;
  listArtifactComments(userId: string, projectId: string, artifactId: string): Promise<ArtifactCommentResponse[]>;
  updateComment(userId: string, projectId: string, commentId: string, rawInput: unknown): Promise<ArtifactCommentResponse>;
  deleteComment(userId: string, projectId: string, commentId: string): Promise<void>;
  resolveComment(userId: string, projectId: string, commentId: string, rawInput: unknown): Promise<ArtifactCommentResponse>;

  // Tasks
  createTask(userId: string, projectId: string, rawInput: unknown): Promise<ProjectTaskResponse>;
  getTask(userId: string, projectId: string, taskId: string): Promise<ProjectTaskResponse>;
  listTasks(userId: string, projectId: string, rawQuery?: unknown): Promise<ProjectTaskResponse[]>;
  updateTask(userId: string, projectId: string, taskId: string, rawInput: unknown): Promise<ProjectTaskResponse>;
  deleteTask(userId: string, projectId: string, taskId: string): Promise<void>;
  createTaskComment(userId: string, projectId: string, taskId: string, rawInput: unknown): Promise<TaskCommentResponse>;
  listTaskComments(userId: string, projectId: string, taskId: string): Promise<TaskCommentResponse[]>;

  // Reviews
  createReview(userId: string, projectId: string, rawInput: unknown): Promise<ProjectReviewResponse>;
  getReview(userId: string, projectId: string, reviewId: string): Promise<ProjectReviewResponse>;
  listReviews(userId: string, projectId: string): Promise<ProjectReviewResponse[]>;
  updateReview(userId: string, projectId: string, reviewId: string, rawInput: unknown): Promise<ProjectReviewResponse>;
  submitReviewDecision(userId: string, projectId: string, reviewId: string, rawInput: unknown): Promise<ProjectReviewResponse>;
  assignReviewers(userId: string, projectId: string, reviewId: string, rawInput: unknown): Promise<ProjectReviewResponse>;
  createReviewComment(userId: string, projectId: string, reviewId: string, rawInput: unknown): Promise<ReviewCommentResponse>;
  listReviewComments(userId: string, projectId: string, reviewId: string): Promise<ReviewCommentResponse[]>;

  // Notifications
  listNotifications(userId: string, limit?: number, offset?: number): Promise<NotificationResponse[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(userId: string, notificationId: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<number>;
}

export class CollaborationService implements ICollaborationService {
  constructor(
    private collabRepo: ICollaborationRepository = collaborationRepository,
    private projRepo: IProjectRepository = projectRepository,
    private userRepo: IUserRepository = userRepository,
    private artRepo: IArtifactRepository = artifactRepository,
    private gitSvc: IGitService = gitService,
    private intellSvc: IIntelligenceService = intelligenceService
  ) {}

  /**
   * Central authorization helper.
   * Resolves whether a user can access a project and checks minimum required role.
   */
  async checkProjectAccess(
    userId: string,
    projectId: string,
    minRole: ProjectRole = 'viewer'
  ): Promise<{ project: Project; effectiveRole: ProjectRole }> {
    const project = await this.projRepo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    let effectiveRole: ProjectRole | null = null;
    if (project.ownerId === userId) {
      effectiveRole = 'owner';
    } else {
      const member = await this.collabRepo.findMember(projectId, userId);
      if (member) {
        effectiveRole = member.role as ProjectRole;
      }
    }

    if (!effectiveRole) {
      throw new ProjectForbiddenError('You do not have permission to access this project.');
    }

    if (ROLE_LEVELS[effectiveRole] < ROLE_LEVELS[minRole]) {
      throw new ProjectForbiddenError('Insufficient permissions for this operation.');
    }

    return { project, effectiveRole };
  }

  private async notifyUser(data: {
    recipientId: string;
    actorId?: string | null;
    projectId?: string | null;
    type: any;
    title: string;
    message: string;
    entityType: string;
    entityId: string;
  }): Promise<void> {
    try {
      if (data.recipientId === data.actorId) return; // Do not notify self

      // Check duplicate
      const dup = await this.collabRepo.findDuplicateNotification(
        data.recipientId,
        data.type,
        data.entityType,
        data.entityId,
        data.actorId
      );
      if (dup) return;

      await this.collabRepo.createNotification({
        recipientId: data.recipientId,
        actorId: data.actorId || null,
        projectId: data.projectId || null,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
      });
    } catch (err) {
      console.warn('[CollaborationService] Notification error:', err);
    }
  }

  private async processMentions(
    content: string,
    projectId: string,
    actorId: string,
    entityType: string,
    entityId: string,
    contextSummary: string
  ): Promise<void> {
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const matches = content.match(mentionRegex);
    if (!matches) return;

    const usernames = [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
    const actor = await this.userRepo.findById(actorId);
    const actorName = actor ? actor.displayName || actor.username : 'Someone';

    for (const username of usernames) {
      const user = await this.userRepo.findByUsername(username);
      if (!user || user.id === actorId) continue;

      // Verify user has project access
      try {
        await this.checkProjectAccess(user.id, projectId, 'viewer');
        await this.notifyUser({
          recipientId: user.id,
          actorId,
          projectId,
          type: 'mention',
          title: 'You were mentioned',
          message: `${actorName} mentioned you in a comment: "${contextSummary.substring(0, 100)}"`,
          entityType,
          entityId,
        });
      } catch {
        // User is not a member of this project, ignore
      }
    }
  }

  // ==================== TEAM MANAGEMENT ====================
  async listMembers(userId: string, projectId: string): Promise<ProjectMemberResponse[]> {
    const { project } = await this.checkProjectAccess(userId, projectId, 'viewer');
    const members = await this.collabRepo.listMembers(projectId);

    // If owner is not explicitly in project_members table, include owner seamlessly
    const hasOwnerInList = members.some((m) => m.userId === project.ownerId);
    if (!hasOwnerInList) {
      const ownerUser = await this.userRepo.findById(project.ownerId);
      if (ownerUser) {
        members.unshift({
          id: `owner-${project.id}`,
          projectId: project.id,
          userId: ownerUser.id,
          role: 'owner',
          createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : String(project.createdAt),
          updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : String(project.updatedAt),
          user: {
            id: ownerUser.id,
            email: ownerUser.email,
            username: ownerUser.username,
            displayName: ownerUser.displayName,
            avatarUrl: ownerUser.avatarUrl,
          },
        });
      }
    }

    return members;
  }

  async inviteMember(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<ProjectInvitationResponse> {
    const { project, effectiveRole } = await this.checkProjectAccess(userId, projectId, 'admin');

    const parseResult = inviteMemberSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: InviteMemberInput = parseResult.data;

    // Role escalation check
    if (ROLE_LEVELS[input.role] > ROLE_LEVELS[effectiveRole]) {
      throw new RoleEscalationError('You cannot invite someone with a role higher than your own.');
    }

    // Lookup user by username or email
    const isEmail = input.usernameOrEmail.includes('@');
    const invitee = isEmail
      ? await this.userRepo.findByEmail(input.usernameOrEmail)
      : await this.userRepo.findByUsername(input.usernameOrEmail);

    if (!invitee) {
      throw new CollaborationNotFoundError(
        `User '${input.usernameOrEmail}' was not found. Please verify the username or email.`
      );
    }

    if (invitee.id === userId) {
      throw new CannotInviteSelfError();
    }

    if (invitee.id === project.ownerId) {
      throw new UserAlreadyMemberError(input.usernameOrEmail);
    }

    const existingMember = await this.collabRepo.findMember(projectId, invitee.id);
    if (existingMember) {
      throw new UserAlreadyMemberError(input.usernameOrEmail);
    }

    const pendingInvite = await this.collabRepo.findPendingInvitation(projectId, invitee.id);
    if (pendingInvite) {
      throw new PendingInvitationExistsError(input.usernameOrEmail);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const inv = await this.collabRepo.createInvitation({
      projectId,
      inviterId: userId,
      inviteeId: invitee.id,
      role: input.role,
      status: 'pending',
      token,
      expiresAt,
    });

    const inviter = await this.userRepo.findById(userId);
    const inviterSummary: CollaborationUserSummary = inviter
      ? {
          id: inviter.id,
          email: inviter.email,
          username: inviter.username,
          displayName: inviter.displayName,
          avatarUrl: inviter.avatarUrl,
        }
      : { id: userId, email: '', username: 'unknown', displayName: null, avatarUrl: null };

    const inviteeSummary: CollaborationUserSummary = {
      id: invitee.id,
      email: invitee.email,
      username: invitee.username,
      displayName: invitee.displayName,
      avatarUrl: invitee.avatarUrl,
    };

    // Emit notification to invitee
    await this.notifyUser({
      recipientId: invitee.id,
      actorId: userId,
      projectId,
      type: 'invitation',
      title: 'Project Invitation',
      message: `${inviterSummary.displayName || inviterSummary.username} invited you to join "${project.name}" as ${input.role}.`,
      entityType: 'invitation',
      entityId: inv.id,
    });

    // Record activity
    await this.intellSvc.recordActivity(
      projectId,
      userId,
      'member.invited',
      'member',
      invitee.id,
      `${inviterSummary.username} invited ${invitee.username} as ${input.role}`
    );

    return {
      id: inv.id,
      projectId: inv.projectId,
      inviterId: inv.inviterId,
      inviteeId: inv.inviteeId,
      role: inv.role as ProjectRole,
      status: inv.status as any,
      token: inv.token,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      inviter: inviterSummary,
      invitee: inviteeSummary,
      projectName: project.name,
    };
  }

  async listProjectInvitations(
    userId: string,
    projectId: string
  ): Promise<ProjectInvitationResponse[]> {
    await this.checkProjectAccess(userId, projectId, 'admin');
    return this.collabRepo.listProjectInvitations(projectId);
  }

  async listUserInvitations(userId: string): Promise<ProjectInvitationResponse[]> {
    return this.collabRepo.listUserInvitations(userId);
  }

  async respondToInvitation(
    userId: string,
    token: string,
    action: 'accept' | 'reject'
  ): Promise<ProjectInvitationResponse> {
    const invitation = await this.collabRepo.findInvitationByToken(token);
    if (!invitation) {
      throw new InvitationNotFoundError();
    }

    if (invitation.inviteeId !== userId) {
      throw new UnauthorizedInvitationActionError();
    }

    if (invitation.status !== 'pending') {
      throw new InvitationAlreadyHandledError(invitation.status);
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      await this.collabRepo.updateInvitationStatus(invitation.id, 'expired');
      throw new InvitationExpiredError();
    }

    const updated = await this.collabRepo.updateInvitationStatus(
      invitation.id,
      action === 'accept' ? 'accepted' : 'rejected'
    );

    if (action === 'accept') {
      await this.collabRepo.addMember(
        invitation.projectId,
        invitation.inviteeId,
        invitation.role as ProjectRole
      );
    }

    const invitee = await this.userRepo.findById(userId);
    const inviter = await this.userRepo.findById(invitation.inviterId);
    const project = await this.projRepo.findById(invitation.projectId);

    // Record activity
    await this.intellSvc.recordActivity(
      invitation.projectId,
      userId,
      action === 'accept' ? 'member.joined' : 'member.invitation_rejected',
      'member',
      userId,
      `${invitee?.username || 'User'} ${action === 'accept' ? 'joined the project' : 'declined the project invitation'}`
    );

    return {
      id: updated!.id,
      projectId: updated!.projectId,
      inviterId: updated!.inviterId,
      inviteeId: updated!.inviteeId,
      role: updated!.role as ProjectRole,
      status: updated!.status as any,
      token: updated!.token,
      expiresAt: updated!.expiresAt.toISOString(),
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
      inviter: {
        id: inviter?.id || invitation.inviterId,
        email: inviter?.email || '',
        username: inviter?.username || 'unknown',
        displayName: inviter?.displayName || null,
        avatarUrl: inviter?.avatarUrl || null,
      },
      invitee: {
        id: invitee?.id || userId,
        email: invitee?.email || '',
        username: invitee?.username || 'unknown',
        displayName: invitee?.displayName || null,
        avatarUrl: invitee?.avatarUrl || null,
      },
      projectName: project?.name,
    };
  }

  async cancelInvitation(userId: string, projectId: string, invitationId: string): Promise<void> {
    await this.checkProjectAccess(userId, projectId, 'admin');
    const invitation = await this.collabRepo.findInvitationById(invitationId);
    if (!invitation || invitation.projectId !== projectId) {
      throw new InvitationNotFoundError();
    }
    await this.collabRepo.updateInvitationStatus(invitationId, 'cancelled');
  }

  async updateMemberRole(
    userId: string,
    projectId: string,
    targetUserId: string,
    rawInput: unknown
  ): Promise<ProjectMemberResponse> {
    const { project, effectiveRole } = await this.checkProjectAccess(userId, projectId, 'admin');

    const parseResult = updateMemberRoleSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: UpdateMemberRoleInput = parseResult.data;

    if (userId === targetUserId) {
      throw new CollaborationForbiddenError('You cannot change your own role.');
    }

    if (ROLE_LEVELS[input.role] > ROLE_LEVELS[effectiveRole]) {
      throw new RoleEscalationError('You cannot assign a role higher than your own.');
    }

    const targetMember = await this.collabRepo.findMember(projectId, targetUserId);
    const isTargetRootOwner = project.ownerId === targetUserId;

    if (isTargetRootOwner) {
      throw new CollaborationForbiddenError('The primary project owner role cannot be modified.');
    }

    if (!targetMember) {
      throw new CollaborationNotFoundError('Member not found in this project.');
    }

    // Protection: only owners can demote/promote other owners or admins
    if (ROLE_LEVELS[targetMember.role as ProjectRole] >= ROLE_LEVELS[effectiveRole] && effectiveRole !== 'owner') {
      throw new CollaborationForbiddenError('You do not have permission to modify a member with equal or higher role.');
    }

    // Last owner check
    if (targetMember.role === 'owner' && input.role !== 'owner') {
      const ownerCount = await this.collabRepo.countOwners(projectId);
      if (ownerCount <= 1 && project.ownerId === targetUserId) {
        throw new LastOwnerCannotBeRemovedError();
      }
    }

    const updated = await this.collabRepo.updateMemberRole(projectId, targetUserId, input.role);
    const targetUser = await this.userRepo.findById(targetUserId);

    // Activity & notification
    await this.intellSvc.recordActivity(
      projectId,
      userId,
      'member.role_updated',
      'member',
      targetUserId,
      `Role for ${targetUser?.username} updated to ${input.role}`
    );

    await this.notifyUser({
      recipientId: targetUserId,
      actorId: userId,
      projectId,
      type: 'task_updated',
      title: 'Role Updated',
      message: `Your role in "${project.name}" was updated to ${input.role}.`,
      entityType: 'project',
      entityId: projectId,
    });

    return {
      id: updated!.id,
      projectId: updated!.projectId,
      userId: updated!.userId,
      role: updated!.role as ProjectRole,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
      user: {
        id: targetUser?.id || targetUserId,
        email: targetUser?.email || '',
        username: targetUser?.username || 'unknown',
        displayName: targetUser?.displayName || null,
        avatarUrl: targetUser?.avatarUrl || null,
      },
    };
  }

  async removeMember(userId: string, projectId: string, targetUserId: string): Promise<void> {
    const { project, effectiveRole } = await this.checkProjectAccess(userId, projectId, 'admin');

    if (project.ownerId === targetUserId) {
      throw new LastOwnerCannotBeRemovedError('The primary project owner cannot be removed.');
    }

    const targetMember = await this.collabRepo.findMember(projectId, targetUserId);
    if (!targetMember) {
      throw new CollaborationNotFoundError('Member not found in this project.');
    }

    if (targetMember.role === 'owner') {
      const ownerCount = await this.collabRepo.countOwners(projectId);
      if (ownerCount <= 1) {
        throw new LastOwnerCannotBeRemovedError();
      }
    }

    if (ROLE_LEVELS[targetMember.role as ProjectRole] >= ROLE_LEVELS[effectiveRole] && effectiveRole !== 'owner') {
      throw new CollaborationForbiddenError('You do not have permission to remove a member with equal or higher role.');
    }

    await this.collabRepo.removeMember(projectId, targetUserId);
    const targetUser = await this.userRepo.findById(targetUserId);

    await this.intellSvc.recordActivity(
      projectId,
      userId,
      'member.removed',
      'member',
      targetUserId,
      `Removed ${targetUser?.username || 'member'} from project`
    );
  }

  // ==================== ARTIFACT COMMENTS ====================
  async createComment(
    userId: string,
    projectId: string,
    artifactId: string,
    rawInput: unknown
  ): Promise<ArtifactCommentResponse> {
    const { project } = await this.checkProjectAccess(userId, projectId, 'reviewer');

    const artifact = await this.artRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    const parseResult = createCommentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: CreateCommentInput = parseResult.data;

    let parentComment: any = null;
    if (input.parentId) {
      parentComment = await this.collabRepo.findCommentById(input.parentId);
      if (!parentComment || parentComment.artifactId !== artifactId) {
        throw new CollaborationValidationError([
          { field: 'parentId', issue: 'Parent comment not found on this artifact.' },
        ]);
      }
    }

    const sanitized = sanitizeContent(input.content);
    const comment = await this.collabRepo.createComment({
      projectId,
      artifactId,
      authorId: userId,
      parentId: input.parentId || null,
      content: sanitized,
      revisionCommitHash: input.revisionCommitHash || null,
    });

    const author = await this.userRepo.findById(userId);
    const authorSummary: CollaborationUserSummary = {
      id: userId,
      email: author?.email || '',
      username: author?.username || 'unknown',
      displayName: author?.displayName || null,
      avatarUrl: author?.avatarUrl || null,
    };

    // If reply, notify parent author
    if (parentComment && parentComment.authorId !== userId) {
      await this.notifyUser({
        recipientId: parentComment.authorId,
        actorId: userId,
        projectId,
        type: 'comment_reply',
        title: 'New Reply',
        message: `${authorSummary.displayName || authorSummary.username} replied to your comment on "${artifact.name}".`,
        entityType: 'comment',
        entityId: comment.id,
      });
    }

    // Process @mentions
    await this.processMentions(
      sanitized,
      projectId,
      userId,
      'comment',
      comment.id,
      `on artifact ${artifact.name}: ${sanitized}`
    );

    // Record activity
    await this.intellSvc.recordActivity(
      projectId,
      userId,
      'comment.created',
      'comment',
      comment.id,
      `${authorSummary.username} commented on ${artifact.name}`
    );

    return {
      id: comment.id,
      projectId: comment.projectId,
      artifactId: comment.artifactId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      content: comment.content,
      isResolved: comment.isResolved,
      resolvedById: comment.resolvedById,
      resolvedAt: comment.resolvedAt ? comment.resolvedAt.toISOString() : null,
      revisionCommitHash: comment.revisionCommitHash,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: authorSummary,
      replyCount: 0,
      replies: [],
    };
  }

  async listArtifactComments(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<ArtifactCommentResponse[]> {
    await this.checkProjectAccess(userId, projectId, 'viewer');
    const artifact = await this.artRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }
    return this.collabRepo.listArtifactComments(artifactId);
  }

  async updateComment(
    userId: string,
    projectId: string,
    commentId: string,
    rawInput: unknown
  ): Promise<ArtifactCommentResponse> {
    const { effectiveRole } = await this.checkProjectAccess(userId, projectId, 'reviewer');

    const comment = await this.collabRepo.findCommentById(commentId);
    if (!comment || comment.projectId !== projectId) {
      throw new CollaborationNotFoundError('Comment not found.');
    }

    if (comment.authorId !== userId && ROLE_LEVELS[effectiveRole] < ROLE_LEVELS['admin']) {
      throw new CollaborationForbiddenError('You can only edit your own comments.');
    }

    const parseResult = updateCommentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }

    const sanitized = sanitizeContent(parseResult.data.content);
    const updated = await this.collabRepo.updateComment(commentId, sanitized);
    const author = await this.userRepo.findById(comment.authorId);

    return {
      id: updated!.id,
      projectId: updated!.projectId,
      artifactId: updated!.artifactId,
      authorId: updated!.authorId,
      parentId: updated!.parentId,
      content: updated!.content,
      isResolved: updated!.isResolved,
      resolvedById: updated!.resolvedById,
      resolvedAt: updated!.resolvedAt ? updated!.resolvedAt.toISOString() : null,
      revisionCommitHash: updated!.revisionCommitHash,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
      author: {
        id: author?.id || comment.authorId,
        email: author?.email || '',
        username: author?.username || 'unknown',
        displayName: author?.displayName || null,
        avatarUrl: author?.avatarUrl || null,
      },
    };
  }

  async deleteComment(userId: string, projectId: string, commentId: string): Promise<void> {
    const { effectiveRole } = await this.checkProjectAccess(userId, projectId, 'reviewer');

    const comment = await this.collabRepo.findCommentById(commentId);
    if (!comment || comment.projectId !== projectId) {
      throw new CollaborationNotFoundError('Comment not found.');
    }

    if (comment.authorId !== userId && ROLE_LEVELS[effectiveRole] < ROLE_LEVELS['admin']) {
      throw new CollaborationForbiddenError('You can only delete your own comments.');
    }

    await this.collabRepo.deleteComment(commentId);
    await this.intellSvc.recordActivity(
      projectId,
      userId,
      'comment.deleted',
      'comment',
      commentId,
      'Deleted a comment'
    );
  }

  async resolveComment(
    userId: string,
    projectId: string,
    commentId: string,
    rawInput: unknown
  ): Promise<ArtifactCommentResponse> {
    await this.checkProjectAccess(userId, projectId, 'reviewer');

    const comment = await this.collabRepo.findCommentById(commentId);
    if (!comment || comment.projectId !== projectId) {
      throw new CollaborationNotFoundError('Comment not found.');
    }

    const parseResult = resolveCommentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }

    const updated = await this.collabRepo.setCommentResolved(
      commentId,
      parseResult.data.isResolved,
      userId
    );

    const author = await this.userRepo.findById(comment.authorId);
    const resolver = await this.userRepo.findById(userId);

    await this.intellSvc.recordActivity(
      projectId,
      userId,
      parseResult.data.isResolved ? 'comment.resolved' : 'comment.reopened',
      'comment',
      commentId,
      `${resolver?.username} ${parseResult.data.isResolved ? 'resolved' : 'reopened'} a discussion thread`
    );

    return {
      id: updated!.id,
      projectId: updated!.projectId,
      artifactId: updated!.artifactId,
      authorId: updated!.authorId,
      parentId: updated!.parentId,
      content: updated!.content,
      isResolved: updated!.isResolved,
      resolvedById: updated!.resolvedById,
      resolvedAt: updated!.resolvedAt ? updated!.resolvedAt.toISOString() : null,
      revisionCommitHash: updated!.revisionCommitHash,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
      author: {
        id: author?.id || comment.authorId,
        email: author?.email || '',
        username: author?.username || 'unknown',
        displayName: author?.displayName || null,
        avatarUrl: author?.avatarUrl || null,
      },
      resolvedBy: resolver
        ? {
            id: resolver.id,
            email: resolver.email,
            username: resolver.username,
            displayName: resolver.displayName,
            avatarUrl: resolver.avatarUrl,
          }
        : null,
    };
  }

  // ==================== TASKS & ISSUES ====================
  async createTask(userId: string, projectId: string, rawInput: unknown): Promise<ProjectTaskResponse> {
    const { project } = await this.checkProjectAccess(userId, projectId, 'member');

    const parseResult = createTaskSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: CreateTaskInput = parseResult.data;

    // Boundary check for linked artifact
    if (input.linkedArtifactId) {
      const art = await this.artRepo.findById(input.linkedArtifactId);
      if (!art || art.projectId !== projectId) {
        throw new CollaborationValidationError([
          { field: 'linkedArtifactId', issue: 'Linked artifact does not belong to this project.' },
        ]);
      }
    }

    // Boundary check for linked review
    if (input.linkedReviewId) {
      const rev = await this.collabRepo.findReviewById(input.linkedReviewId);
      if (!rev || rev.projectId !== projectId) {
        throw new CollaborationValidationError([
          { field: 'linkedReviewId', issue: 'Linked review does not belong to this project.' },
        ]);
      }
    }

    // Boundary check for assignee
    if (input.assigneeId) {
      await this.checkProjectAccess(input.assigneeId, projectId, 'viewer');
    }

    const task = await this.collabRepo.createTask({
      projectId,
      creatorId: userId,
      assigneeId: input.assigneeId || null,
      title: input.title,
      description: input.description || null,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      labels: JSON.stringify(input.labels || []),
      linkedArtifactId: input.linkedArtifactId || null,
      linkedCommitHash: input.linkedCommitHash || null,
      linkedReviewId: input.linkedReviewId || null,
    });

    const creator = await this.userRepo.findById(userId);

    // Notify assignee
    if (input.assigneeId && input.assigneeId !== userId) {
      await this.notifyUser({
        recipientId: input.assigneeId,
        actorId: userId,
        projectId,
        type: 'task_assigned',
        title: 'Task Assigned',
        message: `${creator?.displayName || creator?.username} assigned you to task "${task.title}".`,
        entityType: 'task',
        entityId: task.id,
      });
    }

    await this.intellSvc.recordActivity(
      projectId,
      userId,
      'task.created',
      'task',
      task.id,
      `${creator?.username} created task '${task.title}'`
    );

    return (await this.collabRepo.findTaskById(task.id))!;
  }

  async getTask(userId: string, projectId: string, taskId: string): Promise<ProjectTaskResponse> {
    await this.checkProjectAccess(userId, projectId, 'viewer');
    const task = await this.collabRepo.findTaskById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new CollaborationNotFoundError('Task not found.');
    }
    return task;
  }

  async listTasks(
    userId: string,
    projectId: string,
    rawQuery?: unknown
  ): Promise<ProjectTaskResponse[]> {
    await this.checkProjectAccess(userId, projectId, 'viewer');
    const parseResult = queryTasksSchema.safeParse(rawQuery || {});
    const filters = parseResult.success ? parseResult.data : undefined;
    return this.collabRepo.listTasks(projectId, filters);
  }

  async updateTask(
    userId: string,
    projectId: string,
    taskId: string,
    rawInput: unknown
  ): Promise<ProjectTaskResponse> {
    await this.checkProjectAccess(userId, projectId, 'member');

    const existingTask = await this.collabRepo.findTaskById(taskId);
    if (!existingTask || existingTask.projectId !== projectId) {
      throw new CollaborationNotFoundError('Task not found.');
    }

    const parseResult = updateTaskSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: UpdateTaskInput = parseResult.data;

    // Check linked entities
    if (input.linkedArtifactId) {
      const art = await this.artRepo.findById(input.linkedArtifactId);
      if (!art || art.projectId !== projectId) {
        throw new CollaborationValidationError([
          { field: 'linkedArtifactId', issue: 'Linked artifact does not belong to this project.' },
        ]);
      }
    }

    if (input.assigneeId) {
      await this.checkProjectAccess(input.assigneeId, projectId, 'viewer');
    }

    const updatePayload: any = {};
    if (input.title !== undefined) updatePayload.title = input.title;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.assigneeId !== undefined) updatePayload.assigneeId = input.assigneeId;
    if (input.dueDate !== undefined)
      updatePayload.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.labels !== undefined) updatePayload.labels = JSON.stringify(input.labels);
    if (input.linkedArtifactId !== undefined) updatePayload.linkedArtifactId = input.linkedArtifactId;
    if (input.linkedCommitHash !== undefined) updatePayload.linkedCommitHash = input.linkedCommitHash;
    if (input.linkedReviewId !== undefined) updatePayload.linkedReviewId = input.linkedReviewId;

    await this.collabRepo.updateTask(taskId, updatePayload);

    const user = await this.userRepo.findById(userId);

    // Notify if reassigned
    if (
      input.assigneeId &&
      input.assigneeId !== existingTask.assigneeId &&
      input.assigneeId !== userId
    ) {
      await this.notifyUser({
        recipientId: input.assigneeId,
        actorId: userId,
        projectId,
        type: 'task_assigned',
        title: 'Task Assigned',
        message: `${user?.displayName || user?.username} assigned you to task "${input.title || existingTask.title}".`,
        entityType: 'task',
        entityId: taskId,
      });
    }

    // Activity
    const eventType = input.status === 'done' ? 'task.completed' : 'task.updated';
    await this.intellSvc.recordActivity(
      projectId,
      userId,
      eventType,
      'task',
      taskId,
      `${user?.username} updated task '${input.title || existingTask.title}'`
    );

    return (await this.collabRepo.findTaskById(taskId))!;
  }

  async deleteTask(userId: string, projectId: string, taskId: string): Promise<void> {
    await this.checkProjectAccess(userId, projectId, 'member');
    const existing = await this.collabRepo.findTaskById(taskId);
    if (!existing || existing.projectId !== projectId) {
      throw new CollaborationNotFoundError('Task not found.');
    }

    await this.collabRepo.deleteTask(taskId);
    await this.intellSvc.recordActivity(
      projectId,
      userId,
      'task.deleted',
      'task',
      taskId,
      `Deleted task '${existing.title}'`
    );
  }

  async createTaskComment(
    userId: string,
    projectId: string,
    taskId: string,
    rawInput: unknown
  ): Promise<TaskCommentResponse> {
    await this.checkProjectAccess(userId, projectId, 'reviewer');

    const task = await this.collabRepo.findTaskById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new CollaborationNotFoundError('Task not found.');
    }

    const parseResult = createTaskCommentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }

    const sanitized = sanitizeContent(parseResult.data.content);
    const comment = await this.collabRepo.createTaskComment({
      taskId,
      authorId: userId,
      content: sanitized,
    });

    const author = await this.userRepo.findById(userId);
    const authorSummary: CollaborationUserSummary = {
      id: userId,
      email: author?.email || '',
      username: author?.username || 'unknown',
      displayName: author?.displayName || null,
      avatarUrl: author?.avatarUrl || null,
    };

    // Notify task creator and assignee if different
    const recipients = new Set<string>();
    if (task.creatorId !== userId) recipients.add(task.creatorId);
    if (task.assigneeId && task.assigneeId !== userId) recipients.add(task.assigneeId);

    for (const recipientId of recipients) {
      await this.notifyUser({
        recipientId,
        actorId: userId,
        projectId,
        type: 'comment_reply',
        title: 'New Task Comment',
        message: `${authorSummary.displayName || authorSummary.username} commented on task "${task.title}".`,
        entityType: 'task',
        entityId: task.id,
      });
    }

    // Process mentions
    await this.processMentions(
      sanitized,
      projectId,
      userId,
      'task',
      task.id,
      `on task ${task.title}: ${sanitized}`
    );

    return {
      id: comment.id,
      taskId: comment.taskId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: authorSummary,
    };
  }

  async listTaskComments(
    userId: string,
    projectId: string,
    taskId: string
  ): Promise<TaskCommentResponse[]> {
    await this.checkProjectAccess(userId, projectId, 'viewer');
    const task = await this.collabRepo.findTaskById(taskId);
    if (!task || task.projectId !== projectId) {
      throw new CollaborationNotFoundError('Task not found.');
    }
    return this.collabRepo.listTaskComments(taskId);
  }

  // ==================== REVIEWS & APPROVALS ====================
  async createReview(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<ProjectReviewResponse> {
    const { project } = await this.checkProjectAccess(userId, projectId, 'member');

    const parseResult = createReviewSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: CreateReviewInput = parseResult.data;

    // Validate target
    if (input.targetType === 'artifact') {
      const art = await this.artRepo.findById(input.targetRef);
      if (!art || art.projectId !== projectId) {
        throw new InvalidReviewTargetError(`Artifact with ID '${input.targetRef}' not found in this project.`);
      }
    }

    const review = await this.collabRepo.createReview({
      projectId,
      creatorId: userId,
      title: input.title,
      description: input.description || null,
      targetType: input.targetType,
      targetRef: input.targetRef,
      status: 'open',
    });

    // Assign reviewers
    const creator = await this.userRepo.findById(userId);
    const creatorName = creator?.displayName || creator?.username || 'Author';

    if (input.reviewerIds && input.reviewerIds.length > 0) {
      for (const revId of input.reviewerIds) {
        try {
          await this.checkProjectAccess(revId, projectId, 'reviewer');
          await this.collabRepo.addReviewer(review.id, revId);

          await this.notifyUser({
            recipientId: revId,
            actorId: userId,
            projectId,
            type: 'review_requested',
            title: 'Review Requested',
            message: `${creatorName} requested your review on "${review.title}".`,
            entityType: 'review',
            entityId: review.id,
          });
        } catch {
          // Skip invalid reviewer ID
        }
      }
    }

    await this.intellSvc.recordActivity(
      projectId,
      userId,
      'review.created',
      'review',
      review.id,
      `${creator?.username} requested review on ${review.targetRef}`
    );

    return (await this.collabRepo.findReviewById(review.id))!;
  }

  async getReview(
    userId: string,
    projectId: string,
    reviewId: string
  ): Promise<ProjectReviewResponse> {
    await this.checkProjectAccess(userId, projectId, 'viewer');
    const review = await this.collabRepo.findReviewById(reviewId);
    if (!review || review.projectId !== projectId) {
      throw new CollaborationNotFoundError('Review not found.');
    }

    // Stale check for branch reviews: compare commitHashAtDecision with current branch HEAD
    if (review.targetType === 'branch' && this.gitSvc.isRepoInitialized(projectId)) {
      try {
        const status = await this.gitSvc.getStatus(userId, projectId);
        const currentHead = status.headCommitHash;
        review.currentCommitHash = currentHead || null;

        for (const reviewer of review.reviewers) {
          if (reviewer.decision && reviewer.decision.commitHashAtDecision) {
            reviewer.decision.isStale =
              Boolean(currentHead) && reviewer.decision.commitHashAtDecision !== currentHead;
          }
        }
      } catch {
        // Fallback gracefully if git repo status check fails
      }
    }

    return review;
  }

  async listReviews(userId: string, projectId: string): Promise<ProjectReviewResponse[]> {
    await this.checkProjectAccess(userId, projectId, 'viewer');
    return this.collabRepo.listReviews(projectId);
  }

  async updateReview(
    userId: string,
    projectId: string,
    reviewId: string,
    rawInput: unknown
  ): Promise<ProjectReviewResponse> {
    const { effectiveRole } = await this.checkProjectAccess(userId, projectId, 'reviewer');

    const review = await this.collabRepo.findReviewById(reviewId);
    if (!review || review.projectId !== projectId) {
      throw new CollaborationNotFoundError('Review not found.');
    }

    if (review.creatorId !== userId && ROLE_LEVELS[effectiveRole] < ROLE_LEVELS['admin']) {
      throw new CollaborationForbiddenError('Only the author or an admin can update or close this review.');
    }

    const parseResult = updateReviewSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: UpdateReviewInput = parseResult.data;

    const updatePayload: any = {};
    if (input.title !== undefined) updatePayload.title = input.title;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.status !== undefined) {
      updatePayload.status = input.status;
      if (input.status === 'closed') {
        updatePayload.closedById = userId;
        updatePayload.closedAt = new Date();
      } else {
        updatePayload.closedById = null;
        updatePayload.closedAt = null;
      }
    }

    await this.collabRepo.updateReview(reviewId, updatePayload);
    const user = await this.userRepo.findById(userId);

    const eventType =
      input.status === 'closed'
        ? 'review.closed'
        : input.status === 'open'
          ? 'review.reopened'
          : 'review.updated';

    await this.intellSvc.recordActivity(
      projectId,
      userId,
      eventType,
      'review',
      reviewId,
      `${user?.username} ${input.status === 'closed' ? 'closed' : 'updated'} review '${review.title}'`
    );

    return (await this.collabRepo.findReviewById(reviewId))!;
  }

  async submitReviewDecision(
    userId: string,
    projectId: string,
    reviewId: string,
    rawInput: unknown
  ): Promise<ProjectReviewResponse> {
    await this.checkProjectAccess(userId, projectId, 'reviewer');

    const review = await this.collabRepo.findReviewById(reviewId);
    if (!review || review.projectId !== projectId) {
      throw new CollaborationNotFoundError('Review not found.');
    }

    if (review.status === 'closed') {
      throw new ReviewClosedError();
    }

    const parseResult = submitReviewDecisionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: SubmitReviewDecisionInput = parseResult.data;

    // Get current head commit hash if applicable
    let currentCommit = input.commitHashAtDecision || null;
    if (!currentCommit && this.gitSvc.isRepoInitialized(projectId)) {
      try {
        const st = await this.gitSvc.getStatus(userId, projectId);
        currentCommit = st.headCommitHash || null;
      } catch {
        // Fallback
      }
    }

    // Ensure user is recorded as a reviewer
    await this.collabRepo.addReviewer(reviewId, userId);

    await this.collabRepo.upsertDecision({
      reviewId,
      reviewerId: userId,
      decision: input.decision,
      feedback: input.feedback || null,
      commitHashAtDecision: currentCommit,
    });

    // Check new overall review status
    let newStatus = review.status;
    if (input.decision === 'changes_requested') {
      newStatus = 'changes_requested';
    } else if (input.decision === 'approved') {
      newStatus = 'approved';
    }

    if (newStatus !== review.status) {
      await this.collabRepo.updateReview(reviewId, { status: newStatus });
    }

    const reviewer = await this.userRepo.findById(userId);
    const reviewerName = reviewer?.displayName || reviewer?.username || 'Reviewer';

    // Notify review creator
    if (review.creatorId !== userId) {
      await this.notifyUser({
        recipientId: review.creatorId,
        actorId: userId,
        projectId,
        type: 'review_decision',
        title: `Review ${input.decision === 'approved' ? 'Approved' : 'Changes Requested'}`,
        message: `${reviewerName} ${input.decision === 'approved' ? 'approved' : 'requested changes on'} "${review.title}".`,
        entityType: 'review',
        entityId: review.id,
      });
    }

    await this.intellSvc.recordActivity(
      projectId,
      userId,
      input.decision === 'approved' ? 'review.approved' : 'review.changes_requested',
      'review',
      review.id,
      `${reviewer?.username} submitted ${input.decision} on review '${review.title}'`
    );

    return (await this.collabRepo.findReviewById(reviewId))!;
  }

  async assignReviewers(
    userId: string,
    projectId: string,
    reviewId: string,
    rawInput: unknown
  ): Promise<ProjectReviewResponse> {
    await this.checkProjectAccess(userId, projectId, 'member');

    const review = await this.collabRepo.findReviewById(reviewId);
    if (!review || review.projectId !== projectId) {
      throw new CollaborationNotFoundError('Review not found.');
    }

    const parseResult = assignReviewersSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: AssignReviewersInput = parseResult.data;

    const actor = await this.userRepo.findById(userId);
    const actorName = actor?.displayName || actor?.username || 'Author';

    for (const revId of input.reviewerIds) {
      try {
        await this.checkProjectAccess(revId, projectId, 'reviewer');
        await this.collabRepo.addReviewer(reviewId, revId);

        await this.notifyUser({
          recipientId: revId,
          actorId: userId,
          projectId,
          type: 'review_requested',
          title: 'Review Requested',
          message: `${actorName} requested your review on "${review.title}".`,
          entityType: 'review',
          entityId: review.id,
        });
      } catch {
        // Skip invalid reviewer ID
      }
    }

    return (await this.collabRepo.findReviewById(reviewId))!;
  }

  async createReviewComment(
    userId: string,
    projectId: string,
    reviewId: string,
    rawInput: unknown
  ): Promise<ReviewCommentResponse> {
    await this.checkProjectAccess(userId, projectId, 'reviewer');

    const review = await this.collabRepo.findReviewById(reviewId);
    if (!review || review.projectId !== projectId) {
      throw new CollaborationNotFoundError('Review not found.');
    }

    const parseResult = createReviewCommentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new CollaborationValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }

    const sanitized = sanitizeContent(parseResult.data.content);
    const comment = await this.collabRepo.createReviewComment({
      reviewId,
      authorId: userId,
      content: sanitized,
    });

    const author = await this.userRepo.findById(userId);
    const authorSummary: CollaborationUserSummary = {
      id: userId,
      email: author?.email || '',
      username: author?.username || 'unknown',
      displayName: author?.displayName || null,
      avatarUrl: author?.avatarUrl || null,
    };

    if (review.creatorId !== userId) {
      await this.notifyUser({
        recipientId: review.creatorId,
        actorId: userId,
        projectId,
        type: 'comment_reply',
        title: 'New Review Comment',
        message: `${authorSummary.displayName || authorSummary.username} commented on review "${review.title}".`,
        entityType: 'review',
        entityId: review.id,
      });
    }

    await this.processMentions(
      sanitized,
      projectId,
      userId,
      'review',
      review.id,
      `on review ${review.title}: ${sanitized}`
    );

    return {
      id: comment.id,
      reviewId: comment.reviewId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: authorSummary,
    };
  }

  async listReviewComments(
    userId: string,
    projectId: string,
    reviewId: string
  ): Promise<ReviewCommentResponse[]> {
    await this.checkProjectAccess(userId, projectId, 'viewer');
    const review = await this.collabRepo.findReviewById(reviewId);
    if (!review || review.projectId !== projectId) {
      throw new CollaborationNotFoundError('Review not found.');
    }
    return this.collabRepo.listReviewComments(reviewId);
  }

  // ==================== NOTIFICATIONS ====================
  async listNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationResponse[]> {
    return this.collabRepo.listNotifications(userId, limit, offset);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return this.collabRepo.getUnreadNotificationCount(userId);
  }

  async markNotificationAsRead(userId: string, notificationId: string): Promise<boolean> {
    return this.collabRepo.markNotificationAsRead(notificationId, userId);
  }

  async markAllNotificationsAsRead(userId: string): Promise<number> {
    return this.collabRepo.markAllNotificationsAsRead(userId);
  }
}

export const collaborationService = new CollaborationService();
