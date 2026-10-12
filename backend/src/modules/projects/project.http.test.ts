import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import { createProjectRouter } from './project.routes';
import { ProjectService } from './project.service';
import { IProjectRepository } from './project.repository';
import { Project, NewProject, UpdateProjectData } from './project.types';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { TokenService } from '../auth/token.service';
import { IUserRepository } from '../users/user.repository';
import { User } from '../users/user.types';

function createStubProjectRepository(seedProjects: Project[] = []): IProjectRepository {
  const list: Project[] = [...seedProjects];

  return {
    async create(data: NewProject): Promise<Project> {
      const newProj: Project = {
        id: `00000000-0000-0000-0000-${String(list.length + 1).padStart(12, '0')}`,
        name: data.name.trim(),
        description: data.description ? data.description.trim() : null,
        ownerId: data.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      list.push(newProj);
      return newProj;
    },
    async findById(id: string): Promise<Project | null> {
      return list.find((p) => p.id === id) || null;
    },
    async findByOwnerId(ownerId: string): Promise<Project[]> {
      return list
        .filter((p) => p.ownerId === ownerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findByOwnerAndName(ownerId: string, name: string): Promise<Project | null> {
      const trimmed = name.trim().toLowerCase();
      return (
        list.find((p) => p.ownerId === ownerId && p.name.toLowerCase() === trimmed) || null
      );
    },
    async update(id: string, data: UpdateProjectData): Promise<Project | null> {
      const proj = list.find((p) => p.id === id);
      if (!proj) return null;
      if (data.name !== undefined) proj.name = data.name.trim();
      if (data.description !== undefined) proj.description = data.description ? data.description.trim() : null;
      proj.updatedAt = new Date();
      return proj;
    },
    async delete(id: string): Promise<boolean> {
      const index = list.findIndex((p) => p.id === id);
      if (index === -1) return false;
      list.splice(index, 1);
      return true;
    },
  };
}

describe('HTTP Project Endpoints (/api/v1/projects)', () => {
  let server: Server;
  let baseUrl: string;

  const userAId = '11111111-1111-1111-1111-111111111111';
  const userBId = '22222222-2222-2222-2222-222222222222';
  const projectAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const projectBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const secretKey = 'test-jwt-secret-key-at-least-16-chars-long';
  const tokenService = new TokenService(secretKey, '1h');

  let validTokenA: string;
  let validTokenB: string;

  before(async () => {
    validTokenA = tokenService.signAccessToken({
      userId: userAId,
      username: 'user_a',
    });

    validTokenB = tokenService.signAccessToken({
      userId: userBId,
      username: 'user_b',
    });

    const stubUsers: User[] = [
      {
        id: userAId,
        username: 'user_a',
        email: 'a@example.com',
        displayName: 'User A',
        passwordHash: 'hash_a',
        avatarUrl: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: userBId,
        username: 'user_b',
        email: 'b@example.com',
        displayName: 'User B',
        passwordHash: 'hash_b',
        avatarUrl: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const stubUserRepo: IUserRepository = {
      async findById(id: string): Promise<User | null> {
        return stubUsers.find((u) => u.id === id) || null;
      },
      async findByEmail(email: string): Promise<User | null> {
        return stubUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
      },
      async findByUsername(username: string): Promise<User | null> {
        return stubUsers.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
      },
      async create(data): Promise<User> {
        const u: User = {
          id: 'new-id',
          ...data,
          avatarUrl: data.avatarUrl || null,
          bio: data.bio || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        stubUsers.push(u);
        return u;
      },
      async update(id, data): Promise<User | null> {
        const u = stubUsers.find((user) => user.id === id);
        if (!u) return null;
        if (data.displayName) u.displayName = data.displayName;
        return u;
      },
    };

    const seedProjects: Project[] = [
      {
        id: projectAId,
        name: 'Project Alpha',
        description: 'First project for User A',
        ownerId: userAId,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: projectBId,
        name: 'Project Beta',
        description: 'First project for User B',
        ownerId: userBId,
        createdAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ];

    const stubProjectRepo = createStubProjectRepository(seedProjects);
    const projService = new ProjectService(stubProjectRepo);

    const authMiddleware = createAuthMiddleware({
      userRepo: stubUserRepo,
      tokenSvc: tokenService,
    });

    const projectRouter = createProjectRouter(projService, authMiddleware);

    const app: Application = express();
    app.use(express.json());

    const rootRouter = Router();
    const v1Router = Router();
    v1Router.use('/projects', projectRouter);
    rootRouter.use('/v1', v1Router);
    rootRouter.use('/projects', projectRouter); // alias

    app.use('/api', rootRouter);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  describe('Authentication & Authorization Guards', () => {
    it('rejects POST /api/v1/projects without Authorization header with 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauth Project' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    it('rejects GET /api/v1/projects with invalid token with 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        headers: { Authorization: 'Bearer corrupt-jwt-token' },
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    it('rejects GET /api/v1/projects/:projectId of another user with 403 FORBIDDEN', async () => {
      // User A attempts to access Project B (owned by User B)
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectBId}`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    it('rejects PATCH /api/v1/projects/:projectId of another user with 403 FORBIDDEN', async () => {
      // User A attempts to edit Project B
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectBId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Tampered Name' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    it('rejects DELETE /api/v1/projects/:projectId of another user with 403 FORBIDDEN', async () => {
      // User A attempts to delete Project B
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectBId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });
  });

  describe('Project Creation (POST /api/v1/projects)', () => {
    it('creates a project with valid payload and returns 201 Created', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Project Gamma',
          description: 'A third project owned by User A',
        }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.name, 'Project Gamma');
      assert.strictEqual(json.data.description, 'A third project owned by User A');
      assert.strictEqual(json.data.ownerId, userAId);
      assert.ok(json.data.id);
      assert.ok(json.timestamp);
    });

    it('ignores client-supplied ownerId and strictly enforces authenticated user', async () => {
      // Attempting to inject ownerId in request body fails strict Zod validation
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Spoofed Project',
          ownerId: userBId,
        }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });

    it('returns 409 CONFLICT for duplicate project name owned by same user', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Project Alpha', // already exists for userA
        }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 409);
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'CONFLICT');
    });

    it('returns 400 VALIDATION_ERROR for empty project name', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '   ',
        }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(json.error.details));
    });

    it('supports route alias POST /api/projects seamlessly', async () => {
      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenB}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Beta Project Two',
        }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.ownerId, userBId);
    });
  });

  describe('Project Listing (GET /api/v1/projects)', () => {
    it('returns 200 OK with only projects owned by authenticated user', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      // All returned projects must belong to userAId
      for (const p of json.data) {
        assert.strictEqual(p.ownerId, userAId);
      }
    });

    it('supports route alias GET /api/projects seamlessly', async () => {
      const res = await fetch(`${baseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      for (const p of json.data) {
        assert.strictEqual(p.ownerId, userBId);
      }
    });
  });

  describe('Project Retrieval (GET /api/v1/projects/:projectId)', () => {
    it('returns 200 OK with project data for owned project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, projectAId);
      assert.strictEqual(json.data.name, 'Project Alpha');
    });

    it('returns 404 NOT_FOUND for non-existent project ID', async () => {
      const missingId = '99999999-9999-9999-9999-999999999999';
      const res = await fetch(`${baseUrl}/api/v1/projects/${missingId}`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 404);
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'NOT_FOUND');
    });

    it('returns 400 VALIDATION_ERROR for non-UUID parameter', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/invalid-id`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('Project Update (PATCH /api/v1/projects/:projectId)', () => {
    it('returns 200 OK with updated project data for owned project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Project Alpha Renamed',
          description: 'Updated description for Alpha',
        }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.name, 'Project Alpha Renamed');
      assert.strictEqual(json.data.description, 'Updated description for Alpha');
    });

    it('returns 400 VALIDATION_ERROR for empty update payload', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });

    it('returns 404 NOT_FOUND when updating non-existent project', async () => {
      const missingId = '99999999-9999-9999-9999-999999999999';
      const res = await fetch(`${baseUrl}/api/v1/projects/${missingId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Name' }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 404);
      assert.strictEqual(json.success, false);
    });
  });

  describe('Project Deletion (DELETE /api/v1/projects/:projectId)', () => {
    it('returns 200 OK and deletes owned project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, projectAId);

      // Verify it is no longer retrievable
      const checkRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      assert.strictEqual(checkRes.status, 404);
    });

    it('returns 404 NOT_FOUND when deleting already-deleted or non-existent project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 404);
      assert.strictEqual(json.success, false);
    });
  });
});
