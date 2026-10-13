import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import { projectWorkflowRouter } from './workflow.routes';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { TokenService } from '../auth/token.service';
import { ProjectForbiddenError } from '../projects/project.errors';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';

describe('HTTP Workflow Endpoints (API Integration Tests)', () => {
  let server: Server;
  let baseUrl: string;

  const ownerId = '11111111-1111-1111-1111-111111111111';
  const outsiderId = '33333333-3333-3333-3333-333333333333';
  const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const secretKey = 'test-jwt-secret-key-at-least-16-chars-long';
  const tokenService = new TokenService(secretKey, '1h');
  let ownerToken: string;
  let outsiderToken: string;

  before(async () => {
    ownerToken = tokenService.signAccessToken({ userId: ownerId, username: 'owner_user' });
    outsiderToken = tokenService.signAccessToken({ userId: outsiderId, username: 'outsider_user' });

    const userRepo: any = {
      findById: async (id: string) => ({
        id,
        username: id === ownerId ? 'owner_user' : 'outsider_user',
        email: `${id}@example.com`,
      }),
    };

    const projectRepo: any = {
      findById: async (id: string) => {
        if (id === projectId) {
          return {
            id: projectId,
            name: 'Workspace Alpha',
            description: 'Core project workspace',
            ownerId,
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-02'),
          };
        }
        return null;
      },
    };

    const artifactRepo: any = {
      findAllByProjectId: async () => [
        { id: 'art-1', projectId, name: 'index.ts', path: '/index.ts', type: 'file', artifactType: 'code', sizeBytes: 512 },
      ],
      findById: async (id: string) => ({
        id,
        projectId,
        name: 'index.ts',
        path: '/index.ts',
        type: 'file',
        artifactType: 'code',
      }),
    };

    const collaborationSvc: any = {
      checkProjectAccess: async (uId: string, pId: string) => {
        if (uId !== ownerId) {
          throw new ProjectForbiddenError('You do not have access to this project');
        }
        return { project: { id: pId }, effectiveRole: 'owner' };
      },
    };

    const collaborationRepo: any = {
      listMembers: async () => [{ userId: ownerId, role: 'owner' }],
      listReviews: async () => [
        {
          id: 'rev-1',
          projectId,
          title: 'Initial architecture review',
          targetType: 'branch',
          targetRef: 'main',
          status: 'pending',
          reviewers: [{ userId: ownerId, hasDecided: false }],
        },
      ],
      listTasks: async () => [
        {
          id: 'task-1',
          projectId,
          title: 'Implement index exports',
          status: 'todo',
          priority: 'high',
          assigneeId: ownerId,
          dueDate: null,
          linkedArtifactId: 'art-1',
        },
      ],
    };

    const gitSvc: any = {
      getStatus: async () => ({
        isInitialized: true,
        currentBranch: 'main',
        isClean: true,
        staged: [],
        unstaged: [],
        untracked: [],
        totalChangesCount: 0,
      }),
      getHistory: async () => [
        {
          hash: '1234567890abcdef1234567890abcdef12345678',
          shortHash: '1234567',
          message: 'Initial project commit',
          author: { name: 'Owner', email: 'owner@example.com' },
          timestamp: '2025-01-01T00:00:00Z',
        },
      ],
      getCommit: async () => ({
        commit: {
          hash: '1234567890abcdef1234567890abcdef12345678',
          message: 'Initial project commit',
          author: { name: 'Owner', email: 'owner@example.com' },
          timestamp: '2025-01-01T00:00:00Z',
        },
        files: [{ path: 'index.ts', status: 'added', additions: 25, deletions: 0 }],
      }),
    };

    const intelligenceSvc: any = {
      listRelationships: async () => [],
      getImpactAnalysis: async () => ({ impactCount: 0, items: [] }),
    };

    const intelligenceRepo: any = {
      listActivities: async () => [
        { id: 'act-1', eventType: 'artifact.created', entityType: 'artifact', summary: 'Created index.ts', createdAt: new Date() },
      ],
    };

    const githubSvc: any = {
      getProjectRemoteStatus: async () => ({ isLinked: false }),
    };

    const assistantSvc: any = {
      getConfig: async () => ({ configured: true, provider: 'mock' }),
    };

    const workflowSvc = new WorkflowService(
      projectRepo,
      artifactRepo,
      collaborationSvc,
      collaborationRepo,
      gitSvc,
      intelligenceSvc,
      intelligenceRepo,
      githubSvc,
      assistantSvc
    );

    const controller = new WorkflowController(workflowSvc);
    const authMiddleware = createAuthMiddleware({ tokenSvc: tokenService, userRepo });

    const app: Application = express();
    app.use(express.json());

    const apiV1 = Router();
    apiV1.use('/projects', projectWorkflowRouter(controller, authMiddleware));
    app.use('/api/v1', apiV1);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/v1/projects/:projectId/dashboard rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/dashboard`);
    assert.strictEqual(res.status, 401);
  });

  it('GET /api/v1/projects/:projectId/dashboard rejects non-member with 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/dashboard`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  it('GET /api/v1/projects/:projectId/dashboard returns 200 with full dashboard metrics for member', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/dashboard`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(res.status, 200);

    const json = (await res.json()) as any;
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.project.id, projectId);
    assert.strictEqual(json.data.stats.filesCount, 1);
    assert.strictEqual(json.data.git.isInitialized, true);
    assert.strictEqual(json.data.pendingReviews.length, 1);
    assert.strictEqual(json.data.myTasks.length, 1);
    assert.strictEqual(json.data.aiAssistant.isConfigured, true);
  });

  it('GET /api/v1/projects/:projectId/search returns search matches', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/search?q=index`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(res.status, 200);

    const json = (await res.json()) as any;
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.query, 'index');
    assert.ok(json.data.artifacts.length >= 1);
    assert.strictEqual(json.data.artifacts[0].name, 'index.ts');
  });

  it('GET /api/v1/projects/:projectId/workflow/context returns 360-degree context', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectId}/workflow/context?artifactId=art-1&commitHash=1234567890abcdef1234567890abcdef12345678`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    assert.strictEqual(res.status, 200);

    const json = (await res.json()) as any;
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.artifactId, 'art-1');
    assert.ok(json.data.gitCommit);
    assert.strictEqual(json.data.gitCommit.files[0].path, 'index.ts');
  });
});
