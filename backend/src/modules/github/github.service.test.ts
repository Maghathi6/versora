import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GitHubService } from './github.service';
import { IGitHubRepository } from './github.repository';
import { IGitHubApiClient } from './github.api';
import { GitService } from '../git/git.service';
import { GitRunner } from '../git/git.runner';
import { ProjectLockManager } from '../git/git.lock';
import { IProjectRepository } from '../projects/project.repository';
import { IArtifactRepository, ProjectStats } from '../artifacts/artifact.repository';
import { IUserRepository } from '../users/user.repository';
import { IStorageDriver, SaveResult } from '../../storage/storage.interface';
import { Project } from '../projects/project.types';
import { User } from '../users/user.types';
import { Artifact, NewArtifact } from '../artifacts/artifact.types';
import {
  UserGithubAccount,
  NewUserGithubAccount,
  ProjectGithubRemote,
  NewProjectGithubRemote,
  GithubOAuthState,
} from '../../db/schema';
import {
  GitHubOAuthStateError,
  GitHubSyncConflictError,
  GitHubNotFoundError,
  GitHubNotConfiguredError,
  GitHubAuthRequiredError,
  GitHubForbiddenError,
} from './github.errors';
import { ProjectForbiddenError, ProjectNotFoundError } from '../projects/project.errors';
import { encryptToken } from './github.crypto';
import { env } from '../../config/env';

// --- Stub Implementations ---

