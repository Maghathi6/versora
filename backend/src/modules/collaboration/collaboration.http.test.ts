import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import {
  projectCollaborationRouter,
  collaborationGlobalRouter,
} from './collaboration.routes';
import { CollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';
import { ICollaborationRepository } from './collaboration.repository';
import { IProjectRepository } from '../projects/project.repository';
import { IUserRepository } from '../users/user.repository';
import { IArtifactRepository } from '../artifacts/artifact.repository';
import { IGitService } from '../git/git.service';
import { IIntelligenceService } from '../intelligence/intelligence.service';
import { TokenService } from '../auth/token.service';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';
import { ProjectRole } from './collaboration.types';

describe('HTTP Collaboration Endpoints (API Integration Tests)', () => {
  let server: Server;
  let baseUrl: string;

  const ownerId = '11111111-1111-1111-1111-111111111111';
  const memberId = '22222222-2222-2222-2222-222222222222';
  const outsiderId = '33333333-3333-3333-3333-333333333333';
  const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const artifactId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  const secretKey = 'test-jwt-secret-key-at-least-16-chars-long';
  const tokenService = new TokenService(secretKey, '1h');
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let members: any[];
  let invitations: any[];
  let comments: any[];
  let tasks: any[];
  let reviews: any[];
  let decisions: any[];
  let notificationsList: any[];

  before(async () => {
    ownerToken = tokenService.signAccessToken({ userId: ownerId, username: 'owner_user' });
    memberToken = tokenService.signAccessToken({ userId: memberId, username: 'member_user' });
    outsiderToken = tokenService.signAccessToken({ userId: outsiderId, username: 'outsider_user' });

    members = [
      { id: 'm1', projectId, userId: memberId, role: 'member', createdAt: new Date(), updatedAt: new Date() },
    ];
    invitations = [];
    comments = [];
    tasks = [];
    reviews = [];
    decisions = [];
    notificationsList = [];

    const usersMap: Record<string, any> = {
      [ownerId]: { id: ownerId, email: 'owner@example.com', username: 'owner_user', displayName: 'Owner' },
      [memberId]: { id: memberId, email: 'member@example.com', username: 'member_user', displayName: 'Member' },
      [outsiderId]: { id: outsiderId, email: 'outsider@example.com', username: 'outsider_user', displayName: 'Outsider' },
    };

    const userRepo: IUserRepository = {
      findById: async (id: string) => usersMap[id] || null,
      findByEmail: async (email: string) => Object.values(usersMap).find((u) => u.email === email) || null,
      findByUsername: async (username: string) => Object.values(usersMap).find((u) => u.username === username) || null,
      create: async () => ({} as any),
      update: async () => ({} as any),
    };

    const projRepo: IProjectRepository = {
      findById: async (id: string) => {
        if (id === projectId) {
          return { id: projectId, name: 'Main Project', description: null, ownerId, createdAt: new Date(), updatedAt: new Date() };
        }
        return null;
      },
      create: async () => ({} as any),
      findByOwnerId: async () => [],
      findByOwnerAndName: async () => null,
      update: async () => null,
      delete: async () => true,
    };

    const artRepo: IArtifactRepository = {
      findById: async (id: string) => {
        if (id === artifactId) {
          return { id: artifactId, projectId, name: 'index.ts', path: '/index.ts', type: 'file', artifactType: 'code' } as any;
        }
        return null;
      },
    } as any;

    const gitSvc: IGitService = {
      isRepoInitialized: () => true,
      getStatus: async () => ({
        isClean: true,
        currentBranch: 'main',
        headCommitHash: 'hash-123',
        staged: [],
        unstaged: [],
        untracked: [],
      }),
    } as any;

    const intellSvc: IIntelligenceService = {
      recordActivity: async () => {},
    } as any;

    const collabRepo: ICollaborationRepository = {
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
        const item = { id: 'm_' + Math.random(), projectId: pId, userId: uId, role, createdAt: new Date(), updatedAt: new Date() };
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
      countOwners: async () => 1,
      listUserProjectIds: async (uId: string) => members.filter((m) => m.userId === uId).map((m) => m.projectId),

      createInvitation: async (data: any) => {
        const item = { id: 'inv_' + Math.random(), ...data, createdAt: new Date(), updatedAt: new Date() };
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
          return inv;
        }
        return null;
      },

      createComment: async (data: any) => {
        const item = { id: 'c_' + Math.random(), ...data, isResolved: false, resolvedById: null, resolvedAt: null, createdAt: new Date(), updatedAt: new Date() };
        comments.push(item);
        return item;
      },
      findCommentById: async (id: string) => comments.find((c) => c.id === id) || null,
      listArtifactComments: async (aId: string) =>
        comments.filter((c) => c.artifactId === aId).map((c) => ({
          id: c.id,
          projectId: c.projectId,
          artifactId: c.artifactId,
          authorId: c.authorId,
          parentId: c.parentId,
          content: c.content,
          isResolved: c.isResolved,
          resolvedById: c.resolvedById,
          resolvedAt: null,
          revisionCommitHash: null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          author: usersMap[c.authorId],
          replyCount: 0,
          replies: [],
        })),
      updateComment: async (id: string, content: string) => {
        const c = comments.find((x) => x.id === id);
        if (c) {
          c.content = content;
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
          return c;
        }
        return null;
      },

      createTask: async (data: any) => {
        const item = { id: 't_' + Math.random(), ...data, createdAt: new Date(), updatedAt: new Date() };
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
          dueDate: null,
          labels: JSON.parse(t.labels || '[]'),
          linkedArtifactId: null,
          linkedCommitHash: null,
          linkedReviewId: null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          creator: usersMap[t.creatorId],
          assignee: t.assigneeId ? usersMap[t.assigneeId] : null,
          linkedArtifact: null,
          commentsCount: 0,
        };
      },
      listTasks: async (pId: string) =>
        tasks.filter((t) => t.projectId === pId).map((t) => ({
          id: t.id,
          projectId: t.projectId,
          creatorId: t.creatorId,
          assigneeId: t.assigneeId,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: null,
          labels: JSON.parse(t.labels || '[]'),
          linkedArtifactId: null,
          linkedCommitHash: null,
          linkedReviewId: null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          creator: usersMap[t.creatorId],
          assignee: t.assigneeId ? usersMap[t.assigneeId] : null,
          linkedArtifact: null,
        })),
      updateTask: async (id: string, data: any) => {
        const t = tasks.find((x) => x.id === id);
        if (t) {
          Object.assign(t, data);
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
      createTaskComment: async () => ({} as any),
      listTaskComments: async () => [],

      createReview: async (data: any) => {
        const item = { id: 'r_' + Math.random(), ...data, createdAt: new Date(), updatedAt: new Date() };
        reviews.push(item);
        return item;
      },
      findReviewById: async (id: string) => {
        const r = reviews.find((x) => x.id === id);
        if (!r) return null;
        return {
          id: r.id,
          projectId: r.projectId,
          creatorId: r.creatorId,
          title: r.title,
          description: r.description,
          targetType: r.targetType,
          targetRef: r.targetRef,
          status: r.status,
          closedById: null,
          closedAt: null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          creator: usersMap[r.creatorId],
          reviewers: [],
          decisionsCount: { approved: 0, changesRequested: 0 },
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
          closedById: null,
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
          Object.assign(r, data);
          return r;
        }
        return null;
      },
      addReviewer: async () => ({} as any),
      removeReviewer: async () => true,
      upsertDecision: async (data: any) => {
        decisions.push(data);
        return data;
      },
      createReviewComment: async () => ({} as any),
      listReviewComments: async () => [],

      createNotification: async (data: any) => {
        const item = { id: 'n_' + Math.random(), ...data, isRead: false, readAt: null, createdAt: new Date() };
        notificationsList.push(item);
        return item;
      },
      findDuplicateNotification: async () => null,
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
          readAt: null,
          createdAt: n.createdAt.toISOString(),
          actor: usersMap[n.actorId],
          projectName: 'Main Project',
        })),
      getUnreadNotificationCount: async (rId: string) => notificationsList.filter((n) => n.recipientId === rId && !n.isRead).length,
      markNotificationAsRead: async (id: string, rId: string) => {
        const n = notificationsList.find((x) => x.id === id && x.recipientId === rId);
        if (n) {
          n.isRead = true;
          return true;
        }
        return false;
      },
      markAllNotificationsAsRead: async (rId: string) => {
        let c = 0;
        for (const n of notificationsList) {
          if (n.recipientId === rId && !n.isRead) {
            n.isRead = true;
            c++;
          }
        }
        return c;
      },
    };

    const mockService = new CollaborationService(collabRepo, projRepo, userRepo, artRepo, gitSvc, intellSvc);
    const mockController = new CollaborationController(mockService);

    const app: Application = express();
    app.use(express.json());

    const authMw = createAuthMiddleware({ userRepo, tokenSvc: tokenService });

    const pRouter = Router();
    pRouter.use(authMw);
    pRouter.get('/:projectId/members', mockController.listMembers);
    pRouter.post('/:projectId/invitations', mockController.inviteMember);
    pRouter.get('/:projectId/invitations', mockController.listProjectInvitations);
    pRouter.patch('/:projectId/members/:memberUserId', mockController.updateMemberRole);
    pRouter.delete('/:projectId/members/:memberUserId', mockController.removeMember);

    pRouter.post('/:projectId/artifacts/:artifactId/comments', mockController.createComment);
    pRouter.get('/:projectId/artifacts/:artifactId/comments', mockController.listArtifactComments);
    pRouter.patch('/:projectId/comments/:commentId/resolve', mockController.resolveComment);

    pRouter.post('/:projectId/tasks', mockController.createTask);
    pRouter.get('/:projectId/tasks', mockController.listTasks);
    pRouter.patch('/:projectId/tasks/:taskId', mockController.updateTask);
    pRouter.delete('/:projectId/tasks/:taskId', mockController.deleteTask);

    pRouter.post('/:projectId/reviews', mockController.createReview);
    pRouter.get('/:projectId/reviews', mockController.listReviews);
    pRouter.post('/:projectId/reviews/:reviewId/decisions', mockController.submitReviewDecision);

    const gRouter = Router();
    gRouter.use(authMw);
    gRouter.get('/invitations/me', mockController.listUserInvitations);
    gRouter.post('/invitations/:token/accept', mockController.acceptInvitation);
    gRouter.get('/notifications', mockController.listNotifications);
    gRouter.get('/notifications/unread-count', mockController.getUnreadNotificationCount);
    gRouter.patch('/notifications/:notificationId/read', mockController.markNotificationAsRead);
    gRouter.post('/notifications/mark-all-read', mockController.markAllNotificationsAsRead);

    app.use('/api/v1/projects', pRouter);
    app.use('/api/v1', gRouter);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/projects/${projectId}/members`);
    assert.equal(res.status, 401);
  });

  it('rejects outsider from accessing members with 403', async () => {
    const res = await fetch(`${baseUrl}/projects/${projectId}/members`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert.equal(res.status, 403);
  });

  it('GET /projects/:projectId/members returns 200 with members list', async () => {
    const res = await fetch(`${baseUrl}/projects/${projectId}/members`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 2); // owner + member
  });

  it('POST /projects/:projectId/invitations invites user and returns 201', async () => {
    const res = await fetch(`${baseUrl}/projects/${projectId}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usernameOrEmail: 'outsider_user',
        role: 'member',
      }),
    });
    assert.equal(res.status, 201);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.role, 'member');
    assert.equal(json.data.status, 'pending');
  });

  it('POST /projects/:projectId/artifacts/:artifactId/comments adds a comment', async () => {
    const res = await fetch(`${baseUrl}/projects/${projectId}/artifacts/${artifactId}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: 'Looks good @owner_user!',
      }),
    });
    assert.equal(res.status, 201);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.content, 'Looks good @owner_user!');
  });

  it('POST /projects/:projectId/tasks creates a task', async () => {
    const res = await fetch(`${baseUrl}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Complete Phase 3 UI',
        priority: 'high',
        status: 'in_progress',
      }),
    });
    assert.equal(res.status, 201);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.title, 'Complete Phase 3 UI');
  });

  it('POST /projects/:projectId/reviews creates a review', async () => {
    const res = await fetch(`${baseUrl}/projects/${projectId}/reviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Review for main branch',
        targetType: 'branch',
        targetRef: 'main',
      }),
    });
    assert.equal(res.status, 201);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.title, 'Review for main branch');
  });

  it('GET /notifications returns user notifications with 200', async () => {
    const res = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  it('GET /notifications/unread-count returns unread count with 200', async () => {
    const res = await fetch(`${baseUrl}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(typeof json.data.count, 'number');
  });
});
