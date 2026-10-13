import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application } from 'express';
import crypto from 'node:crypto';
import { createGitHubOAuthRouter, createProjectGitHubRouter } from './github.routes';
import { GitHubController } from './github.controller';
import { GitHubService } from './github.service';
import { IGitHubRepository } from './github.repository';
import { IGitHubApiClient } from './github.api';
import { IProjectRepository } from '../projects/project.repository';
import { IUserRepository } from '../users/user.repository';
import { IArtifactRepository } from '../artifacts/artifact.repository';
import { IStorageDriver } from '../../storage/storage.interface';
import { GitRunner } from '../git/git.runner';
import { ProjectLockManager } from '../git/git.lock';
import { TokenService } from '../auth/token.service';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';
import { env } from '../../config/env';
import { encryptToken } from './github.crypto';

describe('GitHub HTTP Endpoints (/api/v1/github and /api/v1/projects/:id/github)', () => {
  let server: Server;
  let baseUrl: string;

  const testUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'test@example.com',
    username: 'tester',
    displayName: 'Tester User',
    avatarUrl: null,
    passwordHash: 'hash',
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const otherUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'other@example.com',
    username: 'other',
    displayName: 'Other User',
    avatarUrl: null,
    passwordHash: 'hash',
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectA = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Project Alpha',
    description: 'Owned by testUser',
    ownerId: testUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let tokenService: TokenService;
  let validToken: string;
  let otherToken: string;

  before(async () => {
    (env as any).GITHUB_CLIENT_ID = 'test-client-id';
    (env as any).GITHUB_CLIENT_SECRET = 'test-client-secret';

    tokenService = new TokenService();
    validToken = tokenService.signAccessToken({ userId: testUser.id, username: testUser.username });
    otherToken = tokenService.signAccessToken({ userId: otherUser.id, username: otherUser.username });

    const userRepo: IUserRepository = {
      async findById(id) {
        if (id === testUser.id) return testUser;
        if (id === otherUser.id) return otherUser;
        return null;
      },
      async findByEmail(email) {
        if (email === testUser.email) return testUser;
        return null;
      },
      async findByUsername(u) {
        if (u === testUser.username) return testUser;
        return null;
      },
      async create(d) {
        return {
          ...d,
          id: crypto.randomUUID(),
          avatarUrl: d.avatarUrl ?? null,
          bio: d.bio ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async update(id, d) {
        return null;
      },
    };

    const projectRepo: IProjectRepository = {
      async findById(id) {
        if (id === projectA.id) return projectA;
        return null;
      },
      async findByOwnerId(ownerId) {
        return ownerId === testUser.id ? [projectA] : [];
      },
      async findByOwnerAndName() {
        return null;
      },
      async create(d) {
        return {
          ...d,
          id: crypto.randomUUID(),
          description: d.description ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async update(id, d) {
        return null;
      },
      async delete() {
        return true;
      },
    };

    const accounts: any[] = [];
    const remotes: any[] = [];
    const states: any[] = [];

    const githubRepo: IGitHubRepository = {
      async findAccountByUserId(userId) {
        return accounts.find((a) => a.userId === userId) || null;
      },
      async upsertAccount(data) {
        const record = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
        accounts.push(record);
        return record as any;
      },
      async deleteAccountByUserId(userId) {
        const idx = accounts.findIndex((a) => a.userId === userId);
        if (idx === -1) return false;
        accounts.splice(idx, 1);
        return true;
      },
      async findRemoteByProjectId(projectId) {
        return remotes.find((r) => r.projectId === projectId) || null;
      },
      async upsertRemote(data) {
        const record = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
        remotes.push(record);
        return record as any;
      },
      async deleteRemoteByProjectId(projectId) {
        const idx = remotes.findIndex((r) => r.projectId === projectId);
        if (idx === -1) return false;
        remotes.splice(idx, 1);
        return true;
      },
      async updateRemoteTimestamps(projectId, ts) {
        const r = remotes.find((item) => item.projectId === projectId);
        if (!r) return null;
        Object.assign(r, ts);
        return r as any;
      },
      async createOAuthState(userId, state, returnTo, ttlMinutes = 10) {
        const record = {
          id: crypto.randomUUID(),
          userId,
          state,
          returnTo: returnTo || null,
          expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
          createdAt: new Date(),
        };
        states.push(record);
        return record as any;
      },
      async consumeOAuthState(state) {
        const idx = states.findIndex((s) => s.state === state);
        if (idx === -1) return null;
        const s = states.splice(idx, 1)[0];
        return s as any;
      },
    };

    const apiClient: IGitHubApiClient = {
      async exchangeOAuthCode() {
        return { accessToken: 'gho_secret_access_token_mock', scope: 'repo' };
      },
      async getAuthenticatedUser() {
        return {
          id: 12345,
          login: 'octotest',
          name: 'Octo Test',
          avatar_url: 'https://github.com/avatar.png',
          html_url: 'https://github.com/octotest',
          email: null,
        };
      },
      async createRepository(token, name, desc, isPrivate) {
        return {
          id: 54321,
          name,
          full_name: `octotest/${name}`,
          owner: { id: 12345, login: 'octotest', avatar_url: null },
          private: !!isPrivate,
          html_url: `https://github.com/octotest/${name}`,
          clone_url: `https://github.com/octotest/${name}.git`,
          default_branch: 'main',
          permissions: { admin: true, push: true, pull: true },
        };
      },
      async getRepository(token, owner, repo) {
        return {
          id: 54321,
          name: repo,
          full_name: `${owner}/${repo}`,
          owner: { id: 12345, login: owner, avatar_url: null },
          private: false,
          html_url: `https://github.com/${owner}/${repo}`,
          clone_url: `https://github.com/${owner}/${repo}.git`,
          default_branch: 'main',
          permissions: { admin: true, push: true, pull: true },
        };
      },
    };

    const gitService = new GitHubService(
      githubRepo,
      projectRepo,
      {} as any,
      userRepo,
      {} as any,
      new GitRunner(),
      new ProjectLockManager(),
      apiClient,
      process.cwd()
    );

    const controller = new GitHubController(gitService);

    const app: Application = express();
    app.use(express.json());

    app.use('/api/v1/github/oauth', createGitHubOAuthRouter(controller, userRepo, tokenService));
    app.use('/api/v1/projects', createProjectGitHubRouter(controller, userRepo, tokenService));

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
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('Authentication & Authorization Guards', () => {
    it('rejects GET /api/v1/github/oauth/status without Authorization header (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/github/oauth/status`);
      assert.strictEqual(res.status, 401);
      const data = await res.json() as any;
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    it('rejects GET /api/v1/projects/:projectId/github/status without Authorization header (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectA.id}/github/status`);
      assert.strictEqual(res.status, 401);
      const data = await res.json() as any;
      assert.strictEqual(data.success, false);
    });

    it('rejects GET /api/v1/projects/:projectId/github/status with invalid token (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectA.id}/github/status`, {
        headers: { Authorization: 'Bearer invalid.token.payload' },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json() as any;
      assert.strictEqual(data.success, false);
    });

    it('rejects GET /api/v1/projects/:projectId/github/status for another user project (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectA.id}/github/status`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json() as any;
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });
  });

  describe('OAuth Endpoints', () => {
    it('GET /api/v1/github/oauth/status returns configuration and connected state without secrets', async () => {
      const res = await fetch(`${baseUrl}/api/v1/github/oauth/status`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.isConfigured, true);
      assert.strictEqual(json.data.isConnected, false);
      assert.strictEqual(json.data.account, null);
      // Secrets must NEVER be in response
      assert.strictEqual(json.data.accessToken, undefined);
      assert.strictEqual(json.data.token, undefined);
    });

    it('GET /api/v1/github/oauth/authorize returns authorization URL with state', async () => {
      const res = await fetch(`${baseUrl}/api/v1/github/oauth/authorize?returnTo=/projects/${projectA.id}`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.ok(json.data.authorizeUrl);
      assert.ok(json.data.authorizeUrl.includes('https://github.com/login/oauth/authorize'));
      assert.ok(json.data.state);
    });

    it('GET /api/v1/github/oauth/callback redirects to frontend on denied access', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/github/oauth/callback?error=access_denied&error_description=User+denied+access`,
        { redirect: 'manual' }
      );
      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location);
      assert.ok(location.includes('github_error=access_denied'));
    });

    it('GET /api/v1/github/oauth/callback handles valid callback, exchanges token, and redirects with success', async () => {
      // 1. Generate auth state
      const authRes = await fetch(`${baseUrl}/api/v1/github/oauth/authorize?returnTo=/projects/${projectA.id}`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      const authData = await authRes.json() as any;
      const state = authData.data.state;

      // 2. Simulate callback
      const callbackRes = await fetch(
        `${baseUrl}/api/v1/github/oauth/callback?code=mock_code&state=${state}`,
        { redirect: 'manual' }
      );
      assert.strictEqual(callbackRes.status, 302);
      const location = callbackRes.headers.get('location');
      assert.ok(location);
      assert.ok(location.includes('github=connected'));
      assert.ok(location.includes('username=octotest'));

      // 3. Status now reports connected without exposing token
      const statusRes = await fetch(`${baseUrl}/api/v1/github/oauth/status`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      const statusData = await statusRes.json() as any;
      assert.strictEqual(statusData.data.isConnected, true);
      assert.strictEqual(statusData.data.account.username, 'octotest');
      assert.strictEqual(statusData.data.account.accessToken, undefined);
    });
  });

  describe('Validation Guards', () => {
    it('POST /api/v1/projects/:projectId/github/link rejects invalid GitHub repo format (400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectA.id}/github/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({
          owner: '',
          repo: '',
        }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json() as any;
      assert.strictEqual(json.success, false);
    });

    it('POST /api/v1/projects/:projectId/github/publish rejects invalid payload (400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectA.id}/github/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({
          // Missing required name
          isPrivate: false,
        }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json() as any;
      assert.strictEqual(json.success, false);
    });
  });
});
