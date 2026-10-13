import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import { createArtifactRouter } from './artifact.routes';
import { ArtifactService } from './artifact.service';
import { IArtifactRepository, ProjectStats } from './artifact.repository';
import { IProjectRepository } from '../projects/project.repository';
import { IStorageDriver, SaveResult } from '../../storage/storage.interface';
import { Artifact, NewArtifact } from './artifact.types';
import { Project } from '../projects/project.types';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { TokenService } from '../auth/token.service';
import { IUserRepository } from '../users/user.repository';
import { User } from '../users/user.types';
import { Readable } from 'node:stream';
import * as XLSX from 'xlsx';

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
        id: `00000000-0000-0000-0000-${String(list.length + 1).padStart(12, '0')}`,
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
      return list
        .filter((a) => a.projectId === projectId && a.parentId === parentId)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    },
    async findByProjectAndName(projectId: string, parentId: string | null, name: string): Promise<Artifact | null> {
      return (
        list.find(
          (a) =>
            a.projectId === projectId &&
            a.parentId === parentId &&
            a.name.toLowerCase() === name.toLowerCase()
        ) || null
      );
    },
    async findAllByProjectId(projectId: string): Promise<Artifact[]> {
      return list.filter((a) => a.projectId === projectId);
    },
    async findDescendants(folderId: string): Promise<Artifact[]> {
      const results: Artifact[] = [];
      const queue = [folderId];
      while (queue.length > 0) {
        const currId = queue.shift()!;
        const children = list.filter((a) => a.parentId === currId);
        for (const child of children) {
          results.push(child);
          if (child.type === 'folder') {
            queue.push(child.id);
          }
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
      if (data.artifactType !== undefined) item.artifactType = data.artifactType;
      if (data.sizeBytes !== undefined) item.sizeBytes = data.sizeBytes;
      if (data.hash !== undefined) item.hash = data.hash;
      item.updatedAt = new Date();
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
      let totalFiles = 0;
      let totalFolders = 0;
      let totalSizeBytes = 0;
      for (const item of items) {
        if (item.type === 'folder') {
          totalFolders++;
        } else {
          totalFiles++;
          totalSizeBytes += Number(item.sizeBytes);
        }
      }
      return { totalFiles, totalFolders, totalSizeBytes };
    },
  };
}

function createStubStorageDriver(): IStorageDriver & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    async save(key: string, content: Buffer): Promise<SaveResult> {
      files.set(key, content);
      return { sizeBytes: content.length, hash: 'test-hash' };
    },
    async getBuffer(key: string): Promise<Buffer> {
      const buf = files.get(key);
      if (!buf) throw new Error('Not found');
      return buf;
    },
    async getStream(key: string): Promise<Readable> {
      const buf = files.get(key);
      if (!buf) throw new Error('Not found');
      return Readable.from([buf]);
    },
    async exists(key: string): Promise<boolean> {
      return files.has(key);
    },
    async delete(key: string): Promise<boolean> {
      return files.delete(key);
    },
  };
}

