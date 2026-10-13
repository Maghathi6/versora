import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { CollaborationService } from './collaboration.service';
import { ICollaborationRepository } from './collaboration.repository';
import { IProjectRepository } from '../projects/project.repository';
import { IUserRepository } from '../users/user.repository';
import { IArtifactRepository } from '../artifacts/artifact.repository';
import { IGitService } from '../git/git.service';
import { IIntelligenceService } from '../intelligence/intelligence.service';
import {
  ProjectRole,
  ProjectMemberResponse,
  ProjectInvitationResponse,
  ArtifactCommentResponse,
  ProjectTaskResponse,
  ProjectReviewResponse,
  NotificationResponse,
} from './collaboration.types';
import {
  CollaborationValidationError,
  CollaborationForbiddenError,
  CollaborationNotFoundError,
  LastOwnerCannotBeRemovedError,
  RoleEscalationError,
  CannotInviteSelfError,
  UserAlreadyMemberError,
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyHandledError,
  UnauthorizedInvitationActionError,
  ReviewClosedError,
} from './collaboration.errors';
import { ProjectNotFoundError, ProjectForbiddenError } from '../projects/project.errors';
import { ArtifactNotFoundError } from '../artifacts/artifact.errors';

describe('Collaboration Service (Unit Tests)', () => {
  const ownerId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const reviewerId = crypto.randomUUID();
  const viewerId = crypto.randomUUID();
  const outsiderId = crypto.randomUUID();

  const projectId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  const artifactId = crypto.randomUUID();

  let members: any[];
  let invitations: any[];
  let comments: any[];
  let tasks: any[];
  let taskComments: any[];
  let reviews: any[];
  let reviewers: any[];
  let decisions: any[];
  let reviewComments: any[];
  let notificationsList: any[];
  let activitiesList: any[];

  let collabRepo: ICollaborationRepository;
  let projRepo: IProjectRepository;
  let userRepo: IUserRepository;
  let artRepo: IArtifactRepository;
  let gitSvc: IGitService;
  let intellSvc: IIntelligenceService;
  let service: CollaborationService;

  beforeEach(() => {
    members = [
      { id: 'm1', projectId, userId: adminId, role: 'admin', createdAt: new Date(), updatedAt: new Date() },
      { id: 'm2', projectId, userId: memberId, role: 'member', createdAt: new Date(), updatedAt: new Date() },
      { id: 'm3', projectId, userId: reviewerId, role: 'reviewer', createdAt: new Date(), updatedAt: new Date() },
      { id: 'm4', projectId, userId: viewerId, role: 'viewer', createdAt: new Date(), updatedAt: new Date() },
    ];
    invitations = [];
    comments = [];
    tasks = [];
    taskComments = [];
    reviews = [];
    reviewers = [];
    decisions = [];
    reviewComments = [];
    notificationsList = [];
    activitiesList = [];

    const usersMap: Record<string, any> = {
      [ownerId]: { id: ownerId, email: 'owner@example.com', username: 'owner_user', displayName: 'Owner' },
      [adminId]: { id: adminId, email: 'admin@example.com', username: 'admin_user', displayName: 'Admin' },
      [memberId]: { id: memberId, email: 'member@example.com', username: 'member_user', displayName: 'Member' },
      [reviewerId]: { id: reviewerId, email: 'reviewer@example.com', username: 'reviewer_user', displayName: 'Reviewer' },
      [viewerId]: { id: viewerId, email: 'viewer@example.com', username: 'viewer_user', displayName: 'Viewer' },
      [outsiderId]: { id: outsiderId, email: 'outsider@example.com', username: 'outsider_user', displayName: 'Outsider' },
    };

    userRepo = {
      findById: async (id: string) => usersMap[id] || null,
      findByEmail: async (email: string) => Object.values(usersMap).find((u) => u.email === email) || null,
      findByUsername: async (username: string) => Object.values(usersMap).find((u) => u.username === username) || null,
      create: async () => ({} as any),
      update: async () => ({} as any),
    };

    projRepo = {
      findById: async (id: string) => {
        if (id === projectId) {
          return { id: projectId, name: 'Main Project', description: null, ownerId, createdAt: new Date(), updatedAt: new Date() };
        }
        if (id === otherProjectId) {
          return { id: otherProjectId, name: 'Other Project', description: null, ownerId: outsiderId, createdAt: new Date(), updatedAt: new Date() };
        }
        return null;
      },
      create: async () => ({} as any),
      findByOwnerId: async () => [],
      findByOwnerAndName: async () => null,
      update: async () => null,
      delete: async () => true,
    };

    artRepo = {
      findById: async (id: string) => {
        if (id === artifactId) {
          return { id: artifactId, projectId, name: 'test.ts', path: '/test.ts', type: 'file', artifactType: 'code' } as any;
        }
        return null;
      },
    } as any;

    gitSvc = {
      isRepoInitialized: () => true,
      getStatus: async () => ({
        isClean: true,
        currentBranch: 'main',
        headCommitHash: 'commit-hash-abc',
        staged: [],
        unstaged: [],
        untracked: [],
      }),
    } as any;

    intellSvc = {
      recordActivity: async (pId: string, aId: string, eventType: string, entityType: any, entityId: any, summary: string) => {
        activitiesList.push({ pId, aId, eventType, entityType, entityId, summary });
      },
    } as any;

    collabRepo = {
      findMember: async (pId: string, uId: string) => members.find((m) => m.projectId === pId && m.userId === uId) || null,
      listMembers: async (pId: string) =>
        members.filter((m) => m.projectId === pId).map((m) => ({
          id: m.id,
          projectId: m.projectId,
          userId: m.userId,
          role: m.role,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
          user: usersMap[m.userId],
        })),
      addMember: async (pId: string, uId: string, role: ProjectRole) => {
        const item = { id: crypto.randomUUID(), projectId: pId, userId: uId, role, createdAt: new Date(), updatedAt: new Date() };
        members.push(item);
        return item;
      },
      updateMemberRole: async (pId: string, uId: string, role: ProjectRole) => {
        const m = members.find((x) => x.projectId === pId && x.userId === uId);
        if (m) {
          m.role = role;
          m.updatedAt = new Date();
          return m;
        }
        return null;
      },
      removeMember: async (pId: string, uId: string) => {
        const idx = members.findIndex((x) => x.projectId === pId && x.userId === uId);
        if (idx !== -1) {
          members.splice(idx, 1);
          return true;
        }
        return false;
      },
      countOwners: async (pId: string) => members.filter((m) => m.projectId === pId && m.role === 'owner').length,
      listUserProjectIds: async (uId: string) => members.filter((m) => m.userId === uId).map((m) => m.projectId),

      createInvitation: async (data: any) => {
        const item = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        invitations.push(item);
        return item;
      },
      findInvitationById: async (id: string) => invitations.find((i) => i.id === id) || null,
      findInvitationByToken: async (token: string) => invitations.find((i) => i.token === token) || null,
      findPendingInvitation: async (pId: string, iId: string) =>
        invitations.find((i) => i.projectId === pId && i.inviteeId === iId && i.status === 'pending') || null,
      listProjectInvitations: async (pId: string) =>
        invitations.filter((i) => i.projectId === pId).map((i) => ({
          id: i.id,
          projectId: i.projectId,
          inviterId: i.inviterId,
          inviteeId: i.inviteeId,
          role: i.role,
          status: i.status,
          token: i.token,
          expiresAt: i.expiresAt.toISOString(),
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
          inviter: usersMap[i.inviterId],
          invitee: usersMap[i.inviteeId],
        })),
      listUserInvitations: async (uId: string) =>
        invitations.filter((i) => i.inviteeId === uId && i.status === 'pending').map((i) => ({
          id: i.id,
          projectId: i.projectId,
          inviterId: i.inviterId,
          inviteeId: i.inviteeId,
          role: i.role,
          status: i.status,
          token: i.token,
          expiresAt: i.expiresAt.toISOString(),
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
          inviter: usersMap[i.inviterId],
          invitee: usersMap[i.inviteeId],
        })),
      updateInvitationStatus: async (id: string, status: any) => {
        const inv = invitations.find((i) => i.id === id);
        if (inv) {
          inv.status = status;
          inv.updatedAt = new Date();
          return inv;
        }
        return null;
      },

      createComment: async (data: any) => {
        const item = { id: crypto.randomUUID(), ...data, isResolved: false, resolvedById: null, resolvedAt: null, createdAt: new Date(), updatedAt: new Date() };
        comments.push(item);
        return item;
      },
      findCommentById: async (id: string) => comments.find((c) => c.id === id) || null,
      listArtifactComments: async (aId: string) =>
        comments.filter((c) => c.artifactId === aId && !c.parentId).map((c) => ({
          id: c.id,
          projectId: c.projectId,
          artifactId: c.artifactId,
          authorId: c.authorId,
          parentId: c.parentId,
          content: c.content,
          isResolved: c.isResolved,
          resolvedById: c.resolvedById,
          resolvedAt: null,
          revisionCommitHash: c.revisionCommitHash,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          author: usersMap[c.authorId],
          replyCount: comments.filter((r) => r.parentId === c.id).length,
          replies: comments.filter((r) => r.parentId === c.id).map((r) => ({
            id: r.id,
            projectId: r.projectId,
            artifactId: r.artifactId,
            authorId: r.authorId,
            parentId: r.parentId,
            content: r.content,
            isResolved: r.isResolved,
            resolvedById: r.resolvedById,
            resolvedAt: null,
            revisionCommitHash: r.revisionCommitHash,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            author: usersMap[r.authorId],
          })),
        })),
      updateComment: async (id: string, content: string) => {
        const c = comments.find((x) => x.id === id);
        if (c) {
          c.content = content;
          c.updatedAt = new Date();
          return c;
        }
        return null;
      },
      deleteComment: async (id: string) => {
        const idx = comments.findIndex((x) => x.id === id);
        if (idx !== -1) {
          comments.splice(idx, 1);
          return true;
        }
        return false;
      },
      setCommentResolved: async (id: string, isResolved: boolean, resolvedById: string | null) => {
        const c = comments.find((x) => x.id === id);
        if (c) {
          c.isResolved = isResolved;
          c.resolvedById = resolvedById;
          c.updatedAt = new Date();
          return c;
        }
        return null;
      },

      createTask: async (data: any) => {
        const item = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        tasks.push(item);
        return item;
      },
      findTaskById: async (id: string) => {
        const t = tasks.find((x) => x.id === id);
        if (!t) return null;
        return {
          id: t.id,
          projectId: t.projectId,
          creatorId: t.creatorId,
          assigneeId: t.assigneeId,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          labels: JSON.parse(t.labels || '[]'),
          linkedArtifactId: t.linkedArtifactId,
          linkedCommitHash: t.linkedCommitHash,
          linkedReviewId: t.linkedReviewId,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          creator: usersMap[t.creatorId],
          assignee: t.assigneeId ? usersMap[t.assigneeId] : null,
          linkedArtifact: null,
          commentsCount: taskComments.filter((c) => c.taskId === id).length,
        };
      },
      listTasks: async (pId: string, filters?: any) => {
        return tasks.filter((t) => {
          if (t.projectId !== pId) return false;
          if (filters?.status && filters.status !== 'all' && t.status !== filters.status) return false;
          if (filters?.priority && filters.priority !== 'all' && t.priority !== filters.priority) return false;
          if (filters?.assigneeId && t.assigneeId !== filters.assigneeId) return false;
          return true;
        }).map((t) => ({
          id: t.id,
          projectId: t.projectId,
          creatorId: t.creatorId,
          assigneeId: t.assigneeId,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          labels: JSON.parse(t.labels || '[]'),
          linkedArtifactId: t.linkedArtifactId,
          linkedCommitHash: t.linkedCommitHash,
          linkedReviewId: t.linkedReviewId,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          creator: usersMap[t.creatorId],
          assignee: t.assigneeId ? usersMap[t.assigneeId] : null,
          linkedArtifact: null,
        }));
      },
      updateTask: async (id: string, data: any) => {
        const t = tasks.find((x) => x.id === id);
        if (t) {
          Object.assign(t, data, { updatedAt: new Date() });
          return t;
        }
        return null;
      },
      deleteTask: async (id: string) => {
        const idx = tasks.findIndex((x) => x.id === id);
        if (idx !== -1) {
          tasks.splice(idx, 1);
          return true;
        }
        return false;
      },
      createTaskComment: async (data: any) => {
        const item = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        taskComments.push(item);
        return item;
      },
      listTaskComments: async (tId: string) =>
        taskComments.filter((c) => c.taskId === tId).map((c) => ({
          id: c.id,
          taskId: c.taskId,
          authorId: c.authorId,
          content: c.content,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          author: usersMap[c.authorId],
        })),

      createReview: async (data: any) => {
        const item = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        reviews.push(item);
        return item;
      },
      findReviewById: async (id: string) => {
        const r = reviews.find((x) => x.id === id);
        if (!r) return null;
        const revs = reviewers.filter((rv) => rv.reviewId === id).map((rv) => {
          const dec = decisions.find((d) => d.reviewId === id && d.reviewerId === rv.reviewerId);
          return {
            id: rv.id,
            reviewId: rv.reviewId,
            reviewerId: rv.reviewerId,
            createdAt: rv.createdAt.toISOString(),
            user: usersMap[rv.reviewerId],
            decision: dec
              ? {
                  decision: dec.decision,
                  feedback: dec.feedback,
                  commitHashAtDecision: dec.commitHashAtDecision,
                  createdAt: dec.createdAt.toISOString(),
                  updatedAt: dec.updatedAt.toISOString(),
                }
              : null,
          };
        });
        const approvedCount = revs.filter((rv) => rv.decision?.decision === 'approved').length;
        const crCount = revs.filter((rv) => rv.decision?.decision === 'changes_requested').length;
        return {
          id: r.id,
          projectId: r.projectId,
          creatorId: r.creatorId,
          title: r.title,
          description: r.description,
          targetType: r.targetType,
          targetRef: r.targetRef,
          status: r.status,
          closedById: r.closedById,
          closedAt: r.closedAt ? r.closedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          creator: usersMap[r.creatorId],
          reviewers: revs,
          decisionsCount: { approved: approvedCount, changesRequested: crCount },
          commentsCount: reviewComments.filter((c) => c.reviewId === id).length,
        };
      },
      listReviews: async (pId: string) =>
        reviews.filter((r) => r.projectId === pId).map((r) => ({
          id: r.id,
          projectId: r.projectId,
          creatorId: r.creatorId,
          title: r.title,
          description: r.description,
          targetType: r.targetType,
          targetRef: r.targetRef,
          status: r.status,
          closedById: r.closedById,
          closedAt: null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          creator: usersMap[r.creatorId],
          reviewers: [],
          decisionsCount: { approved: 0, changesRequested: 0 },
        })),
      updateReview: async (id: string, data: any) => {
        const r = reviews.find((x) => x.id === id);
        if (r) {
          Object.assign(r, data, { updatedAt: new Date() });
          return r;
        }
        return null;
      },
      addReviewer: async (reviewId: string, revId: string) => {
        const existing = reviewers.find((x) => x.reviewId === reviewId && x.reviewerId === revId);
        if (existing) return existing;
        const item = { id: crypto.randomUUID(), reviewId, reviewerId: revId, createdAt: new Date() };
        reviewers.push(item);
        return item;
      },
      removeReviewer: async (reviewId: string, revId: string) => {
        const idx = reviewers.findIndex((x) => x.reviewId === reviewId && x.reviewerId === revId);
        if (idx !== -1) {
          reviewers.splice(idx, 1);
          return true;
        }
        return false;
      },
      upsertDecision: async (data: any) => {
        const existing = decisions.find((d) => d.reviewId === data.reviewId && d.reviewerId === data.reviewerId);
        if (existing) {
          Object.assign(existing, data, { updatedAt: new Date() });
          return existing;
        }
        const item = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        decisions.push(item);
        return item;
      },
      createReviewComment: async (data: any) => {
        const item = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        reviewComments.push(item);
        return item;
      },
      listReviewComments: async (rId: string) =>
        reviewComments.filter((c) => c.reviewId === rId).map((c) => ({
          id: c.id,
          reviewId: c.reviewId,
          authorId: c.authorId,
          content: c.content,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          author: usersMap[c.authorId],
        })),

      createNotification: async (data: any) => {
        const item = { id: crypto.randomUUID(), ...data, isRead: false, readAt: null, createdAt: new Date() };
        notificationsList.push(item);
        return item;
      },
      findDuplicateNotification: async (rId: string, type: string, eType: string, eId: string, aId?: string | null) =>
        notificationsList.find(
          (n) => n.recipientId === rId && n.type === type && n.entityType === eType && n.entityId === eId && (aId ? n.actorId === aId : true)
        ) || null,
      listNotifications: async (rId: string) =>
        notificationsList.filter((n) => n.recipientId === rId).map((n) => ({
          id: n.id,
          recipientId: n.recipientId,
          actorId: n.actorId,
          projectId: n.projectId,
          type: n.type,
          title: n.title,
          message: n.message,
          entityType: n.entityType,
          entityId: n.entityId,
          isRead: n.isRead,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
          actor: usersMap[n.actorId],
          projectName: 'Main Project',
        })),
      getUnreadNotificationCount: async (rId: string) => notificationsList.filter((n) => n.recipientId === rId && !n.isRead).length,
      markNotificationAsRead: async (id: string, rId: string) => {
        const n = notificationsList.find((x) => x.id === id && x.recipientId === rId);
        if (n) {
          n.isRead = true;
          n.readAt = new Date();
          return true;
        }
        return false;
      },
      markAllNotificationsAsRead: async (rId: string) => {
        let count = 0;
        for (const n of notificationsList) {
          if (n.recipientId === rId && !n.isRead) {
            n.isRead = true;
            n.readAt = new Date();
            count++;
          }
        }
        return count;
      },
    };

    service = new CollaborationService(collabRepo, projRepo, userRepo, artRepo, gitSvc, intellSvc);
  });

  // 1. Project Membership & Role Enforcement
  describe('Project Membership & Access Control', () => {
    it('grants owner role automatically to project root owner', async () => {
      const access = await service.checkProjectAccess(ownerId, projectId);
      assert.equal(access.effectiveRole, 'owner');
    });

    it('grants correct roles to project members', async () => {
      const adminAccess = await service.checkProjectAccess(adminId, projectId);
      assert.equal(adminAccess.effectiveRole, 'admin');

      const memberAccess = await service.checkProjectAccess(memberId, projectId);
      assert.equal(memberAccess.effectiveRole, 'member');

      const reviewerAccess = await service.checkProjectAccess(reviewerId, projectId);
      assert.equal(reviewerAccess.effectiveRole, 'reviewer');

      const viewerAccess = await service.checkProjectAccess(viewerId, projectId);
      assert.equal(viewerAccess.effectiveRole, 'viewer');
    });

    it('throws ProjectForbiddenError when outsider attempts access', async () => {
      await assert.rejects(
        () => service.checkProjectAccess(outsiderId, projectId),
        ProjectForbiddenError
      );
    });

    it('throws ProjectForbiddenError when role is lower than required role', async () => {
      // Viewer trying an admin-level action
      await assert.rejects(
        () => service.checkProjectAccess(viewerId, projectId, 'admin'),
        ProjectForbiddenError
      );
    });

    it('throws ProjectNotFoundError for non-existent project', async () => {
      await assert.rejects(
        () => service.checkProjectAccess(ownerId, crypto.randomUUID()),
        ProjectNotFoundError
      );
    });
  });

  // 2. Invitations
  describe('Invitations Workflow', () => {
    it('creates an invitation and sends notification to invitee', async () => {
      const invite = await service.inviteMember(ownerId, projectId, {
        usernameOrEmail: 'outsider_user',
        role: 'member',
      });

      assert.equal(invite.role, 'member');
      assert.equal(invite.status, 'pending');
      assert.ok(invite.token);

      // Check notification sent to outsider
      assert.equal(notificationsList.length, 1);
      assert.equal(notificationsList[0].recipientId, outsiderId);
      assert.equal(notificationsList[0].type, 'invitation');

      // Check activity recorded
      assert.ok(activitiesList.some((a) => a.eventType === 'member.invited'));
    });

    it('prevents role escalation: admin cannot invite as owner', async () => {
      await assert.rejects(
        () =>
          service.inviteMember(adminId, projectId, {
            usernameOrEmail: 'outsider_user',
            role: 'owner',
          }),
        RoleEscalationError
      );
    });

    it('prevents inviting self', async () => {
      await assert.rejects(
        () =>
          service.inviteMember(ownerId, projectId, {
            usernameOrEmail: 'owner_user',
            role: 'member',
          }),
        CannotInviteSelfError
      );
    });

    it('prevents inviting existing member', async () => {
      await assert.rejects(
        () =>
          service.inviteMember(ownerId, projectId, {
            usernameOrEmail: 'member_user',
            role: 'member',
          }),
        UserAlreadyMemberError
      );
    });

    it('allows invitee to accept invitation and becomes member', async () => {
      const invite = await service.inviteMember(ownerId, projectId, {
        usernameOrEmail: 'outsider_user',
        role: 'member',
      });

      const accepted = await service.respondToInvitation(outsiderId, invite.token, 'accept');
      assert.equal(accepted.status, 'accepted');

      const access = await service.checkProjectAccess(outsiderId, projectId);
      assert.equal(access.effectiveRole, 'member');
    });

    it('prevents unauthorized user from accepting someone elses invite', async () => {
      const invite = await service.inviteMember(ownerId, projectId, {
        usernameOrEmail: 'outsider_user',
        role: 'member',
      });

      await assert.rejects(
        () => service.respondToInvitation(viewerId, invite.token, 'accept'),
        UnauthorizedInvitationActionError
      );
    });

    it('rejects expired invitations', async () => {
      const invite = await service.inviteMember(ownerId, projectId, {
        usernameOrEmail: 'outsider_user',
        role: 'member',
      });

      // Manually backdate expiration
      const invRecord = invitations.find((i) => i.token === invite.token);
      invRecord.expiresAt = new Date(Date.now() - 10000);

      await assert.rejects(
        () => service.respondToInvitation(outsiderId, invite.token, 'accept'),
        InvitationExpiredError
      );
    });
  });

  // 3. Member Management & Last Owner Protection
  describe('Member Management & Protections', () => {
    it('prevents removing or demoting the last owner', async () => {
      await assert.rejects(
        () => service.removeMember(ownerId, projectId, ownerId),
        LastOwnerCannotBeRemovedError
      );
    });

    it('prevents user from modifying their own role', async () => {
      await assert.rejects(
        () => service.updateMemberRole(adminId, projectId, adminId, { role: 'viewer' }),
        CollaborationForbiddenError
      );
    });

    it('allows admin to remove a member', async () => {
      await service.removeMember(adminId, projectId, viewerId);
      const member = members.find((m) => m.userId === viewerId);
      assert.equal(member, undefined);
    });
  });

  // 4. Artifact Comments & Discussions
  describe('Artifact Comments & Mentions', () => {
    it('creates comment with sanitization and notifies on @mention', async () => {
      const comment = await service.createComment(memberId, projectId, artifactId, {
        content: 'Check this <script>alert("xss")</script> out @viewer_user!',
      });

      // Script tag stripped
      assert.ok(!comment.content.includes('<script>'));
      assert.ok(comment.content.includes('Check this'));

      // Mention notification sent to viewer
      const mentionNotif = notificationsList.find((n) => n.recipientId === viewerId && n.type === 'mention');
      assert.ok(mentionNotif);
    });

    it('creates threaded replies and notifies parent author', async () => {
      const parent = await service.createComment(memberId, projectId, artifactId, {
        content: 'Initial discussion topic',
      });

      const reply = await service.createComment(reviewerId, projectId, artifactId, {
        content: 'I agree with this',
        parentId: parent.id,
      });

      assert.equal(reply.parentId, parent.id);

      // Notification sent to parent author (memberId)
      const replyNotif = notificationsList.find(
        (n) => n.recipientId === memberId && n.type === 'comment_reply'
      );
      assert.ok(replyNotif);
    });

    it('resolves and reopens discussion thread', async () => {
      const comment = await service.createComment(memberId, projectId, artifactId, {
        content: 'Need clarification',
      });

      const resolved = await service.resolveComment(reviewerId, projectId, comment.id, {
        isResolved: true,
      });
      assert.equal(resolved.isResolved, true);

      const reopened = await service.resolveComment(reviewerId, projectId, comment.id, {
        isResolved: false,
      });
      assert.equal(reopened.isResolved, false);
    });

    it('prevents viewers from creating comments', async () => {
      await assert.rejects(
        () => service.createComment(viewerId, projectId, artifactId, { content: 'Read-only attempt' }),
        ProjectForbiddenError
      );
    });
  });

  // 5. Tasks and Issues
  describe('Project Tasks & Issues', () => {
    it('creates and assigns a task, notifying assignee', async () => {
      const task = await service.createTask(memberId, projectId, {
        title: 'Implement unit tests',
        priority: 'high',
        status: 'todo',
        assigneeId: reviewerId,
        labels: ['testing', 'phase3'],
      });

      assert.equal(task.title, 'Implement unit tests');
      assert.equal(task.priority, 'high');
      assert.deepEqual(task.labels, ['testing', 'phase3']);

      // Notification to reviewer
      const taskNotif = notificationsList.find(
        (n) => n.recipientId === reviewerId && n.type === 'task_assigned'
      );
      assert.ok(taskNotif);
    });

    it('filters tasks by status and priority', async () => {
      await service.createTask(memberId, projectId, {
        title: 'Task A',
        status: 'todo',
        priority: 'low',
      });
      await service.createTask(memberId, projectId, {
        title: 'Task B',
        status: 'done',
        priority: 'urgent',
      });

      const doneTasks = await service.listTasks(viewerId, projectId, { status: 'done' });
      assert.equal(doneTasks.length, 1);
      assert.equal(doneTasks[0].title, 'Task B');
    });

    it('prevents linking an artifact from another project', async () => {
      await assert.rejects(
        () =>
          service.createTask(memberId, projectId, {
            title: 'Task with foreign artifact',
            linkedArtifactId: crypto.randomUUID(), // Does not exist in project
          }),
        CollaborationValidationError
      );
    });
  });

  // 6. Review Requests & Approval Workflow
  describe('Reviews & Approvals Workflow', () => {
    it('creates review and notifies assigned reviewers', async () => {
      const review = await service.createReview(memberId, projectId, {
        title: 'Feature review for main branch',
        targetType: 'branch',
        targetRef: 'main',
        reviewerIds: [reviewerId],
      });

      assert.equal(review.title, 'Feature review for main branch');
      assert.equal(review.status, 'open');

      const reviewNotif = notificationsList.find(
        (n) => n.recipientId === reviewerId && n.type === 'review_requested'
      );
      assert.ok(reviewNotif);
    });

    it('submits approval decision and updates review status', async () => {
      const review = await service.createReview(memberId, projectId, {
        title: 'Review A',
        targetType: 'branch',
        targetRef: 'main',
        reviewerIds: [reviewerId],
      });

      const updated = await service.submitReviewDecision(reviewerId, projectId, review.id, {
        decision: 'approved',
        feedback: 'Looks good to me!',
      });

      assert.equal(updated.status, 'approved');
      assert.equal(updated.decisionsCount.approved, 1);

      // Notification sent to author (memberId)
      const decisionNotif = notificationsList.find(
        (n) => n.recipientId === memberId && n.type === 'review_decision'
      );
      assert.ok(decisionNotif);
    });

    it('detects stale approvals when branch commit moves', async () => {
      const review = await service.createReview(memberId, projectId, {
        title: 'Review B',
        targetType: 'branch',
        targetRef: 'main',
        reviewerIds: [reviewerId],
      });

      await service.submitReviewDecision(reviewerId, projectId, review.id, {
        decision: 'approved',
        commitHashAtDecision: 'old-commit-123',
      });

      // HEAD in git mock is 'commit-hash-abc'
      const retrieved = await service.getReview(reviewerId, projectId, review.id);
      const rev = retrieved.reviewers.find((r) => r.reviewerId === reviewerId);
      assert.equal(rev?.decision?.isStale, true);
    });

    it('prevents submitting decisions on a closed review', async () => {
      const review = await service.createReview(memberId, projectId, {
        title: 'Review C',
        targetType: 'branch',
        targetRef: 'main',
      });

      await service.updateReview(memberId, projectId, review.id, { status: 'closed' });

      await assert.rejects(
        () =>
          service.submitReviewDecision(reviewerId, projectId, review.id, {
            decision: 'approved',
          }),
        ReviewClosedError
      );
    });
  });

  // 7. In-App Notifications & Deduplication
  describe('Notifications & Duplicate Prevention', () => {
    it('retrieves unread count, marks single as read, and marks all as read', async () => {
      await service.inviteMember(ownerId, projectId, {
        usernameOrEmail: 'outsider_user',
        role: 'viewer',
      });

      const unreadCount = await service.getUnreadNotificationCount(outsiderId);
      assert.equal(unreadCount, 1);

      const notifs = await service.listNotifications(outsiderId);
      assert.equal(notifs.length, 1);

      await service.markNotificationAsRead(outsiderId, notifs[0].id);
      const afterSingle = await service.getUnreadNotificationCount(outsiderId);
      assert.equal(afterSingle, 0);

      // Add another and mark all as read
      notificationsList.push({
        id: crypto.randomUUID(),
        recipientId: outsiderId,
        actorId: ownerId,
        projectId,
        type: 'mention',
        title: 'Test',
        message: 'Hello',
        entityType: 'test',
        entityId: '123',
        isRead: false,
        readAt: null,
        createdAt: new Date(),
      });

      const marked = await service.markAllNotificationsAsRead(outsiderId);
      assert.equal(marked, 1);
      const finalCount = await service.getUnreadNotificationCount(outsiderId);
      assert.equal(finalCount, 0);
    });
  });
});