function createStubGitHubRepo(): IGitHubRepository {
  const accounts: UserGithubAccount[] = [];
  const remotes: ProjectGithubRemote[] = [];
  const states: GithubOAuthState[] = [];

  return {
    async findAccountByUserId(userId: string): Promise<UserGithubAccount | null> {
      return accounts.find((a) => a.userId === userId) || null;
    },
    async upsertAccount(data: NewUserGithubAccount): Promise<UserGithubAccount> {
      const idx = accounts.findIndex((a) => a.userId === data.userId);
      const record: UserGithubAccount = {
        id: crypto.randomUUID(),
        userId: data.userId,
        githubUserId: data.githubUserId,
        githubUsername: data.githubUsername,
        encryptedAccessToken: data.encryptedAccessToken,
        tokenIv: data.tokenIv,
        tokenTag: data.tokenTag,
        scope: data.scope ?? null,
        avatarUrl: data.avatarUrl ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (idx !== -1) {
        accounts[idx] = record;
      } else {
        accounts.push(record);
      }
      return record;
    },
    async deleteAccountByUserId(userId: string): Promise<boolean> {
      const idx = accounts.findIndex((a) => a.userId === userId);
      if (idx === -1) return false;
      accounts.splice(idx, 1);
      return true;
    },
    async findRemoteByProjectId(projectId: string): Promise<ProjectGithubRemote | null> {
      return remotes.find((r) => r.projectId === projectId) || null;
    },
    async upsertRemote(data: NewProjectGithubRemote): Promise<ProjectGithubRemote> {
      const idx = remotes.findIndex((r) => r.projectId === data.projectId);
      const record: ProjectGithubRemote = {
        id: crypto.randomUUID(),
        projectId: data.projectId,
        githubOwner: data.githubOwner,
        githubRepoName: data.githubRepoName,
        remoteUrl: data.remoteUrl,
        isPrivate: data.isPrivate ?? false,
        defaultBranch: data.defaultBranch || 'main',
        lastFetchedAt: data.lastFetchedAt || null,
        lastPushedAt: data.lastPushedAt || null,
        lastPulledAt: data.lastPulledAt || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (idx !== -1) {
        remotes[idx] = record;
      } else {
        remotes.push(record);
      }
      return record;
    },
    async deleteRemoteByProjectId(projectId: string): Promise<boolean> {
      const idx = remotes.findIndex((r) => r.projectId === projectId);
      if (idx === -1) return false;
      remotes.splice(idx, 1);
      return true;
    },
    async updateRemoteTimestamps(
      projectId: string,
      timestamps: { lastFetchedAt?: Date; lastPushedAt?: Date; lastPulledAt?: Date }
    ): Promise<ProjectGithubRemote | null> {
      const r = remotes.find((item) => item.projectId === projectId);
      if (!r) return null;
      if (timestamps.lastFetchedAt !== undefined) r.lastFetchedAt = timestamps.lastFetchedAt;
      if (timestamps.lastPushedAt !== undefined) r.lastPushedAt = timestamps.lastPushedAt;
      if (timestamps.lastPulledAt !== undefined) r.lastPulledAt = timestamps.lastPulledAt;
      return r;
    },
    async createOAuthState(userId: string, state: string, returnTo?: string, ttlMinutes = 10): Promise<GithubOAuthState> {
      const record: GithubOAuthState = {
        id: crypto.randomUUID(),
        userId,
        state,
        returnTo: returnTo || null,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        createdAt: new Date(),
      };
      states.push(record);
      return record;
    },
    async consumeOAuthState(state: string): Promise<GithubOAuthState | null> {
      const idx = states.findIndex((s) => s.state === state);
      if (idx === -1) return null;
      const s = states[idx];
      states.splice(idx, 1);
      if (s.expiresAt < new Date()) {
        return null;
      }
      return s;
    },
  };
}

function createStubProjectRepo(seed: Project[] = []): IProjectRepository {
  const list = [...seed];
  return {
    async create(data) {
      const p: Project = {
        id: crypto.randomUUID(),
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
      if (data.description !== undefined) p.description = data.description;
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

function createStubArtifactRepo(seed: Artifact[] = []): IArtifactRepository {
  const list = [...seed];
  return {
    async create(data: NewArtifact): Promise<Artifact> {
      const a: Artifact = {
        id: crypto.randomUUID(),
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
      const res: Artifact[] = [];
      const q = [folderId];
      while (q.length > 0) {
        const curr = q.shift()!;
        const children = list.filter((a) => a.parentId === curr);
        for (const c of children) {
          res.push(c);
          if (c.type === 'folder') q.push(c.id);
        }
      }
      return res;
    },
    async update(id: string, data: Partial<NewArtifact>): Promise<Artifact | null> {
      const item = list.find((a) => a.id === id);
      if (!item) return null;
      if (data.name !== undefined) item.name = data.name;
      if (data.path !== undefined) item.path = data.path;
      if (data.parentId !== undefined) item.parentId = data.parentId;
      if (data.sizeBytes !== undefined) item.sizeBytes = data.sizeBytes;
      if (data.hash !== undefined) item.hash = data.hash;
      if (data.storageKey !== undefined) item.storageKey = data.storageKey;
      return item;
    },
    async delete(id: string): Promise<boolean> {
      const idx = list.findIndex((a) => a.id === id);
      if (idx === -1) return false;
      list.splice(idx, 1);
      return true;
    },
    async deleteMany(ids: string[]): Promise<number> {
      let count = 0;
      for (const id of ids) {
        const idx = list.findIndex((a) => a.id === id);
        if (idx !== -1) {
          list.splice(idx, 1);
          count++;
        }
      }
      return count;
    },
    async getStatsByProject(projectId: string): Promise<ProjectStats> {
      const items = list.filter((a) => a.projectId === projectId);
      return {
        totalFiles: items.filter((a) => a.type === 'file').length,
        totalFolders: items.filter((a) => a.type === 'folder').length,
        totalSizeBytes: items.reduce((acc, a) => acc + Number(a.sizeBytes), 0),
      };
    },
  };
}

function createStubUserRepo(): IUserRepository {
  const users: User[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'alice@example.com',
      username: 'alice',
      displayName: 'Alice Developer',
      avatarUrl: null,
      passwordHash: 'hash',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'bob@example.com',
      username: 'bob',
      displayName: 'Bob Hacker',
      avatarUrl: null,
      passwordHash: 'hash',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return {
    async findById(id: string): Promise<User | null> {
      return users.find((u) => u.id === id) || null;
    },
    async findByEmail(email: string): Promise<User | null> {
      return users.find((u) => u.email === email) || null;
    },
    async findByUsername(username: string): Promise<User | null> {
      return users.find((u) => u.username === username) || null;
    },
    async create(data: any): Promise<User> {
      const u = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      users.push(u);
      return u;
    },
    async update(id: string, data: any): Promise<User | null> {
      const u = users.find((item) => item.id === id);
      if (!u) return null;
      Object.assign(u, data);
      return u;
    },
  };
}

function createStubStorageDriver(): IStorageDriver & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    async save(key: string, content: Buffer): Promise<SaveResult> {
      files.set(key, content);
      return { sizeBytes: content.length, hash: crypto.createHash('sha256').update(content).digest('hex') };
    },
    async getBuffer(key: string): Promise<Buffer> {
      const b = files.get(key);
      if (!b) throw new Error(`Not found: ${key}`);
      return b;
    },
    async getStream(key: string): Promise<any> {
      const b = files.get(key);
      if (!b) throw new Error(`Not found: ${key}`);
      const { Readable } = await import('node:stream');
      return Readable.from([b]);
    },
    async exists(key: string): Promise<boolean> {
      return files.has(key);
    },
    async delete(key: string): Promise<boolean> {
      return files.delete(key);
    },
  };
}

function createStubGitHubApiClient(): IGitHubApiClient {
  return {
    async exchangeOAuthCode(code: string) {
      if (code === 'invalid-code') {
        throw new Error('Bad verification code');
      }
      return { accessToken: 'gho_fake_valid_token_1234567890', scope: 'repo,read:user' };
    },
    async getAuthenticatedUser() {
      return {
        id: 99887766,
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://github.com/images/error/octocat_happy.gif',
        html_url: 'https://github.com/octocat',
        email: null,
      };
    },
    async createRepository(token: string, name: string, description?: string, isPrivate = false) {
      return {
        id: 12345678,
        name,
        full_name: `octocat/${name}`,
        owner: { id: 99887766, login: 'octocat', avatar_url: 'https://github.com/images/error/octocat_happy.gif' },
        private: isPrivate,
        html_url: `https://github.com/octocat/${name}`,
        clone_url: `https://github.com/octocat/${name}.git`,
        default_branch: 'main',
        permissions: { admin: true, push: true, pull: true },
      };
    },
    async getRepository(token: string, owner: string, repo: string) {
      return {
        id: 87654321,
        name: repo,
        full_name: `${owner}/${repo}`,
        owner: { id: 99887766, login: owner, avatar_url: 'https://github.com/images/error/octocat_happy.gif' },
        private: false,
        html_url: `https://github.com/${owner}/${repo}`,
        clone_url: `https://github.com/${owner}/${repo}.git`,
        default_branch: 'main',
        permissions: { admin: true, push: true, pull: true },
      };
    },
  };
}

// --- Test Suite ---

describe('GitHub Service (OAuth, Remote Management, and Native Git Sync)', () => {
  const testRoot = path.resolve(process.cwd(), 'scratch/test_github_service');
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';
  const projectAId = '33333333-3333-3333-3333-333333333333';
  const projectBId = '44444444-4444-4444-4444-444444444444';

  let githubRepo: IGitHubRepository;
  let projectRepo: IProjectRepository;
  let artifactRepo: IArtifactRepository;
  let userRepo: IUserRepository;
  let storage: IStorageDriver & { files: Map<string, Buffer> };
  let gitRunner: GitRunner;
  let lockManager: ProjectLockManager;
  let gitService: GitService;
  let apiClient: IGitHubApiClient;
  let service: GitHubService;

  before(async () => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testRoot, { recursive: true });
  });

  after(async () => {
    if (fs.existsSync(testRoot)) {
      try {
        fs.rmSync(testRoot, { recursive: true, force: true });
      } catch {
        // Ignored on windows locks
      }
    }
  });

  beforeEach(async () => {
    githubRepo = createStubGitHubRepo();
    projectRepo = createStubProjectRepo([
      {
        id: projectAId,
        name: 'Project Alpha',
        description: 'Test project for User A',
        ownerId: userA,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: projectBId,
        name: 'Project Beta',
        description: 'Test project for User B',
        ownerId: userB,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    artifactRepo = createStubArtifactRepo();
    userRepo = createStubUserRepo();
    storage = createStubStorageDriver();
    gitRunner = new GitRunner();
    lockManager = new ProjectLockManager();
    apiClient = createStubGitHubApiClient();

    gitService = new GitService(
      testRoot,
      gitRunner,
      lockManager,
      artifactRepo,
      projectRepo,
      userRepo,
      storage
    );

    (env as any).GITHUB_CLIENT_ID = 'test-client-id';
    (env as any).GITHUB_CLIENT_SECRET = 'test-client-secret';

    service = new GitHubService(
      githubRepo,
      projectRepo,
      artifactRepo,
      userRepo,
      storage,
      gitRunner,
      lockManager,
      apiClient,
      testRoot
    );
  });

  describe('OAuth Flow and Token Security', () => {
    it('reports not connected when user has no linked GitHub account', async () => {
      const status = await service.getOAuthStatus(userA);
      assert.strictEqual(status.isConnected, false);
      assert.strictEqual(status.account, null);
      assert.strictEqual(status.isConfigured, true);
    });

    it('generates a secure authorize URL with state and stores state in repository', async () => {
      const authRes = await service.generateAuthorizeUrl(userA, '/projects/123');
      assert.ok(authRes.authorizeUrl.includes('https://github.com/login/oauth/authorize'));
      assert.ok(authRes.authorizeUrl.includes('client_id='));
      assert.ok(authRes.authorizeUrl.includes('state='));
      assert.ok(authRes.state);

      // Verify state was persisted
      const consumed = await githubRepo.consumeOAuthState(authRes.state);
      assert.ok(consumed);
      assert.strictEqual(consumed.userId, userA);
      assert.strictEqual(consumed.returnTo, '/projects/123');
    });

    it('rejects callback with invalid or expired state token', async () => {
      await assert.rejects(
        () => service.handleOAuthCallback('any-code', 'fake-state'),
        (err: any) => err instanceof GitHubOAuthStateError
      );
    });

    it('successfully handles valid OAuth callback, encrypts token, and stores account without plaintext leakage', async () => {
      const authRes = await service.generateAuthorizeUrl(userA);
      const callbackResult = await service.handleOAuthCallback('valid-code', authRes.state);

      assert.strictEqual(callbackResult.username, 'octocat');

      // Verify stored account is encrypted
      const stored = await githubRepo.findAccountByUserId(userA);
      assert.ok(stored);
      assert.strictEqual(stored.githubUsername, 'octocat');
      assert.ok(stored.encryptedAccessToken);
      assert.ok(stored.tokenIv);
      assert.ok(stored.tokenTag);
      // Plaintext token must NEVER equal the stored ciphertext
      assert.notStrictEqual(stored.encryptedAccessToken, 'gho_fake_valid_token_1234567890');

      // Verify getOAuthStatus now returns connected, without leaking token
      const status = await service.getOAuthStatus(userA);
      assert.strictEqual(status.isConnected, true);
      assert.strictEqual(status.account?.username, 'octocat');
      assert.strictEqual((status as any).accessToken, undefined);
    });

    it('disconnects GitHub account successfully', async () => {
      const enc = encryptToken('gho_test_token_sample');
      await githubRepo.upsertAccount({
        userId: userA,
        githubUserId: '12345',
        githubUsername: 'octocat',
        encryptedAccessToken: enc.encrypted,
        tokenIv: enc.iv,
        tokenTag: enc.tag,
        scope: 'repo',
        avatarUrl: null,
      });

      const disconnectRes = await service.disconnectAccount(userA);
      assert.strictEqual(disconnectRes.success, true);

      const status = await service.getOAuthStatus(userA);
      assert.strictEqual(status.isConnected, false);
    });
  });

  describe('Project Remote Status and Linking', () => {
    beforeEach(async () => {
      // Connect GitHub account for User A
      const enc = encryptToken('gho_test_token_sample');
      await githubRepo.upsertAccount({
        userId: userA,
        githubUserId: '12345',
        githubUsername: 'octocat',
        encryptedAccessToken: enc.encrypted,
        tokenIv: enc.iv,
        tokenTag: enc.tag,
        scope: 'repo',
        avatarUrl: null,
      });

      // Initialize git repo for project A
      await gitService.initRepository(userA, projectAId);
    });

    it('enforces project ownership: prevents User B from inspecting User A project remote', async () => {
      await assert.rejects(
        () => service.getProjectRemoteStatus(userB, projectAId),
        (err: any) => err instanceof ProjectForbiddenError
      );
    });

    it('returns not linked when project has no remote configured', async () => {
      const remoteStatus = await service.getProjectRemoteStatus(userA, projectAId);
      assert.strictEqual(remoteStatus.isLinked, false);
      assert.strictEqual(remoteStatus.remote, null);
    });

    it('links an existing GitHub repository to local project', async () => {
      const linkRes = await service.linkRepository(userA, projectAId, {
        owner: 'octocat',
        repo: 'Hello-World',
      });

      assert.strictEqual(linkRes.remote.owner, 'octocat');
      assert.strictEqual(linkRes.remote.repo, 'Hello-World');
      assert.strictEqual(linkRes.remote.remoteUrl, 'https://github.com/octocat/Hello-World.git');

      // Verify remote status now reflects linked state
      const status = await service.getProjectRemoteStatus(userA, projectAId);
      assert.strictEqual(status.isLinked, true);
      assert.strictEqual(status.remote?.owner, 'octocat');
    });

    it('unlinks a linked GitHub repository and removes remote origin from local git repo', async () => {
      await service.linkRepository(userA, projectAId, {
        owner: 'octocat',
        repo: 'Hello-World',
      });

      const unlinkRes = await service.unlinkRepository(userA, projectAId);
      assert.strictEqual(unlinkRes.success, true);

      const status = await service.getProjectRemoteStatus(userA, projectAId);
      assert.strictEqual(status.isLinked, false);
    });
  });

  describe('Real Git Remote Operations (Bare Remote Simulation)', () => {
    let bareRemotePath: string;

    beforeEach(async () => {
      if (fs.existsSync(testRoot)) {
        try {
          fs.rmSync(testRoot, { recursive: true, force: true });
        } catch {}
      }
      fs.mkdirSync(testRoot, { recursive: true });

      // 1. Authenticate user A with GitHub
      const enc = encryptToken('gho_dummy_token_test');
      await githubRepo.upsertAccount({
        userId: userA,
        githubUserId: '99887766',
        githubUsername: 'octocat',
        encryptedAccessToken: enc.encrypted,
        tokenIv: enc.iv,
        tokenTag: enc.tag,
        scope: 'repo',
        avatarUrl: null,
      });

      // 2. Initialize local Versora Git repo for Project A
      await gitService.initRepository(userA, projectAId);

      // 3. Create a real bare Git repository on disk to act as the remote
      bareRemotePath = path.resolve(testRoot, `bare-remote-${crypto.randomUUID()}.git`);
      fs.mkdirSync(bareRemotePath, { recursive: true });
      try {
        await gitRunner.run(['init', '--bare', '-b', 'main'], bareRemotePath);
      } catch {
        await gitRunner.run(['init', '--bare'], bareRemotePath);
        await gitRunner.run(['symbolic-ref', 'HEAD', 'refs/heads/main'], bareRemotePath);
      }

      // 4. Configure local repo origin to point to bare remote
      const localRepoPath = path.resolve(testRoot, projectAId);
      await gitRunner.run(['remote', 'remove', 'origin'], localRepoPath, { allowNonZeroExit: true });
      await gitRunner.run(['remote', 'add', 'origin', bareRemotePath], localRepoPath);

      // 5. Store remote record in DB
      await githubRepo.upsertRemote({
        projectId: projectAId,
        githubOwner: 'octocat',
        githubRepoName: 'Project-Alpha',
        remoteUrl: 'https://github.com/octocat/Project-Alpha.git',
        isPrivate: false,
        defaultBranch: 'main',
      });
    });

    afterEach(async () => {
      if (bareRemotePath && fs.existsSync(bareRemotePath)) {
        try {
          fs.rmSync(bareRemotePath, { recursive: true, force: true });
        } catch {
          // Ignored on windows
        }
      }
    });

    it('pushes local committed changes to the remote repository', async () => {
      // Project A has initial commit from initialization.
      // Push it to remote bare repo!
      const pushRes = await service.push(userA, projectAId);
      assert.strictEqual(pushRes.branch, 'main');
      assert.ok(pushRes.commitsPushed >= 1);

      // Verify remote bare repository now contains main branch commit
      const bareLog = await gitRunner.run(['log', '--oneline', 'main'], bareRemotePath);
      assert.ok(bareLog.stdout.includes('Initialize project'));

      // Remote status should now show 0 ahead, 0 behind
      const fetchRes = await service.fetchRemote(userA, projectAId);
      assert.strictEqual(fetchRes.ahead, 0);
      assert.strictEqual(fetchRes.behind, 0);
      assert.strictEqual(fetchRes.isDiverged, false);
    });

    it('rejects push when local workspace has uncommitted edits', async () => {
      const localRepoPath = path.resolve(testRoot, projectAId);
      fs.writeFileSync(path.join(localRepoPath, 'uncommitted_change.txt'), 'draft notes');

      await assert.rejects(
        () => service.push(userA, projectAId),
        (err: any) =>
          err instanceof GitHubSyncConflictError &&
          err.message.includes('uncommitted modifications')
      );
    });

    it('safely pulls incoming commits from remote and updates working tree', async () => {
      // 1. Push initial commit to bare remote
      await service.push(userA, projectAId);

      // 2. Clone bare remote to a temporary author repo to create incoming remote commits
      const authorRepoPath = path.resolve(testRoot, `author-${crypto.randomUUID()}`);
      await gitRunner.run(['clone', bareRemotePath, authorRepoPath], testRoot);
      await gitRunner.run(['checkout', '-B', 'main'], authorRepoPath);
      await gitRunner.run(['config', 'user.name', 'Remote Collaborator'], authorRepoPath);
      await gitRunner.run(['config', 'user.email', 'collab@example.com'], authorRepoPath);

      // Create a new file in author repo and push to bare remote
      fs.writeFileSync(path.join(authorRepoPath, 'remote_guide.md'), '# Remote Documentation\n');
      await gitRunner.run(['add', '.'], authorRepoPath);
      await gitRunner.run(['commit', '-m', 'Add remote guide'], authorRepoPath);
      await gitRunner.run(['push', 'origin', 'main'], authorRepoPath);

      // 3. Local repo fetch: should show 0 ahead, 1 behind
      const fetchRes = await service.fetchRemote(userA, projectAId);
      assert.strictEqual(fetchRes.ahead, 0);
      assert.strictEqual(fetchRes.behind, 1);

      // 4. Local pull: fast-forward update
      const pullRes = await service.pull(userA, projectAId);
      assert.strictEqual(pullRes.commitsPulled, 1);

      // 5. Verify local working tree contains the new file
      const localRepoPath = path.resolve(testRoot, projectAId);
      assert.ok(fs.existsSync(path.join(localRepoPath, 'remote_guide.md')));
      assert.strictEqual(
        fs.readFileSync(path.join(localRepoPath, 'remote_guide.md'), 'utf-8'),
        '# Remote Documentation\n'
      );

      // 6. Verify subsequent pull reports already up to date
      const pullAgain = await service.pull(userA, projectAId);
      assert.strictEqual(pullAgain.commitsPulled, 0);
    });

    it('rejects pull when local working tree contains uncommitted edits', async () => {
      // Push initial commit to bare remote
      await service.push(userA, projectAId);

      // Add a dirty file to local working tree
      const localRepoPath = path.resolve(testRoot, projectAId);
      fs.writeFileSync(path.join(localRepoPath, 'dirty.txt'), 'unsaved work');

      await assert.rejects(
        () => service.pull(userA, projectAId),
        (err: any) =>
          err instanceof GitHubSyncConflictError &&
          err.message.includes('uncommitted edits')
      );
    });

    it('detects diverged branches and prevents destructive overwrites', async () => {
      // 1. Push initial commit to remote
      await service.push(userA, projectAId);

      // 2. Remote collaborator commits and pushes a commit to remote
      const authorRepoPath = path.resolve(testRoot, `author-${crypto.randomUUID()}`);
      await gitRunner.run(['clone', bareRemotePath, authorRepoPath], testRoot);
      await gitRunner.run(['checkout', '-B', 'main'], authorRepoPath);
      await gitRunner.run(['config', 'user.name', 'Remote Collab'], authorRepoPath);
      await gitRunner.run(['config', 'user.email', 'collab@example.com'], authorRepoPath);

      fs.writeFileSync(path.join(authorRepoPath, 'collab.txt'), 'remote content');
      await gitRunner.run(['add', '.'], authorRepoPath);
      await gitRunner.run(['commit', '-m', 'Remote commit'], authorRepoPath);
      await gitRunner.run(['push', 'origin', 'main'], authorRepoPath);

      // 3. Local Versora repo also commits a local change (creating divergence)
      const localRepoPath = path.resolve(testRoot, projectAId);
      fs.writeFileSync(path.join(localRepoPath, 'local.txt'), 'local content');
      await gitRunner.run(['add', '.'], localRepoPath);
      await gitRunner.run(['commit', '-m', 'Local commit'], localRepoPath);

      // 4. Fetch: should detect divergence
      const fetchRes = await service.fetchRemote(userA, projectAId);
      assert.strictEqual(fetchRes.ahead, 1);
      assert.strictEqual(fetchRes.behind, 1);
      assert.strictEqual(fetchRes.isDiverged, true);

      // 5. Pull must reject with GitHubSyncConflictError to preserve local work
      await assert.rejects(
        () => service.pull(userA, projectAId),
        (err: any) =>
          err instanceof GitHubSyncConflictError &&
          err.message.includes('has diverged')
      );

      // 6. Push must also reject non-fast-forward push to protect remote work
      await assert.rejects(
        () => service.push(userA, projectAId),
        (err: any) =>
          err instanceof GitHubSyncConflictError &&
          err.message.includes('Push rejected by GitHub')
      );
    });

    it('maps terminal prompts disabled / could not read Username error to GitHubAuthRequiredError', async () => {
      // Create an instrumented service with a failing Git runner to simulate GitHub 401 prompt rejection
      const failingGitRunner = new GitRunner();
      failingGitRunner.run = async (args: string[], cwd: string, options?: any) => {
        if (args.includes('push')) {
          return {
            stdout: '',
            stderr: "fatal: could not read Username for 'https://github.com': terminal prompts disabled\n",
            exitCode: 1,
          };
        }
        return gitRunner.run(args, cwd || path.resolve(testRoot, projectAId), options);
      };

      const testService = new GitHubService(
        githubRepo,
        projectRepo,
        artifactRepo,
        userRepo,
        storage,
        failingGitRunner,
        lockManager,
        apiClient,
        testRoot
      );

      await assert.rejects(
        () => testService.push(userA, projectAId),
        (err: any) =>
          err instanceof GitHubAuthRequiredError &&
          err.message.includes('GitHub authentication failed')
      );
    });

    it('maps 403 write permission denied error to GitHubForbiddenError', async () => {
      const failingGitRunner = new GitRunner();
      failingGitRunner.run = async (args: string[], cwd: string, options?: any) => {
        if (args.includes('push')) {
          return {
            stdout: '',
            stderr: 'remote: Permission to octocat/Project-Alpha.git denied to user.\nfatal: unable to access: 403 Forbidden\n',
            exitCode: 1,
          };
        }
        return gitRunner.run(args, cwd || path.resolve(testRoot, projectAId), options);
      };

      const testService = new GitHubService(
        githubRepo,
        projectRepo,
        artifactRepo,
        userRepo,
        storage,
        failingGitRunner,
        lockManager,
        apiClient,
        testRoot
      );

      await assert.rejects(
        () => testService.push(userA, projectAId),
        (err: any) =>
          err instanceof GitHubForbiddenError &&
          err.message.includes('Permission denied')
      );
    });
  });
});