describe('HTTP Artifact Endpoints (/api/v1/projects/:projectId/artifacts)', () => {
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
        passwordHash: 'h',
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
        passwordHash: 'h',
        avatarUrl: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const stubUserRepo: IUserRepository = {
      async findById(id) {
        return stubUsers.find((u) => u.id === id) || null;
      },
      async findByEmail(email) {
        return stubUsers.find((u) => u.email === email) || null;
      },
      async findByUsername(username) {
        return stubUsers.find((u) => u.username === username) || null;
      },
      async create(d) {
        const u: User = { id: 'x', ...d, avatarUrl: null, bio: null, createdAt: new Date(), updatedAt: new Date() };
        stubUsers.push(u);
        return u;
      },
      async update(id, d) {
        const u = stubUsers.find((user) => user.id === id);
        if (!u) return null;
        if (d.displayName) u.displayName = d.displayName;
        return u;
      },
    };

    const stubProjects: Project[] = [
      {
        id: projectAId,
        name: 'Project Alpha',
        description: null,
        ownerId: userAId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: projectBId,
        name: 'Project Beta',
        description: null,
        ownerId: userBId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const projRepo = createStubProjectRepo(stubProjects);
    const artifactRepo = createStubArtifactRepo();
    const storage = createStubStorageDriver();
    const artService = new ArtifactService(artifactRepo, projRepo, storage);

    const authMiddleware = createAuthMiddleware({
      userRepo: stubUserRepo,
      tokenSvc: tokenService,
    });

    const artifactRouter = createArtifactRouter(artService, authMiddleware);

    const app: Application = express();
    app.use(express.json());

    const rootRouter = Router();
    const v1Router = Router();
    v1Router.use('/projects', artifactRouter);
    rootRouter.use('/v1', v1Router);
    rootRouter.use('/projects', artifactRouter);

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
    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`);
      const data = (await res.json()) as any;
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error.code, 'UNAUTHORIZED');
    });

    it('rejects access to another user\'s project artifacts with 403 FORBIDDEN', async () => {
      // User B attempts to list artifacts of User A's project
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      const data = (await res.json()) as any;
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
    });
  });

  describe('Folder Operations', () => {
    let createdFolderId: string;

    it('creates a root folder with 201 Created', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/folders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'experiments' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.name, 'experiments');
      assert.strictEqual(data.data.type, 'folder');
      assert.strictEqual(data.data.path, '/experiments');
      createdFolderId = data.data.id;
    });

    it('rejects duplicate folder creation with 409 CONFLICT', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/folders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'experiments' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.error.code, 'CONFLICT');
    });

    it('creates a nested folder inside an existing folder', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/folders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'trial-1', parentId: createdFolderId }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.data.name, 'trial-1');
      assert.strictEqual(data.data.path, '/experiments/trial-1');
      assert.strictEqual(data.data.parentId, createdFolderId);
    });
  });

  describe('Create Artifact Endpoint (POST /api/v1/projects/:projectId/artifacts)', () => {
    let folderId: string;

    before(async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/folders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'code' }),
      });
      const data = (await res.json()) as any;
      folderId = data.data.id;
    });

    it('creates a new file artifact with 201 Created and empty content', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'server.ts' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.data.name, 'server.ts');
      assert.strictEqual(data.data.path, '/server.ts');
      assert.strictEqual(data.data.type, 'file');
      assert.strictEqual(data.data.capability, 'editable');
      assert.strictEqual(data.data.sizeBytes, 0);
    });

    it('creates a new file artifact inside a nested folder with correct relative path', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'handler.ts', parentId: folderId }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.data.name, 'handler.ts');
      assert.strictEqual(data.data.path, '/code/handler.ts');
      assert.strictEqual(data.data.parentId, folderId);
    });

    it('creates a new file artifact with initial content', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'config.json',
          content: '{"port": 8080}',
        }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.data.name, 'config.json');
      assert.strictEqual(data.data.sizeBytes, 14);
    });

    it('rejects duplicate file name in same folder with 409 CONFLICT', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'server.ts' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.error.code, 'CONFLICT');
    });

    it('rejects empty file name with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '   ' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error.code, 'VALIDATION_ERROR');
    });

    it('rejects illegal file name with path traversal with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '../evil.ts' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error.code, 'VALIDATION_ERROR');
    });

    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test.ts' }),
      });
      assert.strictEqual(res.status, 401);
    });

    it('rejects creation on another user project with 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenB}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'hack.ts' }),
      });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('File Upload & Listing', () => {
    let uploadedFileId: string;

    it('uploads a file using multipart/form-data and receives 201 Created', async () => {
      const boundary = '---------------------------VersoraTestBoundary';
      const fileContent = 'const x = 42;\nconsole.log(x);';

      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="main.ts"',
        'Content-Type: application/typescript',
        '',
        fileContent,
        `--${boundary}--`,
        '',
      ].join('\r\n');

      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.name, 'main.ts');
      assert.strictEqual(data.data.type, 'file');
      assert.strictEqual(data.data.artifactType, 'code');
      uploadedFileId = data.data.id;
    });

    it('lists artifacts in project with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
      assert.ok(data.data.some((item: any) => item.name === 'main.ts'));
    });

    it('downloads file stream with correct headers', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${uploadedFileId}/download`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-disposition')?.includes('attachment'));
      const text = await res.text();
      assert.strictEqual(text, 'const x = 42;\nconsole.log(x);');
    });

    it('renames file with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${uploadedFileId}/rename`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'index.ts' }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.name, 'index.ts');
    });

    it('deletes file with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${uploadedFileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
    });
  });

  describe('In-Browser Code Editor Endpoints (/api/v1/projects/:projectId/artifacts/:artifactId/content)', () => {
    let editorFileId: string;
    const initialContent = 'export function add(a: number, b: number) { return a + b; }';

    before(async () => {
      // Create a code file to edit
      const boundary = '----TestBoundary' + Math.random().toString(36).substring(2);
      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="calc.ts"\r\nContent-Type: text/typescript\r\n\r\n${initialContent}\r\n`,
        `--${boundary}--\r\n`,
      ];
      const body = Buffer.concat(parts.map((p) => Buffer.from(p, 'utf-8')));

      const uploadRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      const uploadData = (await uploadRes.json()) as any;
      editorFileId = uploadData.data.id;
    });

    it('reads text content and language with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${editorFileId}/content`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.content, initialContent);
      assert.strictEqual(data.data.language, 'typescript');
      assert.strictEqual(data.data.isBinary, false);
      assert.strictEqual(data.data.artifact.name, 'calc.ts');
    });

    it('rejects reading content without auth with 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${editorFileId}/content`);
      assert.strictEqual(res.status, 401);
    });

    it('rejects reading content of another user project with 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${editorFileId}/content`, {
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('returns 404 NOT_FOUND for non-existent artifact', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/00000000-0000-0000-0000-999999999999/content`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      assert.strictEqual(res.status, 404);
    });

    it('saves modified content with 200 OK and updates size and hash', async () => {
      const updatedCode = 'export function add(a: number, b: number) {\n  // Improved with logging\n  console.log({ a, b });\n  return a + b;\n}';
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${editorFileId}/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: updatedCode }),
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.sizeBytes, Buffer.byteLength(updatedCode));

      // Verify that reading the content now returns the modified text
      const readRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${editorFileId}/content`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const readData = (await readRes.json()) as any;
      assert.strictEqual(readData.data.content, updatedCode);
    });

    it('rejects updating content without auth with 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${editorFileId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      });
      assert.strictEqual(res.status, 401);
    });

    it('rejects updating content of another user project with 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${editorFileId}/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validTokenB}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'malicious change' }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('rejects invalid payload (missing content) with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${editorFileId}/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
    });
  });

  describe('Artifact Visual Preview and Capabilities', () => {
    let svgFileId: string;
    let codeFileId: string;

    before(async () => {
      const boundary = '----WebKitFormBoundaryPreviewTest';
      const fileContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
      const parts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="vector.svg"\r\n`,
        `Content-Type: image/svg+xml\r\n\r\n`,
        fileContent,
        `\r\n--${boundary}--\r\n`,
      ];
      const body = Buffer.concat(parts.map((p) => Buffer.from(p, 'utf-8')));

      const uploadRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      const uploadData = (await uploadRes.json()) as any;
      svgFileId = uploadData.data.id;

      const tsParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="app.ts"\r\n`,
        `Content-Type: text/typescript\r\n\r\n`,
        'export const x = 1;',
        `\r\n--${boundary}--\r\n`,
      ];
      const tsBody = Buffer.concat(tsParts.map((p) => Buffer.from(p, 'utf-8')));
      const tsRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: tsBody,
      });
      const tsData = (await tsRes.json()) as any;
      codeFileId = tsData.data.id;
    });

    it('streams preview with inline disposition, nosniff, and SVG CSP sandboxing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${svgFileId}/preview`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'image/svg+xml');
      assert.ok(res.headers.get('content-disposition')?.includes('inline'));
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(res.headers.get('content-security-policy')?.includes("sandbox"));
    });

    it('rejects previewing artifact without auth with 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${svgFileId}/preview`);
      assert.strictEqual(res.status, 401);
    });

    it('rejects previewing artifact of another user project with 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${svgFileId}/preview`, {
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('includes accurate capability field in artifact listing responses', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      const svgItem = data.data.find((a: any) => a.id === svgFileId);
      assert.ok(svgItem);
      assert.strictEqual(svgItem.capability, 'previewable');

      const tsItem = data.data.find((a: any) => a.id === codeFileId);
      assert.ok(tsItem);
      assert.strictEqual(tsItem.capability, 'editable');
    });
  });

  describe('Project Workspace Overview', () => {
    it('returns workspace overview and artifact statistics with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/overview`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      const data = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.project.id, projectAId);
      assert.ok(typeof data.data.stats.totalFolders === 'number');
      assert.ok(typeof data.data.stats.totalFiles === 'number');
      assert.ok(typeof data.data.stats.totalSizeBytes === 'number');
    });
  });

  describe('Rich Artifact Preview HTTP Endpoints (Batch A3)', () => {
    let csvFileId: string;
    let xlsxFileId: string;
    let zipFileId: string;

    before(async () => {
      const boundary = '----WebKitFormBoundaryRichPreviewTest';
      // 1. Upload CSV
      const csvContent = 'sku,name,price,in_stock\nA1,Widget,19.99,true\nA2,Gadget,29.99,false\n';
      const csvParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="inventory.csv"\r\n`,
        `Content-Type: text/csv\r\n\r\n`,
        csvContent,
        `\r\n--${boundary}--\r\n`,
      ];
      const csvRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.concat(csvParts.map((p) => Buffer.from(p, 'utf-8'))),
      });
      const csvData = (await csvRes.json()) as any;
      csvFileId = csvData.data.id;

      // 2. Upload XLSX
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Month', 'Revenue', 'Cost'],
        ['January', 12000, 8000],
        ['February', 15000, 9500],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Financials');
      const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const xlsxParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="report.xlsx"\r\n`,
        `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
      ];
      const xlsxBody = Buffer.concat([
        Buffer.from(xlsxParts[0] + xlsxParts[1] + xlsxParts[2], 'utf-8'),
        xlsxBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
      ]);
      const xlsxRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: xlsxBody,
      });
      const xlsxData = (await xlsxRes.json()) as any;
      xlsxFileId = xlsxData.data.id;

      // 3. Upload ZIP (unsupported)
      const zipParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="file"; filename="archive.zip"\r\n`,
        `Content-Type: application/zip\r\n\r\n`,
        'PK\x03\x04mockzipcontent',
        `\r\n--${boundary}--\r\n`,
      ];
      const zipRes = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.concat(zipParts.map((p) => Buffer.from(p, 'utf-8'))),
      });
      const zipData = (await zipRes.json()) as any;
      zipFileId = zipData.data.id;
    });

    it('returns structured preview data for CSV file via GET /preview-data', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${csvFileId}/preview-data`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      assert.strictEqual(res.status, 200);
      const body = (await res.json()) as any;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.preview.kind, 'csv');
      assert.deepStrictEqual(body.data.preview.headers, ['sku', 'name', 'price', 'in_stock']);
      assert.strictEqual(body.data.preview.rows.length, 2);
    });

    it('returns structured preview data for XLSX workbook via GET /preview-data', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${xlsxFileId}/preview-data`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      assert.strictEqual(res.status, 200);
      const body = (await res.json()) as any;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.preview.kind, 'xlsx');
      assert.deepStrictEqual(body.data.preview.sheetNames, ['Financials']);
      assert.ok(body.data.preview.sheets['Financials']);
      assert.strictEqual(body.data.preview.sheets['Financials'].rows.length, 3);
    });

    it('returns unsupported details for download-only ZIP file via GET /preview-data', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${zipFileId}/preview-data`, {
        headers: { Authorization: `Bearer ${validTokenA}` },
      });
      assert.strictEqual(res.status, 200);
      const body = (await res.json()) as any;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.preview.kind, 'unsupported');
      assert.ok(body.data.preview.formatName.includes('Archive'));
    });

    it('supports content negotiation via GET /preview with Accept: application/json', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${csvFileId}/preview`, {
        headers: {
          Authorization: `Bearer ${validTokenA}`,
          Accept: 'application/json',
        },
      });
      assert.strictEqual(res.status, 200);
      const body = (await res.json()) as any;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.preview.kind, 'csv');
    });

    it('rejects unauthenticated request to /preview-data with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${csvFileId}/preview-data`);
      assert.strictEqual(res.status, 401);
    });

    it('rejects cross-user access to /preview-data with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/artifacts/${csvFileId}/preview-data`, {
        headers: { Authorization: `Bearer ${validTokenB}` },
      });
      assert.strictEqual(res.status, 403);
    });
  });
});
