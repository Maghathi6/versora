import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, checkDatabaseConnection } from '../../db';
import { userRepository } from '../users/user.repository';
import { projectRepository } from './project.repository';
import { projects } from '../../db/schema/projects';
import { users } from '../../db/schema/users';
import { eq } from 'drizzle-orm';

describe('Database Integration Tests (Real PostgreSQL)', () => {
  let isDbAvailable = false;
  let testUserId: string;
  let createdProjectId: string;

  before(async () => {
    const conn = await checkDatabaseConnection();
    isDbAvailable = conn.ok;
    if (!isDbAvailable) {
      console.warn('Skipping PostgreSQL integration test: Database is not reachable.');
      return;
    }

    // Create a real test user in PostgreSQL
    const uniqueSuffix = Date.now().toString(36);
    const testUser = await userRepository.create({
      username: `db_test_${uniqueSuffix}`,
      email: `db_test_${uniqueSuffix}@example.com`,
      passwordHash: 'dummy_hash_for_db_test',
      displayName: 'Real DB Test User',
    });
    testUserId = testUser.id;
  });

  after(async () => {
    if (!isDbAvailable || !testUserId) return;

    try {
      // Deleting user cascades to projects due to foreign key onDelete: cascade
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (err) {
      console.error('Failed to clean up test user:', err);
    }
  });

  it('persists a project into PostgreSQL and retrieves it with correct timestamps', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    const created = await projectRepository.create({
      name: 'PostgreSQL Real Project',
      description: 'Verifying real PostgreSQL persistence and indexes',
      ownerId: testUserId,
    });

    createdProjectId = created.id;
    assert.ok(created.id);
    assert.strictEqual(created.name, 'PostgreSQL Real Project');
    assert.strictEqual(created.ownerId, testUserId);
    assert.ok(created.createdAt instanceof Date);
    assert.ok(created.updatedAt instanceof Date);

    // Retrieve via findById
    const fetched = await projectRepository.findById(created.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.name, 'PostgreSQL Real Project');
    assert.strictEqual(fetched.description, 'Verifying real PostgreSQL persistence and indexes');
  });

  it('lists projects belonging to the owner using PostgreSQL owner index', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    const list = await projectRepository.findByOwnerId(testUserId);
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 1);
    assert.ok(list.some((p) => p.id === createdProjectId));
  });

  it('enforces PostgreSQL unique constraint (owner_id, name)', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    // Attempting to insert a duplicate name for the same owner directly in PostgreSQL
    await assert.rejects(
      async () => {
        await projectRepository.create({
          name: 'PostgreSQL Real Project',
          ownerId: testUserId,
        });
      },
      (err: Error) => {
        const cause = (err as { cause?: { code?: string; message?: string; constraint?: string } }).cause;
        const code = cause?.code || (err as { code?: string }).code;
        const msg = (cause?.message || err.message).toLowerCase();
        assert.ok(
          code === '23505' ||
          msg.includes('unique') ||
          msg.includes('duplicate')
        );
        return true;
      }
    );
  });

  it('enforces foreign key constraint: non-existent owner_id is rejected by PostgreSQL', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    const nonexistentOwner = '00000000-0000-0000-0000-000000000000';
    await assert.rejects(
      async () => {
        await projectRepository.create({
          name: 'Orphan Project',
          ownerId: nonexistentOwner,
        });
      },
      (err: Error) => {
        const cause = (err as { cause?: { code?: string; message?: string; constraint?: string } }).cause;
        const code = cause?.code || (err as { code?: string }).code;
        const msg = (cause?.message || err.message).toLowerCase();
        assert.ok(
          code === '23503' ||
          msg.includes('foreign key') ||
          msg.includes('violates foreign key constraint')
        );
        return true;
      }
    );
  });

  it('updates project fields and persists updatedAt timestamp in PostgreSQL', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    const updated = await projectRepository.update(createdProjectId, {
      name: 'PostgreSQL Real Project Renamed',
      description: 'Updated real description in DB',
    });

    assert.ok(updated);
    assert.strictEqual(updated.name, 'PostgreSQL Real Project Renamed');
    assert.strictEqual(updated.description, 'Updated real description in DB');

    const refetched = await projectRepository.findById(createdProjectId);
    assert.ok(refetched);
    assert.strictEqual(refetched.name, 'PostgreSQL Real Project Renamed');
  });

  it('deletes project from PostgreSQL and confirms removal', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database is not reachable');
      return;
    }

    const deleted = await projectRepository.delete(createdProjectId);
    assert.strictEqual(deleted, true);

    const refetched = await projectRepository.findById(createdProjectId);
    assert.strictEqual(refetched, null);
  });
});
