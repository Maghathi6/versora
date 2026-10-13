import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, checkDatabaseConnection } from '../../db';
import { userRepository } from '../users/user.repository';
import { projectRepository } from '../projects/project.repository';
import { artifactRepository } from './artifact.repository';
import { users } from '../../db/schema/users';
import { eq } from 'drizzle-orm';

describe('Database Integration Tests for Artifacts (Real PostgreSQL)', () => {
  let isDbAvailable = false;
  let testUserId: string;
  let testProjectId: string;

  before(async () => {
    const conn = await checkDatabaseConnection();
    isDbAvailable = conn.ok;
    if (!isDbAvailable) {
      console.warn('Skipping PostgreSQL integration test: Database is not reachable.');
      return;
    }

    const uniqueSuffix = Date.now().toString(36);
    const testUser = await userRepository.create({
      username: `art_db_${uniqueSuffix}`,
      email: `art_db_${uniqueSuffix}@example.com`,
      passwordHash: 'dummy_hash',
      displayName: 'Artifact DB Test User',
    });
    testUserId = testUser.id;

    const project = await projectRepository.create({
      name: `Project Artifact Test ${uniqueSuffix}`,
      ownerId: testUserId,
    });
    testProjectId = project.id;
  });

  after(async () => {
    if (!isDbAvailable || !testUserId) return;
    try {
      // Cascades to project and artifacts
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (err) {
      console.error('Failed to clean up test user:', err);
    }
  });

  it('persists folders and files into PostgreSQL with accurate relationships', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    const folder = await artifactRepository.create({
      projectId: testProjectId,
      name: 'source',
      path: '/source',
      type: 'folder',
      artifactType: 'folder',
      sizeBytes: 0,
    });
    assert.ok(folder.id);
    assert.strictEqual(folder.name, 'source');

    const file = await artifactRepository.create({
      projectId: testProjectId,
      parentId: folder.id,
      name: 'index.ts',
      path: '/source/index.ts',
      type: 'file',
      artifactType: 'code',
      mimeType: 'application/typescript',
      sizeBytes: 120,
      storageKey: `projects/${testProjectId}/some-uuid.ts`,
      hash: 'fakehash123',
    });
    assert.ok(file.id);
    assert.strictEqual(file.parentId, folder.id);
    assert.strictEqual(file.sizeBytes, 120);

    const fetched = await artifactRepository.findById(file.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.name, 'index.ts');
  });

  it('enforces PostgreSQL unique constraint for root-level items (projectId, name)', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    await artifactRepository.create({
      projectId: testProjectId,
      name: 'unique-root-file.txt',
      path: '/unique-root-file.txt',
      type: 'file',
      artifactType: 'document',
      sizeBytes: 10,
    });

    await assert.rejects(
      async () => {
        await artifactRepository.create({
          projectId: testProjectId,
          name: 'unique-root-file.txt',
          path: '/unique-root-file.txt',
          type: 'file',
          artifactType: 'document',
          sizeBytes: 10,
        });
      },
      (err: Error) => {
        const cause = (err as { cause?: { code?: string; message?: string } }).cause;
        const code = cause?.code || (err as { code?: string }).code;
        const msg = (cause?.message || err.message).toLowerCase();
        assert.ok(code === '23505' || msg.includes('unique') || msg.includes('duplicate'));
        return true;
      }
    );
  });

  it('retrieves nested descendants using PostgreSQL recursive CTE', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    const rootDir = await artifactRepository.create({
      projectId: testProjectId,
      name: 'tree-root',
      path: '/tree-root',
      type: 'folder',
      artifactType: 'folder',
      sizeBytes: 0,
    });

    const subDir = await artifactRepository.create({
      projectId: testProjectId,
      parentId: rootDir.id,
      name: 'sub-dir',
      path: '/tree-root/sub-dir',
      type: 'folder',
      artifactType: 'folder',
      sizeBytes: 0,
    });

    const leafFile = await artifactRepository.create({
      projectId: testProjectId,
      parentId: subDir.id,
      name: 'leaf.txt',
      path: '/tree-root/sub-dir/leaf.txt',
      type: 'file',
      artifactType: 'document',
      sizeBytes: 50,
    });

    const descendants = await artifactRepository.findDescendants(rootDir.id);
    assert.strictEqual(descendants.length, 2);
    assert.ok(descendants.some((d) => d.id === subDir.id));
    assert.ok(descendants.some((d) => d.id === leafFile.id));
  });

  it('creates and persists a file artifact through artifactService into real PostgreSQL', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    const { artifactService } = await import('./artifact.service');
    const created = await artifactService.createArtifact(testUserId, testProjectId, {
      name: 'integration-test.ts',
      content: 'export const hello = "world";',
    });

    assert.ok(created.id);
    assert.strictEqual(created.name, 'integration-test.ts');
    assert.strictEqual(created.path, '/integration-test.ts');
    assert.strictEqual(created.capability, 'editable');

    const fetched = await artifactRepository.findById(created.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.name, 'integration-test.ts');
    assert.ok(fetched.storageKey);
  });
});
