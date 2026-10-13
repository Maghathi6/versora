import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
import { Readable } from 'node:stream';
import {
  GitConflictError,
  GitValidationError,
  GitRepositoryNotInitializedError,
} from './git.errors';
import { ProjectForbiddenError } from '../projects/project.errors';

function createStubProjectRepo(projectsList: Project[] = []): IProjectRepository {
  const list = [...projectsList];
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

function createStubArtifactRepo(seedArtifacts: Artifact[] = []): IArtifactRepository {
  const list: Artifact[] = [...seedArtifacts];
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
      const results: Artifact[] = [];
      const queue = [folderId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const children = list.filter((a) => a.parentId === curr);
        for (const c of children) {
          results.push(c);
          if (c.type === 'folder') queue.push(c.id);
        }
      }
      return results;
    },
    async update(id: string, data: Partial<NewArtifact>): Promise<Artifact | null> {
      const item = list.find((a) => a.id === id);
      if (!item) return null;
      if (data.name !== undefined) item.name = data.name;
      if (data.path !== undefined) item.path = data.path;
      if (data.parentId !== undefined) item.parentId = data.parentId;
      if (data.sizeBytes !== undefined) item.sizeBytes = data.sizeBytes;
      if (data.hash !== undefined) item.hash = data.hash;
      if (data.mimeType !== undefined) item.mimeType = data.mimeType;
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
    async getStream(key: string): Promise<Readable> {
      const b = files.get(key);
      if (!b) throw new Error(`Not found: ${key}`);
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

describe('Git Service (Real Git Engine Tests)', () => {
  const testReposDir = path.resolve(process.cwd(), 'scratch/test_git_service_repos');
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';
  const projectAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const projectBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  let gitRunnerInst: GitRunner;
  let lockManager: ProjectLockManager;
  let artifactRepo: IArtifactRepository;
  let projRepo: IProjectRepository;
  let userRepo: IUserRepository;
  let storage: IStorageDriver & { files: Map<string, Buffer> };
  let service: GitService;

  before(async () => {
    await fs.promises.mkdir(testReposDir, { recursive: true });
  });

  after(async () => {
    try {
      await fs.promises.rm(testReposDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(async () => {
    try {
      await fs.promises.rm(testReposDir, { recursive: true, force: true });
    } catch {}
    await fs.promises.mkdir(testReposDir, { recursive: true });

    gitRunnerInst = new GitRunner();
    lockManager = new ProjectLockManager();
    projRepo = createStubProjectRepo([
      {
        id: projectAId,
        name: 'Project Alpha',
        description: 'First test project',
        ownerId: userA,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: projectBId,
        name: 'Project Beta',
        description: 'Second test project',
        ownerId: userB,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    artifactRepo = createStubArtifactRepo();
    userRepo = createStubUserRepo();
    storage = createStubStorageDriver();

    service = new GitService(
      testReposDir,
      gitRunnerInst,
      lockManager,
      artifactRepo,
      projRepo,
      userRepo,
      storage
    );
  });

  describe('Repository Initialization', () => {
    it('initializes a real Git repository with branch main and .gitignore', async () => {
      const res = await service.initRepository(userA, projectAId);

      assert.strictEqual(res.isInitialized, true);
      assert.strictEqual(res.branch, 'main');
      assert.strictEqual(service.isRepoInitialized(projectAId), true);

      const repoPath = service.getProjectRepoPath(projectAId);
      assert.ok(fs.existsSync(path.join(repoPath, '.git')));
      assert.ok(fs.existsSync(path.join(repoPath, '.gitignore')));
    });

    it('materializes existing artifacts into the working tree upon initialization', async () => {
      // Seed existing folder and file in database and storage
      const folder = await artifactRepo.create({
        projectId: projectAId,
        parentId: null,
        name: 'src',
        path: '/src',
        type: 'folder',
        artifactType: 'folder',
        mimeType: null,
        sizeBytes: 0,
        storageKey: null,
        hash: null,
      });

      const fileKey = 'projects/' + projectAId + '/main.ts';
      const fileBuffer = Buffer.from('console.log("Hello Real Git!");', 'utf-8');
      await storage.save(fileKey, fileBuffer);

      await artifactRepo.create({
        projectId: projectAId,
        parentId: folder.id,
        name: 'main.ts',
        path: '/src/main.ts',
        type: 'file',
        artifactType: 'code',
        mimeType: 'text/typescript',
        sizeBytes: fileBuffer.length,
        storageKey: fileKey,
        hash: 'hash-abc',
      });

      const initRes = await service.initRepository(userA, projectAId);
      assert.strictEqual(initRes.isInitialized, true);
      assert.ok(initRes.initialCommitHash);
      assert.ok(initRes.filesTrackedCount >= 1);

      const repoPath = service.getProjectRepoPath(projectAId);
      const targetFilePath = path.join(repoPath, 'src/main.ts');
      assert.ok(fs.existsSync(targetFilePath));
      const readContent = await fs.promises.readFile(targetFilePath, 'utf-8');
      assert.strictEqual(readContent, 'console.log("Hello Real Git!");');
    });

    it('handles repeated initialization idempotently without corrupting repository', async () => {
      const firstInit = await service.initRepository(userA, projectAId);
      const secondInit = await service.initRepository(userA, projectAId);

      assert.strictEqual(secondInit.isInitialized, true);
      assert.ok(secondInit.message.includes('already initialized'));
      assert.strictEqual(secondInit.branch, firstInit.branch);
    });

    it('rejects initialization from unauthorized user with ProjectForbiddenError', async () => {
      await assert.rejects(
        () => service.initRepository(userB, projectAId),
        (err: unknown) => err instanceof ProjectForbiddenError
      );
    });
  });

  describe('Git Status and Diffs', () => {
    beforeEach(async () => {
      await service.initRepository(userA, projectAId);
    });

    it('reports clean status on initial commit', async () => {
      const status = await service.getStatus(userA, projectAId);
      assert.strictEqual(status.isInitialized, true);
      assert.strictEqual(status.currentBranch, 'main');
      assert.strictEqual(status.totalChangesCount, 0);
    });

    it('detects untracked, modified, and deleted files with real Git porcelain output', async () => {
      const repoPath = service.getProjectRepoPath(projectAId);

      // Create new untracked file
      await fs.promises.writeFile(path.join(repoPath, 'untracked.txt'), 'new file');

      let status = await service.getStatus(userA, projectAId);
      assert.strictEqual(status.untracked.length, 1);
      assert.strictEqual(status.untracked[0].path, 'untracked.txt');
      assert.strictEqual(status.untracked[0].status, 'untracked');

      // Commit file
      await service.commit(userA, projectAId, { message: 'Add untracked.txt' });

      // Modify committed file
      await fs.promises.writeFile(path.join(repoPath, 'untracked.txt'), 'modified content');

      status = await service.getStatus(userA, projectAId);
      assert.strictEqual(status.unstaged.length, 1);
      assert.strictEqual(status.unstaged[0].path, 'untracked.txt');
      assert.strictEqual(status.unstaged[0].status, 'modified');

      // Delete file
      await fs.promises.unlink(path.join(repoPath, 'untracked.txt'));

      status = await service.getStatus(userA, projectAId);
      assert.strictEqual(status.unstaged.length, 1);
      assert.strictEqual(status.unstaged[0].path, 'untracked.txt');
      assert.strictEqual(status.unstaged[0].status, 'deleted');
    });

    it('computes textual diffs with line additions and deletions', async () => {
      const repoPath = service.getProjectRepoPath(projectAId);
      await fs.promises.writeFile(path.join(repoPath, 'code.js'), 'const a = 1;\nconst b = 2;\n');
      await service.commit(userA, projectAId, { message: 'Add code.js' });

      // Modify code.js
      await fs.promises.writeFile(path.join(repoPath, 'code.js'), 'const a = 1;\nconst b = 99;\nconst c = 3;\n');

      const diffRes = await service.getDiff(userA, projectAId, { file: 'code.js' });
      assert.ok(diffRes.files.length >= 1);
      const fileDiff = diffRes.files[0];
      assert.strictEqual(fileDiff.path, 'code.js');
      assert.strictEqual(fileDiff.isBinary, false);
      assert.ok(fileDiff.diff.includes('-const b = 2;'));
      assert.ok(fileDiff.diff.includes('+const b = 99;'));
      assert.ok(fileDiff.diff.includes('+const c = 3;'));
    });

    it('detects binary files and does not output raw binary diff text', async () => {
      const repoPath = service.getProjectRepoPath(projectAId);
      // Binary content with null bytes
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      await fs.promises.writeFile(path.join(repoPath, 'blob.bin'), binaryContent);

      const diffRes = await service.getDiff(userA, projectAId, { file: 'blob.bin' });
      assert.strictEqual(diffRes.files.length, 1);
      assert.strictEqual(diffRes.files[0].isBinary, true);
      assert.ok(diffRes.files[0].diff.includes('Binary file differences cannot be displayed'));
    });
  });

  describe('Commits and History', () => {
    beforeEach(async () => {
      await service.initRepository(userA, projectAId);
    });

    it('creates real Git commits and updates history', async () => {
      const repoPath = service.getProjectRepoPath(projectAId);
      await fs.promises.writeFile(path.join(repoPath, 'feature.txt'), 'feature payload');

      const commitResult = await service.commit(userA, projectAId, {
        message: 'Implement feature payload',
      });

      assert.ok(commitResult.hash.length >= 40);
      assert.ok(commitResult.shortHash.length >= 7);
      assert.strictEqual(commitResult.message, 'Implement feature payload');
      assert.strictEqual(commitResult.author.name, 'Alice Developer');

      const history = await service.getHistory(userA, projectAId);
      assert.ok(history.length >= 2); // Initial commit + feature commit
      assert.strictEqual(history[0].hash, commitResult.hash);
      assert.strictEqual(history[0].message, 'Implement feature payload');

      const detail = await service.getCommit(userA, projectAId, commitResult.hash);
      assert.strictEqual(detail.commit.hash, commitResult.hash);
      assert.ok(detail.files.some((f) => f.path === 'feature.txt'));
    });

    it('rejects commit when there are no changes with validation error', async () => {
      await assert.rejects(
        () => service.commit(userA, projectAId, { message: 'Empty commit' }),
        (err: unknown) => err instanceof GitValidationError
      );
    });

    it('rejects empty commit message', async () => {
      await assert.rejects(
        () => service.commit(userA, projectAId, { message: '   ' }),
        (err: unknown) => err instanceof GitValidationError
      );
    });
  });

  describe('Branch Management and Switching', () => {
    beforeEach(async () => {
      await service.initRepository(userA, projectAId);
      const repoPath = service.getProjectRepoPath(projectAId);
      await fs.promises.writeFile(path.join(repoPath, 'app.ts'), 'export const v = 1;');
      await service.commit(userA, projectAId, { message: 'Baseline app' });
    });

    it('creates and lists local branches', async () => {
      const branchRes = await service.createBranch(userA, projectAId, { name: 'feature/login' });
      assert.strictEqual(branchRes.name, 'feature/login');
      assert.strictEqual(branchRes.isCurrent, false);

      const branches = await service.listBranches(userA, projectAId);
      assert.ok(branches.some((b) => b.name === 'main' && b.isCurrent));
      assert.ok(branches.some((b) => b.name === 'feature/login' && !b.isCurrent));
    });

    it('rejects invalid or unsafe branch names', async () => {
      const invalidNames = ['feature..bad', 'bad/branch/', '-bad', 'bad:ref', 'bad@{name}'];
      for (const name of invalidNames) {
        await assert.rejects(
          () => service.createBranch(userA, projectAId, { name }),
          (err: unknown) => err instanceof GitValidationError
        );
      }
    });

    it('rejects duplicate branch name with GitConflictError', async () => {
      await service.createBranch(userA, projectAId, { name: 'dup-branch' });
      await assert.rejects(
        () => service.createBranch(userA, projectAId, { name: 'dup-branch' }),
        (err: unknown) => err instanceof GitConflictError
      );
    });

    it('prevents branch switching when working tree has uncommitted changes', async () => {
      await service.createBranch(userA, projectAId, { name: 'dev' });
      const repoPath = service.getProjectRepoPath(projectAId);

      // Dirty the working tree
      await fs.promises.writeFile(path.join(repoPath, 'app.ts'), 'unsaved changes');

      await assert.rejects(
        () => service.switchBranch(userA, projectAId, { branch: 'dev' }),
        (err: unknown) => err instanceof GitConflictError
      );
    });

    it('switches branches cleanly and reconciles working tree with artifacts', async () => {
      await service.createBranch(userA, projectAId, { name: 'v2' });
      await service.switchBranch(userA, projectAId, { branch: 'v2' });

      let branches = await service.listBranches(userA, projectAId);
      assert.ok(branches.find((b) => b.name === 'v2')?.isCurrent);

      // Create new file on v2 branch and commit
      const repoPath = service.getProjectRepoPath(projectAId);
      await fs.promises.writeFile(path.join(repoPath, 'v2-only.txt'), 'version 2 file');
      await service.commit(userA, projectAId, { message: 'Add v2-only.txt' });

      // Reconcile has added v2-only.txt
      await service.switchBranch(userA, projectAId, { branch: 'main' });
      let artifactsOnMain = await artifactRepo.findAllByProjectId(projectAId);
      assert.strictEqual(artifactsOnMain.some((a) => a.name === 'v2-only.txt'), false);

      // Switch back to v2
      await service.switchBranch(userA, projectAId, { branch: 'v2' });
      let artifactsOnV2 = await artifactRepo.findAllByProjectId(projectAId);
      assert.strictEqual(artifactsOnV2.some((a) => a.name === 'v2-only.txt'), true);
    });
  });

  describe('Restore and Safety Mechanism', () => {
    let commit1Hash: string;
    let commit2Hash: string;

    beforeEach(async () => {
      await service.initRepository(userA, projectAId);
      const repoPath = service.getProjectRepoPath(projectAId);

      await fs.promises.writeFile(path.join(repoPath, 'doc.txt'), 'version 1');
      const c1 = await service.commit(userA, projectAId, { message: 'Doc v1' });
      commit1Hash = c1.hash;

      await fs.promises.writeFile(path.join(repoPath, 'doc.txt'), 'version 2');
      const c2 = await service.commit(userA, projectAId, { message: 'Doc v2' });
      commit2Hash = c2.hash;
    });

    it('previews restore changes accurately before execution', async () => {
      const preview = await service.previewRestore(userA, projectAId, {
        commitHash: commit1Hash,
        filePath: 'doc.txt',
      });

      assert.strictEqual(preview.commitHash, commit1Hash);
      assert.strictEqual(preview.filesToChange.length, 1);
      assert.strictEqual(preview.filesToChange[0].path, 'doc.txt');
      assert.strictEqual(preview.hasUncommittedChanges, false);
    });

    it('restores a specific file safely and creates a backup reference', async () => {
      const restoreRes = await service.restore(userA, projectAId, {
        commitHash: commit1Hash,
        filePath: 'doc.txt',
        mode: 'file',
      });

      assert.ok(restoreRes.backupRef);
      assert.strictEqual(restoreRes.restoredFiles[0], 'doc.txt');

      const repoPath = service.getProjectRepoPath(projectAId);
      const content = await fs.promises.readFile(path.join(repoPath, 'doc.txt'), 'utf-8');
      assert.strictEqual(content, 'version 1');
    });

    it('prevents restore if there are uncommitted changes in the workspace', async () => {
      const repoPath = service.getProjectRepoPath(projectAId);
      await fs.promises.writeFile(path.join(repoPath, 'dirty.txt'), 'dirty');

      await assert.rejects(
        () => service.restore(userA, projectAId, { commitHash: commit1Hash, mode: 'project' }),
        (err: unknown) => err instanceof GitConflictError
      );
    });
  });

  describe('Concurrency Locks and Path Traversal Protection', () => {
    it('serializes concurrent Git operations on the same project using ProjectLockManager', async () => {
      const executionOrder: number[] = [];

      const p1 = lockManager.withLock(projectAId, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push(1);
      });

      const p2 = lockManager.withLock(projectAId, async () => {
        executionOrder.push(2);
      });

      await Promise.all([p1, p2]);
      assert.deepStrictEqual(executionOrder, [1, 2]);
    });

    it('prevents path traversal attempts in project IDs', () => {
      assert.throws(
        () => service.getProjectRepoPath('../../../etc/passwd'),
        (err: unknown) => err instanceof GitValidationError
      );
    });
  });
});
