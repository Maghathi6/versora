import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createGitRouter } from './git.routes';
import { GitService } from './git.service';
import { GitRunner } from './git.runner';
import { ProjectLockManager } from './git.lock';
import { IArtifactRepository, ProjectStats } from '../artifacts/artifact.repository';
import { IProjectRepository } from '../projects/project.repository';
import { IUserRepository } from '../users/user.repository';
import { IStorageDriver, SaveResult } from '../../storage/storage.interface';
import { Artifact, NewArtifact } from '../artifacts/artifact.types';
import { Project } from '../projects/project.types';
import { User } from '../users/user.types';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { TokenService } from '../auth/token.service';
import { Readable } from 'node:stream';

function createStubProjectRepo(projectsList: Project[] = []): IProjectRepository {
  const list = [...projectsList];
  return {
    async create(data) {
      const p: Project = {
        id: `proj-${list.length + 1}`,
        name: data.name,
        description: data.description || null,
        ownerId: data.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      list.push(p);
      return p;
    },
    async findById(id) {
      return list.find((p) => p.id === id) || null;
    },
    async findByOwnerId(ownerId) {
      return list.filter((p) => p.ownerId === ownerId);
    },
    async findByOwnerAndName(ownerId, name) {
      return list.find((p) => p.ownerId === ownerId && p.name.toLowerCase() === name.toLowerCase()) || null;
    },
    async update(id, data) {
      const p = list.find((item) => item.id === id);
      if (!p) return null;
      if (data.name) p.name = data.name;
      return p;
    },
    async delete(id) {
      const idx = list.findIndex((item) => item.id === id);
      if (idx === -1) return false;
      list.splice(idx, 1);
      return true;
    },
  };
}

function createStubArtifactRepo(seedArtifacts: Artifact[] = []): IArtifactRepository {
  const list: Artifact[] = [...seedArtifacts];
  return {
    async create(data: NewArtifact): Promise<Artifact> {
      const a: Artifact = {
        id: `art-${list.length + 1}`,
        projectId: data.projectId,
        parentId: data.parentId || null,
        name: data.name,
        path: data.path,
        type: data.type,
        artifactType: data.artifactType,
        mimeType: data.mimeType || null,
        sizeBytes: data.sizeBytes || 0,
        storageKey: data.storageKey || null,
        hash: data.hash || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      list.push(a);
      return a;
    },
    async findById(id: string): Promise<Artifact | null> {
      return list.find((a) => a.id === id) || null;
    },
    async findByProjectAndParent(projectId: string, parentId: string | null): Promise<Artifact[]> {
      return list.filter((a) => a.projectId === projectId && a.parentId === parentId);
    },
    async findByProjectAndName(projectId: string, parentId: string | null, name: string): Promise<Artifact | null> {
      return list.find((a) => a.projectId === projectId && a.parentId === parentId && a.name === name) || null;
    },
    async findAllByProjectId(projectId: string): Promise<Artifact[]> {
      return list.filter((a) => a.projectId === projectId);
    },
    async findDescendants(folderId: string): Promise<Artifact[]> {
      return [];
    },
    async update(id: string, data: Partial<NewArtifact>): Promise<Artifact | null> {
      const item = list.find((a) => a.id === id);
      if (!item) return null;
      Object.assign(item, data);
      return item;
    },
    async delete(id: string): Promise<boolean> {
      const idx = list.findIndex((a) => a.id === id);
      if (idx === -1) return false;
      list.splice(idx, 1);
      return true;
    },
    async deleteMany(ids: string[]): Promise<number> {
      return 0;
    },
    async getStatsByProject(projectId: string): Promise<ProjectStats> {
      return { totalFiles: 0, totalFolders: 0, totalSizeBytes: 0 };
    },
  };
}

function createStubUserRepo(): IUserRepository {
  const users: User[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'user_a@example.com',
      username: 'user_a',
      displayName: 'User A',
      avatarUrl: null,
      passwordHash: 'hash',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'user_b@example.com',
      username: 'user_b',
      displayName: 'User B',
      avatarUrl: null,
      passwordHash: 'hash',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return {
    async findById(id: string) {
      return users.find((u) => u.id === id) || null;
    },
    async findByEmail(email: string) {
      return users.find((u) => u.email === email) || null;
    },
    async findByUsername(username: string) {
      return users.find((u) => u.username === username) || null;
    },
    async create(data: any) {
      return users[0];
    },
    async update(id: string, data: any) {
      return users[0];
    },
  };
}

describe('HTTP Git Endpoints (/api/v1/projects/:projectId/git)', () => {
  const testReposDir = path.resolve(process.cwd(), 'scratch/test_git_http_repos');
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

  let gitService: GitService;

  before(async () => {
    await fs.promises.mkdir(testReposDir, { recursive: true });

    validTokenA = tokenService.signAccessToken({ userId: userAId, username: 'user_a' });
    validTokenB = tokenService.signAccessToken({ userId: userBId, username: 'user_b' });

    const userRepo = createStubUserRepo();
    const projRepo = createStubProjectRepo([
      {
        id: projectAId,
        name: 'Project A',
        description: null,
        ownerId: userAId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: projectBId,
        name: 'Project B',
        description: null,
        ownerId: userBId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const artifactRepo = createStubArtifactRepo();
    const storage: IStorageDriver = {
      async save(key, content) {
        return { sizeBytes: content.length, hash: 'h' };
      },
      async getBuffer(key) {
        return Buffer.from('');
      },
      async getStream(key) {
        return Readable.from([]);
      },
      async exists(key) {
        return true;
      },
      async delete(key) {
        return true;
      },
    };

    gitService = new GitService(
      testReposDir,
      new GitRunner(),
      new ProjectLockManager(),
      artifactRepo,
      projRepo,
      userRepo,
      storage
    );

    const app: Application = express();
    app.use(express.json());

    const authMiddleware = createAuthMiddleware({ userRepo, tokenSvc: tokenService });
    const gitRouter = createGitRouter(gitService, authMiddleware);

    const apiV1Router = Router();
    apiV1Router.use('/projects', gitRouter);

    app.use('/api/v1', apiV1Router);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    try {
      await fs.promises.rm(testReposDir, { recursive: true, force: true });
    } catch {}
  });

  it('rejects unauthenticated requests to /git/status with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/status`);
    assert.strictEqual(res.status, 401);
  });

  it('rejects cross-user requests to /git/status with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/status`, {
      headers: { Authorization: `Bearer ${validTokenB}` },
    });
    assert.strictEqual(res.status, 403);
  });

  it('initializes real Git repository via POST /git/init', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/init`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${validTokenA}` },
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.isInitialized, true);
    assert.strictEqual(body.data.branch, 'main');
  });

  it('retrieves status via GET /git/status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/status`, {
      headers: { Authorization: `Bearer ${validTokenA}` },
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.isInitialized, true);
    assert.strictEqual(body.data.currentBranch, 'main');
  });

  it('commits changes via POST /git/commit', async () => {
    // Write a real file into repo
    const repoPath = gitService.getProjectRepoPath(projectAId);
    await fs.promises.writeFile(path.join(repoPath, 'index.js'), 'console.log("HTTP test");');

    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/commit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validTokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Add index.js' }),
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.message, 'Add index.js');
    assert.ok(body.data.hash);
  });

  it('retrieves history via GET /git/history', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/history`, {
      headers: { Authorization: `Bearer ${validTokenA}` },
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  it('creates and lists branches via POST and GET /git/branches', async () => {
    const createRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/branches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validTokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'feature/test-api' }),
    });

    assert.strictEqual(createRes.status, 201);

    const listRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/branches`, {
      headers: { Authorization: `Bearer ${validTokenA}` },
    });

    assert.strictEqual(listRes.status, 200);
    const listBody = (await listRes.json()) as any;
    assert.ok(listBody.data.some((b: any) => b.name === 'feature/test-api'));
  });

  it('switches branches via POST /git/branches/switch', async () => {
    const switchRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/git/branches/switch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validTokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ branch: 'feature/test-api' }),
    });

    assert.strictEqual(switchRes.status, 200);
    const switchBody = (await switchRes.json()) as any;
    assert.strictEqual(switchBody.data.currentBranch, 'feature/test-api');
  });
});
