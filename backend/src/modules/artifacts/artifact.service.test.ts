import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { ArtifactService } from './artifact.service';
import { IArtifactRepository, ProjectStats } from './artifact.repository';
import { IProjectRepository } from '../projects/project.repository';
import { IStorageDriver, SaveResult } from '../../storage/storage.interface';
import { Artifact, NewArtifact } from './artifact.types';
import { Project } from '../projects/project.types';
import {
  ArtifactValidationError,
  ArtifactNotFoundError,
  DuplicateArtifactNameError,
  InvalidArtifactOperationError,
} from './artifact.errors';
import { ProjectForbiddenError, ProjectNotFoundError } from '../projects/project.errors';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { sanitizeHtml, generateArtifactPreview, MAX_PREVIEW_DOCUMENT_SIZE } from './artifact.preview';

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
      return { sizeBytes: content.length, hash: 'dummy-hash' };
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

describe('Artifact Service (ArtifactService)', () => {
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';
  const projectAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let stubProjRepo: IProjectRepository;
  let stubArtifactRepo: IArtifactRepository;
  let stubStorage: ReturnType<typeof createStubStorageDriver>;
  let service: ArtifactService;

  beforeEach(() => {
    stubProjRepo = createStubProjectRepo([
      {
        id: projectAId,
        name: 'Genome Research',
        description: 'Bioinformatics workspace',
        ownerId: userA,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    stubArtifactRepo = createStubArtifactRepo();
    stubStorage = createStubStorageDriver();
    service = new ArtifactService(stubArtifactRepo, stubProjRepo, stubStorage);
  });

  describe('createFolder', () => {
    it('creates a root folder successfully', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'src' });
      assert.strictEqual(folder.name, 'src');
      assert.strictEqual(folder.path, '/src');
      assert.strictEqual(folder.type, 'folder');
      assert.strictEqual(folder.parentId, null);
    });

    it('creates a nested subfolder within an existing folder', async () => {
      const rootFolder = await service.createFolder(userA, projectAId, { name: 'docs' });
      const subFolder = await service.createFolder(userA, projectAId, {
        name: 'api',
        parentId: rootFolder.id,
      });

      assert.strictEqual(subFolder.name, 'api');
      assert.strictEqual(subFolder.path, '/docs/api');
      assert.strictEqual(subFolder.parentId, rootFolder.id);
    });

    it('rejects duplicate folder name in the same parent directory with Conflict error (409)', async () => {
      await service.createFolder(userA, projectAId, { name: 'datasets' });

      await assert.rejects(
        async () => {
          await service.createFolder(userA, projectAId, { name: 'datasets' });
        },
        (err: unknown) => {
          assert.ok(err instanceof DuplicateArtifactNameError);
          assert.strictEqual(err.status, 409);
          return true;
        }
      );
    });

    it('allows identical folder names in different subdirectories', async () => {
      const dirA = await service.createFolder(userA, projectAId, { name: 'frontend' });
      const dirB = await service.createFolder(userA, projectAId, { name: 'backend' });

      const subA = await service.createFolder(userA, projectAId, { name: 'utils', parentId: dirA.id });
      const subB = await service.createFolder(userA, projectAId, { name: 'utils', parentId: dirB.id });

      assert.strictEqual(subA.name, 'utils');
      assert.strictEqual(subB.name, 'utils');
      assert.strictEqual(subA.path, '/frontend/utils');
      assert.strictEqual(subB.path, '/backend/utils');
    });

    it('rejects folder creation when user does not own project with 403 Forbidden', async () => {
      await assert.rejects(
        async () => {
          await service.createFolder(userB, projectAId, { name: 'unauthorized' });
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectForbiddenError);
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });

    it('rejects folder creation when parent folder is missing with 404', async () => {
      await assert.rejects(
        async () => {
          await service.createFolder(userA, projectAId, {
            name: 'child',
            parentId: '00000000-0000-0000-0000-000000000000',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ArtifactNotFoundError);
          assert.strictEqual(err.status, 404);
          return true;
        }
      );
    });

    it('rejects illegal folder name containing path separators or traversal characters (400)', async () => {
      const illegalNames = ['../evil', 'folder/nested', 'test\\dir', 'foo:bar', ''];
      for (const name of illegalNames) {
        await assert.rejects(
          async () => {
            await service.createFolder(userA, projectAId, { name });
          },
          (err: unknown) => {
            assert.ok(err instanceof ArtifactValidationError);
            return true;
          }
        );
      }
    });
  });

  describe('createArtifact', () => {
    it('creates a root file artifact successfully with empty initial content', async () => {
      const file = await service.createArtifact(userA, projectAId, { name: 'index.ts' });
      assert.strictEqual(file.name, 'index.ts');
      assert.strictEqual(file.path, '/index.ts');
      assert.strictEqual(file.type, 'file');
      assert.strictEqual(file.artifactType, 'code');
      assert.strictEqual(file.parentId, null);
      assert.strictEqual(file.sizeBytes, 0);

      // Verify empty content in storage
      const dbArtifact = await stubArtifactRepo.findById(file.id);
      const stored = await stubStorage.getBuffer(dbArtifact!.storageKey!);
      assert.strictEqual(stored.toString('utf-8'), '');
    });

    it('creates a nested file artifact within an existing folder with correct relative path', async () => {
      const rootFolder = await service.createFolder(userA, projectAId, { name: 'src' });
      const file = await service.createArtifact(userA, projectAId, {
        name: 'app.tsx',
        parentId: rootFolder.id,
      });

      assert.strictEqual(file.name, 'app.tsx');
      assert.strictEqual(file.path, '/src/app.tsx');
      assert.strictEqual(file.parentId, rootFolder.id);
      assert.strictEqual(file.type, 'file');
      assert.strictEqual(file.capability, 'editable');
    });

    it('creates a file artifact with initial content and calculates accurate size', async () => {
      const file = await service.createArtifact(userA, projectAId, {
        name: 'notes.md',
        content: '# Research Notes\nBatch D foundations.',
      });

      assert.strictEqual(file.name, 'notes.md');
      assert.strictEqual(file.path, '/notes.md');
      assert.strictEqual(file.artifactType, 'document');
      assert.strictEqual(file.sizeBytes, Buffer.byteLength('# Research Notes\nBatch D foundations.', 'utf-8'));
    });

    it('rejects duplicate file name in the same directory with Conflict error (409)', async () => {
      await service.createArtifact(userA, projectAId, { name: 'main.py' });

      await assert.rejects(
        async () => {
          await service.createArtifact(userA, projectAId, { name: 'main.py' });
        },
        (err: unknown) => {
          assert.ok(err instanceof DuplicateArtifactNameError);
          assert.strictEqual(err.status, 409);
          return true;
        }
      );
    });

    it('allows identical file names in different subdirectories', async () => {
      const dirA = await service.createFolder(userA, projectAId, { name: 'client' });
      const dirB = await service.createFolder(userA, projectAId, { name: 'server' });

      const fileA = await service.createArtifact(userA, projectAId, { name: 'package.json', parentId: dirA.id });
      const fileB = await service.createArtifact(userA, projectAId, { name: 'package.json', parentId: dirB.id });

      assert.strictEqual(fileA.name, 'package.json');
      assert.strictEqual(fileB.name, 'package.json');
      assert.strictEqual(fileA.path, '/client/package.json');
      assert.strictEqual(fileB.path, '/server/package.json');
    });

    it('rejects file creation when user does not own project with 403 Forbidden', async () => {
      await assert.rejects(
        async () => {
          await service.createArtifact(userB, projectAId, { name: 'unauthorized.ts' });
        },
        (err: unknown) => {
          assert.ok(err instanceof ProjectForbiddenError);
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });

    it('rejects file creation when parent folder is missing with 404 Not Found', async () => {
      await assert.rejects(
        async () => {
          await service.createArtifact(userA, projectAId, {
            name: 'child.ts',
            parentId: '00000000-0000-0000-0000-000000000000',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ArtifactNotFoundError);
          assert.strictEqual(err.status, 404);
          return true;
        }
      );
    });

    it('rejects file creation when target parent is a file not a folder with 400', async () => {
      const parentFile = await service.createArtifact(userA, projectAId, { name: 'config.json' });

      await assert.rejects(
        async () => {
          await service.createArtifact(userA, projectAId, {
            name: 'subfile.ts',
            parentId: parentFile.id,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof InvalidArtifactOperationError);
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    it('rejects illegal file name containing path separators or traversal characters (400)', async () => {
      const illegalNames = ['../hack.ts', 'src/nested.ts', 'win\\path.ts', 'colon:file.ts', ''];
      for (const name of illegalNames) {
        await assert.rejects(
          async () => {
            await service.createArtifact(userA, projectAId, { name });
          },
          (err: unknown) => {
            assert.ok(err instanceof ArtifactValidationError);
            return true;
          }
        );
      }
    });
  });

  describe('uploadFile', () => {
    it('uploads a file to project root and accurately classifies artifact type', async () => {
      const file = {
        originalname: 'pipeline.py',
        buffer: Buffer.from('print("hello")'),
        mimetype: 'text/x-python',
        size: 14,
      };

      const result = await service.uploadFile(userA, projectAId, file);
      assert.strictEqual(result.name, 'pipeline.py');
      assert.strictEqual(result.path, '/pipeline.py');
      assert.strictEqual(result.type, 'file');
      assert.strictEqual(result.artifactType, 'code');
      assert.strictEqual(result.sizeBytes, 14);
      assert.strictEqual(stubStorage.files.size, 1);
    });

    it('classifies documents, datasets, results, and models accurately', async () => {
      const testCases = [
        { name: 'paper.pdf', expected: 'document' },
        { name: 'data.parquet', expected: 'dataset' },
        { name: 'confusion_matrix.png', expected: 'result' },
        { name: 'weights.onnx', expected: 'model' },
      ];

      for (const tc of testCases) {
        const res = await service.uploadFile(userA, projectAId, {
          originalname: tc.name,
          buffer: Buffer.from('content'),
          size: 7,
        });
        assert.strictEqual(res.artifactType, tc.expected);
      }
    });

    it('uploads a file into a subfolder', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'data' });
      const file = {
        originalname: 'samples.csv',
        buffer: Buffer.from('id,val\n1,10'),
        size: 11,
      };

      const result = await service.uploadFile(userA, projectAId, file, folder.id);
      assert.strictEqual(result.name, 'samples.csv');
      assert.strictEqual(result.path, '/data/samples.csv');
      assert.strictEqual(result.parentId, folder.id);
    });

    it('rejects duplicate filename in the same folder with 409 Conflict', async () => {
      const file = { originalname: 'README.md', buffer: Buffer.from('# Readme'), size: 8 };
      await service.uploadFile(userA, projectAId, file);

      await assert.rejects(
        async () => {
          await service.uploadFile(userA, projectAId, file);
        },
        (err: unknown) => {
          assert.ok(err instanceof DuplicateArtifactNameError);
          assert.strictEqual(err.status, 409);
          return true;
        }
      );
    });
  });

  describe('listArtifacts', () => {
    it('lists items in folder with folders appearing first', async () => {
      await service.uploadFile(userA, projectAId, { originalname: 'z-file.txt', buffer: Buffer.from('z'), size: 1 });
      await service.createFolder(userA, projectAId, { name: 'b-folder' });
      await service.uploadFile(userA, projectAId, { originalname: 'a-file.txt', buffer: Buffer.from('a'), size: 1 });

      const list = await service.listArtifacts(userA, projectAId, null);
      assert.strictEqual(list.length, 3);
      assert.strictEqual(list[0].name, 'b-folder'); // folder first
      assert.strictEqual(list[0].type, 'folder');
      assert.strictEqual(list[1].name, 'a-file.txt');
      assert.strictEqual(list[2].name, 'z-file.txt');
    });

    it('throws 404 when listing inside a non-existent parent folder', async () => {
      await assert.rejects(
        async () => {
          await service.listArtifacts(userA, projectAId, '99999999-9999-9999-9999-999999999999');
        },
        (err: unknown) => {
          assert.ok(err instanceof ArtifactNotFoundError);
          return true;
        }
      );
    });
  });

  describe('downloadFile', () => {
    it('downloads file stream for owned project', async () => {
      const uploaded = await service.uploadFile(userA, projectAId, {
        originalname: 'download-me.txt',
        buffer: Buffer.from('download payload'),
        size: 16,
      });

      const { artifact, stream } = await service.downloadFile(userA, projectAId, uploaded.id);
      assert.strictEqual(artifact.name, 'download-me.txt');
      assert.ok(stream);
    });

    it('rejects downloading a folder with 400', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'folder-download' });

      await assert.rejects(
        async () => {
          await service.downloadFile(userA, projectAId, folder.id);
        },
        (err: unknown) => {
          assert.ok(err instanceof InvalidArtifactOperationError);
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });
  });

  describe('renameArtifact', () => {
    it('renames a file and updates its virtual path and artifact type', async () => {
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'script.txt',
        buffer: Buffer.from('code'),
        size: 4,
      });

      const renamed = await service.renameArtifact(userA, projectAId, file.id, {
        name: 'script.py',
      });

      assert.strictEqual(renamed.name, 'script.py');
      assert.strictEqual(renamed.path, '/script.py');
      assert.strictEqual(renamed.artifactType, 'code');
    });

    it('renames a folder and cascades virtual path updates to nested descendants', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'old-dir' });
      const childFile = await service.uploadFile(
        userA,
        projectAId,
        { originalname: 'doc.md', buffer: Buffer.from('m'), size: 1 },
        folder.id
      );

      assert.strictEqual(childFile.path, '/old-dir/doc.md');

      await service.renameArtifact(userA, projectAId, folder.id, { name: 'new-dir' });

      const updatedChild = await service.getArtifact(userA, projectAId, childFile.id);
      assert.strictEqual(updatedChild.path, '/new-dir/doc.md');
    });

    it('rejects rename if new name collides with another item in same folder (409)', async () => {
      await service.uploadFile(userA, projectAId, { originalname: 'file1.txt', buffer: Buffer.from('1'), size: 1 });
      const file2 = await service.uploadFile(userA, projectAId, { originalname: 'file2.txt', buffer: Buffer.from('2'), size: 1 });

      await assert.rejects(
        async () => {
          await service.renameArtifact(userA, projectAId, file2.id, { name: 'file1.txt' });
        },
        (err: unknown) => {
          assert.ok(err instanceof DuplicateArtifactNameError);
          assert.strictEqual(err.status, 409);
          return true;
        }
      );
    });
  });

  describe('moveArtifact', () => {
    it('moves a file into another folder and updates path', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'target' });
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'test.py',
        buffer: Buffer.from('p'),
        size: 1,
      });

      const moved = await service.moveArtifact(userA, projectAId, file.id, {
        targetParentId: folder.id,
      });

      assert.strictEqual(moved.parentId, folder.id);
      assert.strictEqual(moved.path, '/target/test.py');
    });

    it('prevents cyclic folder moves (moving folder into itself)', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'self-loop' });

      await assert.rejects(
        async () => {
          await service.moveArtifact(userA, projectAId, folder.id, {
            targetParentId: folder.id,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof InvalidArtifactOperationError);
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    it('prevents cyclic folder moves (moving folder into one of its own descendants)', async () => {
      const parent = await service.createFolder(userA, projectAId, { name: 'parent' });
      const child = await service.createFolder(userA, projectAId, { name: 'child', parentId: parent.id });

      await assert.rejects(
        async () => {
          await service.moveArtifact(userA, projectAId, parent.id, {
            targetParentId: child.id,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof InvalidArtifactOperationError);
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });
  });

  describe('deleteArtifact', () => {
    it('deletes a file and cleans up bytes from storage', async () => {
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'del.txt',
        buffer: Buffer.from('data'),
        size: 4,
      });

      assert.strictEqual(stubStorage.files.size, 1);

      await service.deleteArtifact(userA, projectAId, file.id);

      assert.strictEqual(stubStorage.files.size, 0);
      const remaining = await stubArtifactRepo.findById(file.id);
      assert.strictEqual(remaining, null);
    });

    it('recursively deletes a folder and all nested descendant file storage keys', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'project-tree' });
      await service.uploadFile(userA, projectAId, { originalname: 'file1.txt', buffer: Buffer.from('1'), size: 1 }, folder.id);
      const sub = await service.createFolder(userA, projectAId, { name: 'sub', parentId: folder.id });
      await service.uploadFile(userA, projectAId, { originalname: 'file2.txt', buffer: Buffer.from('2'), size: 1 }, sub.id);

      assert.strictEqual(stubStorage.files.size, 2);

      await service.deleteArtifact(userA, projectAId, folder.id);

      assert.strictEqual(stubStorage.files.size, 0);
    });
  });

  describe('getProjectOverview', () => {
    it('accurately computes project statistics', async () => {
      await service.createFolder(userA, projectAId, { name: 'f1' });
      await service.uploadFile(userA, projectAId, { originalname: 'file1.txt', buffer: Buffer.from('12345'), size: 5 });
      await service.uploadFile(userA, projectAId, { originalname: 'file2.txt', buffer: Buffer.from('1234567'), size: 7 });

      const overview = await service.getProjectOverview(userA, projectAId);
      assert.strictEqual(overview.project.id, projectAId);
      assert.strictEqual(overview.stats.totalFolders, 1);
      assert.strictEqual(overview.stats.totalFiles, 2);
      assert.strictEqual(overview.stats.totalSizeBytes, 12);
    });
  });

  describe('getArtifactContent', () => {
    it('reads text content and detects language accurately for code files', async () => {
      const initialCode = 'console.log("Hello Versora");';
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'index.ts',
        buffer: Buffer.from(initialCode, 'utf-8'),
        mimetype: 'text/typescript',
        size: Buffer.byteLength(initialCode),
      });

      const res = await service.getArtifactContent(userA, projectAId, file.id);
      assert.strictEqual(res.content, initialCode);
      assert.strictEqual(res.language, 'typescript');
      assert.strictEqual(res.isBinary, false);
      assert.strictEqual(res.artifact.name, 'index.ts');
    });

    it('reads empty text files without error', async () => {
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'empty.py',
        buffer: Buffer.from('', 'utf-8'),
        size: 0,
      });

      const res = await service.getArtifactContent(userA, projectAId, file.id);
      assert.strictEqual(res.content, '');
      assert.strictEqual(res.language, 'python');
    });

    it('throws 403 Forbidden when user does not own project', async () => {
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'script.py',
        buffer: Buffer.from('x = 1'),
        size: 5,
      });

      await assert.rejects(
        () => service.getArtifactContent(userB, projectAId, file.id),
        (err: unknown) => err instanceof ProjectForbiddenError
      );
    });

    it('throws 404 when artifact does not exist', async () => {
      await assert.rejects(
        () => service.getArtifactContent(userA, projectAId, crypto.randomUUID()),
        (err: unknown) => err instanceof ArtifactNotFoundError
      );
    });

    it('rejects folders with 400 InvalidArtifactOperationError', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'docs' });
      await assert.rejects(
        () => service.getArtifactContent(userA, projectAId, folder.id),
        (err: unknown) => err instanceof InvalidArtifactOperationError
      );
    });

    it('rejects binary file by extension with 400 InvalidArtifactOperationError', async () => {
      const img = await service.uploadFile(userA, projectAId, {
        originalname: 'logo.png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        size: 4,
      });

      await assert.rejects(
        () => service.getArtifactContent(userA, projectAId, img.id),
        (err: unknown) => err instanceof InvalidArtifactOperationError
      );
    });

    it('rejects binary file containing null bytes with 400 InvalidArtifactOperationError', async () => {
      const binFile = await service.uploadFile(userA, projectAId, {
        originalname: 'data.dat',
        buffer: Buffer.from([0x68, 0x65, 0x00, 0x6c, 0x6f]),
        size: 5,
      });

      await assert.rejects(
        () => service.getArtifactContent(userA, projectAId, binFile.id),
        (err: unknown) => err instanceof InvalidArtifactOperationError
      );
    });
  });

  describe('updateArtifactContent', () => {
    it('updates text content and recalculates size and hash', async () => {
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'main.py',
        buffer: Buffer.from('print(1)'),
        size: 8,
      });

      const updatedCode = 'def main():\n    print("Updated code")\n';
      const updated = await service.updateArtifactContent(userA, projectAId, file.id, {
        content: updatedCode,
      });

      assert.strictEqual(updated.id, file.id);
      assert.strictEqual(updated.sizeBytes, Buffer.byteLength(updatedCode));

      // Verify content persistence in storage
      const fetched = await service.getArtifactContent(userA, projectAId, file.id);
      assert.strictEqual(fetched.content, updatedCode);
    });

    it('throws 403 Forbidden when modifying another user project file', async () => {
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'secret.txt',
        buffer: Buffer.from('confidential'),
        size: 12,
      });

      await assert.rejects(
        () => service.updateArtifactContent(userB, projectAId, file.id, { content: 'hacked' }),
        (err: unknown) => err instanceof ProjectForbiddenError
      );
    });

    it('throws 404 when artifact does not exist', async () => {
      await assert.rejects(
        () => service.updateArtifactContent(userA, projectAId, crypto.randomUUID(), { content: 'test' }),
        (err: unknown) => err instanceof ArtifactNotFoundError
      );
    });

    it('rejects empty/invalid payload with ArtifactValidationError', async () => {
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'readme.md',
        buffer: Buffer.from('# Readme'),
        size: 8,
      });

      await assert.rejects(
        () => service.updateArtifactContent(userA, projectAId, file.id, {}),
        (err: unknown) => err instanceof ArtifactValidationError
      );
    });

    it('rejects updating folder with 400 InvalidArtifactOperationError', async () => {
      const folder = await service.createFolder(userA, projectAId, { name: 'src' });
      await assert.rejects(
        () => service.updateArtifactContent(userA, projectAId, folder.id, { content: 'test' }),
        (err: unknown) => err instanceof InvalidArtifactOperationError
      );
    });
  });

  describe('Artifact Capability Classification and Preview', () => {
    it('classifies source and text files as editable', async () => {
      const tsFile = await service.uploadFile(userA, projectAId, {
        originalname: 'script.ts',
        buffer: Buffer.from('console.log("hello");'),
        size: 22,
      });
      assert.strictEqual(tsFile.capability, 'editable');

      const pyFile = await service.uploadFile(userA, projectAId, {
        originalname: 'main.py',
        buffer: Buffer.from('print("hello")'),
        size: 14,
      });
      assert.strictEqual(pyFile.capability, 'editable');
    });

    it('classifies images and pdf files as previewable', async () => {
      const imgFile = await service.uploadFile(userA, projectAId, {
        originalname: 'diagram.png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        size: 8,
      });
      assert.strictEqual(imgFile.capability, 'previewable');

      const pdfFile = await service.uploadFile(userA, projectAId, {
        originalname: 'spec.pdf',
        buffer: Buffer.from('%PDF-1.4\n'),
        size: 9,
      });
      assert.strictEqual(pdfFile.capability, 'previewable');
    });

    it('classifies modern office documents as previewable and archives as download-only', async () => {
      const docxFile = await service.uploadFile(userA, projectAId, {
        originalname: 'Report.docx',
        buffer: Buffer.from('PK\x03\x04mockdocxcontent'),
        size: 19,
      });
      assert.strictEqual(docxFile.capability, 'previewable');
      assert.strictEqual(docxFile.artifactType, 'document');

      const xlsxFile = await service.uploadFile(userA, projectAId, {
        originalname: 'Data.xlsx',
        buffer: Buffer.from('PK\x03\x04mockxlsxcontent'),
        size: 19,
      });
      assert.strictEqual(xlsxFile.capability, 'previewable');
      assert.strictEqual(xlsxFile.artifactType, 'dataset');

      const pptxFile = await service.uploadFile(userA, projectAId, {
        originalname: 'Slides.pptx',
        buffer: Buffer.from('PK\x03\x04mockpptxcontent'),
        size: 19,
      });
      assert.strictEqual(pptxFile.capability, 'previewable');
      assert.strictEqual(pptxFile.artifactType, 'presentation');

      const zipFile = await service.uploadFile(userA, projectAId, {
        originalname: 'backup.zip',
        buffer: Buffer.from('PK\x03\x04mockzipcontent'),
        size: 18,
      });
      assert.strictEqual(zipFile.capability, 'download-only');

      const legacyDoc = await service.uploadFile(userA, projectAId, {
        originalname: 'legacy.doc',
        buffer: Buffer.from('D0CF11E0mockdoccontent'),
        size: 22,
      });
      assert.strictEqual(legacyDoc.capability, 'download-only');

      // Verify that code editor content reading is blocked for DOCX
      await assert.rejects(
        () => service.getArtifactContent(userA, projectAId, docxFile.id),
        (err: unknown) => err instanceof InvalidArtifactOperationError
      );
    });

    it('streams previewable file through previewFile with project ownership protection', async () => {
      const imgFile = await service.uploadFile(userA, projectAId, {
        originalname: 'logo.png',
        buffer: Buffer.from('png-bytes'),
        size: 9,
      });

      const preview = await service.previewFile(userA, projectAId, imgFile.id);
      assert.strictEqual(preview.artifact.name, 'logo.png');
      assert.ok(preview.stream);

      // Verify unauthorized user is rejected
      await assert.rejects(
        () => service.previewFile(userB, projectAId, imgFile.id),
        (err: unknown) => err instanceof ProjectForbiddenError
      );
    });

    it('parses valid DOCX into rich HTML preview and extracts metadata', async () => {
      const zip = new JSZip();
      zip.file(
        'word/document.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>Project Architecture Specification</w:t></w:r></w:p>
            <w:p><w:r><w:t>Versora automates versioning for all project artifacts.</w:t></w:r></w:p>
          </w:body>
        </w:document>`
      );
      const docxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'Architecture.docx',
        buffer: docxBuffer,
        size: docxBuffer.length,
      });

      const previewRes = await service.getArtifactPreviewData(userA, projectAId, file.id);
      assert.strictEqual(previewRes.artifact.id, file.id);
      assert.strictEqual(previewRes.preview.kind, 'docx');
      if (previewRes.preview.kind === 'docx') {
        assert.ok(previewRes.preview.html.includes('Project Architecture Specification'));
        assert.ok(previewRes.preview.metadata.wordCount > 0);
        assert.ok(previewRes.preview.metadata.charCount > 0);
      }
    });

    it('parses valid XLSX into sheet names and cell grid table', async () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Metric', 'Q1', 'Q2'],
        ['Revenue', 100000, 150000],
        ['Users', 500, 1200],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Financials');
      const ws2 = XLSX.utils.aoa_to_sheet([['Status', 'Active']]);
      XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

      const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'metrics.xlsx',
        buffer: xlsxBuffer,
        size: xlsxBuffer.length,
      });

      const previewRes = await service.getArtifactPreviewData(userA, projectAId, file.id);
      assert.strictEqual(previewRes.preview.kind, 'xlsx');
      if (previewRes.preview.kind === 'xlsx') {
        assert.deepStrictEqual(previewRes.preview.sheetNames, ['Financials', 'Summary']);
        assert.strictEqual(previewRes.preview.sheets['Financials'].totalRows, 3);
        assert.strictEqual(previewRes.preview.sheets['Financials'].totalCols, 3);
        assert.strictEqual(previewRes.preview.sheets['Financials'].rows[0][0], 'Metric');
        assert.strictEqual(previewRes.preview.sheets['Financials'].rows[1][1], 100000);
      }
    });

    it('parses valid PPTX into slide titles and bullet paragraphs', async () => {
      const zip = new JSZip();
      zip.file(
        'ppt/slides/slide1.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
          <p:cSld>
            <p:spTree>
              <p:sp>
                <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
                <p:txBody><a:p><a:r><a:t>Quarterly Launch</a:t></a:r></a:p></p:txBody>
              </p:sp>
              <p:sp>
                <p:nvSpPr><p:cNvPr id="3" name="Content"/></p:nvPr>
                <p:txBody>
                  <a:p><a:r><a:t>Goal 1: Expand reach</a:t></a:r></a:p>
                  <a:p><a:r><a:t>Goal 2: Improve stability</a:t></a:r></a:p>
                </p:txBody>
              </p:sp>
            </p:spTree>
          </p:cSld>
        </p:sld>`
      );
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'presentation.pptx',
        buffer: pptxBuffer,
        size: pptxBuffer.length,
      });

      const previewRes = await service.getArtifactPreviewData(userA, projectAId, file.id);
      assert.strictEqual(previewRes.preview.kind, 'pptx');
      if (previewRes.preview.kind === 'pptx') {
        assert.strictEqual(previewRes.preview.totalSlides, 1);
        assert.strictEqual(previewRes.preview.slides[0].title, 'Quarterly Launch');
        assert.strictEqual(previewRes.preview.slides[0].paragraphs.length, 2);
        assert.strictEqual(previewRes.preview.slides[0].paragraphs[0], 'Goal 1: Expand reach');
      }
    });

    it('parses CSV into structured table headers and rows', async () => {
      const csvContent = 'id,name,role,department\n101,Alice,Lead,Engineering\n102,Bob,Staff,Design\n';
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'team.csv',
        buffer: Buffer.from(csvContent, 'utf-8'),
        size: Buffer.byteLength(csvContent),
      });

      const previewRes = await service.getArtifactPreviewData(userA, projectAId, file.id);
      assert.strictEqual(previewRes.preview.kind, 'csv');
      if (previewRes.preview.kind === 'csv') {
        assert.deepStrictEqual(previewRes.preview.headers, ['id', 'name', 'role', 'department']);
        assert.strictEqual(previewRes.preview.rows.length, 2);
        assert.deepStrictEqual(previewRes.preview.rows[0], ['101', 'Alice', 'Lead', 'Engineering']);
      }
    });

    it('gracefully handles malformed document without crashing or throwing unhandled errors', async () => {
      const corruptDocx = Buffer.from('corrupt-non-zip-random-bytes');
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'corrupt.docx',
        buffer: corruptDocx,
        size: corruptDocx.length,
      });

      const previewRes = await service.getArtifactPreviewData(userA, projectAId, file.id);
      assert.strictEqual(previewRes.preview.kind, 'error');
      if (previewRes.preview.kind === 'error') {
        assert.ok(previewRes.preview.message.includes('Unable to parse'));
      }
    });

    it('returns unsupported details for download-only archives and legacy formats', async () => {
      const zipFile = await service.uploadFile(userA, projectAId, {
        originalname: 'data.zip',
        buffer: Buffer.from('PK\x03\x04zipcontent'),
        size: 14,
      });

      const previewRes = await service.getArtifactPreviewData(userA, projectAId, zipFile.id);
      assert.strictEqual(previewRes.preview.kind, 'unsupported');
      if (previewRes.preview.kind === 'unsupported') {
        assert.ok(previewRes.preview.formatName.includes('Archive'));
        assert.ok(previewRes.preview.reason.includes('Compressed package'));
      }
    });

    it('enforces strict size limits on large preview requests', async () => {
      const oversizedBuffer = Buffer.alloc(MAX_PREVIEW_DOCUMENT_SIZE + 1024);
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'huge.docx',
        buffer: oversizedBuffer,
        size: oversizedBuffer.length,
      });

      const previewRes = await service.getArtifactPreviewData(userA, projectAId, file.id);
      assert.strictEqual(previewRes.preview.kind, 'error');
      if (previewRes.preview.kind === 'error') {
        assert.ok(previewRes.preview.message.includes('exceeds the maximum preview size'));
      }
    });

    it('enforces project ownership authorization on getArtifactPreviewData', async () => {
      const file = await service.uploadFile(userA, projectAId, {
        originalname: 'private.docx',
        buffer: Buffer.from('PK\x03\x04bytes'),
        size: 10,
      });

      // User B should be rejected with 403 Forbidden
      await assert.rejects(
        () => service.getArtifactPreviewData(userB, projectAId, file.id),
        (err: unknown) => err instanceof ProjectForbiddenError
      );
    });

    it('sanitizes HTML to prevent script execution, event handlers, and javascript: links', () => {
      const dirtyHtml = `
        <div>
          <script>alert("xss")</script>
          <p onclick="stealCookies()">Heading with click handler</p>
          <a href="javascript:void(0)">Malicious Link</a>
          <iframe src="https://evil.com"></iframe>
          <style>body { display: none; }</style>
        </div>
      `;
      const clean = sanitizeHtml(dirtyHtml);
      assert.ok(!clean.includes('<script>'));
      assert.ok(!clean.includes('alert'));
      assert.ok(!clean.includes('onclick'));
      assert.ok(!clean.includes('javascript:'));
      assert.ok(!clean.includes('<iframe'));
      assert.ok(!clean.includes('<style'));
      assert.ok(clean.includes('Heading with click handler'));
      assert.ok(clean.includes('target="_blank"'));
      assert.ok(clean.includes('rel="noopener noreferrer"'));
    });
  });
});

