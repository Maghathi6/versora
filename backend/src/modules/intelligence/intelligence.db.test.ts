import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, checkDatabaseConnection } from '../../db';
import { userRepository } from '../users/user.repository';
import { projectRepository } from '../projects/project.repository';
import { artifactRepository } from '../artifacts/artifact.repository';
import { intelligenceRepository } from './intelligence.repository';
import { users } from '../../db/schema/users';
import { eq } from 'drizzle-orm';

describe('Database Integration Tests for Intelligence (Real PostgreSQL)', () => {
  let isDbAvailable = false;
  let testUserId: string;
  let testProjectId: string;
  let art1Id: string;
  let art2Id: string;

  before(async () => {
    const conn = await checkDatabaseConnection();
    isDbAvailable = conn.ok;
    if (!isDbAvailable) {
      console.warn('Skipping PostgreSQL integration test: Database is not reachable.');
      return;
    }

    const uniqueSuffix = Date.now().toString(36);
    const testUser = await userRepository.create({
      username: `intel_db_${uniqueSuffix}`,
      email: `intel_db_${uniqueSuffix}@example.com`,
      passwordHash: 'dummy_hash',
      displayName: 'Intelligence DB Test User',
    });
    testUserId = testUser.id;

    const project = await projectRepository.create({
      name: `Project Intel Test ${uniqueSuffix}`,
      ownerId: testUserId,
    });
    testProjectId = project.id;

    const a1 = await artifactRepository.create({
      projectId: testProjectId,
      name: 'core.ts',
      path: '/core.ts',
      type: 'file',
      artifactType: 'code',
    });
    art1Id = a1.id;

    const a2 = await artifactRepository.create({
      projectId: testProjectId,
      name: 'core.test.ts',
      path: '/core.test.ts',
      type: 'file',
      artifactType: 'code',
    });
    art2Id = a2.id;
  });

  after(async () => {
    if (!isDbAvailable || !testUserId) return;
    try {
      // Cascades to project, artifacts, relationships, activities, impact reviews
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (err) {
      console.error('Failed to clean up test user:', err);
    }
  });

  it('persists artifact relationship and retrieves it via repository', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database unavailable');
      return;
    }

    const rel = await intelligenceRepository.createRelationship({
      projectId: testProjectId,
      sourceArtifactId: art2Id,
      targetArtifactId: art1Id,
      relationshipType: 'tests',
      description: 'Automated test suite for core module',
    });

    assert.ok(rel.id);
    assert.equal(rel.projectId, testProjectId);
    assert.equal(rel.relationshipType, 'tests');

    const fetched = await intelligenceRepository.findRelationshipById(rel.id);
    assert.ok(fetched);
    assert.equal(fetched.description, 'Automated test suite for core module');
  });

  it('enforces PostgreSQL unique constraint on duplicate relationship', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database unavailable');
      return;
    }

    await assert.rejects(
      async () => {
        await intelligenceRepository.createRelationship({
          projectId: testProjectId,
          sourceArtifactId: art2Id,
          targetArtifactId: art1Id,
          relationshipType: 'tests',
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

  it('cascades deletion of relationship when artifact is deleted in PostgreSQL', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database unavailable');
      return;
    }

    const tempArt = await artifactRepository.create({
      projectId: testProjectId,
      name: 'temp.ts',
      path: '/temp.ts',
      type: 'file',
      artifactType: 'code',
    });

    const tempRel = await intelligenceRepository.createRelationship({
      projectId: testProjectId,
      sourceArtifactId: tempArt.id,
      targetArtifactId: art1Id,
      relationshipType: 'depends_on',
    });

    assert.ok(await intelligenceRepository.findRelationshipById(tempRel.id));

    // Delete the source artifact
    await artifactRepository.delete(tempArt.id);

    // Verify relationship was cascaded away by PostgreSQL foreign key constraint
    const afterDelete = await intelligenceRepository.findRelationshipById(tempRel.id);
    assert.equal(afterDelete, null);
  });

  it('persists project activities and retrieves in reverse chronological order', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database unavailable');
      return;
    }

    await intelligenceRepository.recordActivity({
      projectId: testProjectId,
      actorId: testUserId,
      eventType: 'artifact.uploaded',
      entityType: 'artifact',
      entityId: art1Id,
      summary: "Uploaded 'core.ts'",
      metadata: JSON.stringify({ path: '/core.ts' }),
    });

    await intelligenceRepository.recordActivity({
      projectId: testProjectId,
      actorId: testUserId,
      eventType: 'git.commit',
      entityType: 'git',
      entityId: 'hash999',
      summary: "Committed changes",
      metadata: JSON.stringify({ commitHash: 'hash999' }),
    });

    const activities = await intelligenceRepository.listActivities(testProjectId, 10);
    assert.ok(activities.length >= 2);
    // Most recent first
    assert.equal(activities[0].eventType, 'git.commit');
    assert.equal(activities[1].eventType, 'artifact.uploaded');
  });

  it('upserts project impact reviews seamlessly', async (t) => {
    if (!isDbAvailable) {
      t.skip('Database unavailable');
      return;
    }

    const impactKey = `${art1Id}:${art2Id}:depends_on:incoming`;

    const review1 = await intelligenceRepository.upsertImpactReview({
      projectId: testProjectId,
      impactKey,
      status: 'reviewed',
      reviewedBy: testUserId,
      notes: 'Initial review pass',
    });

    assert.equal(review1.status, 'reviewed');
    assert.equal(review1.notes, 'Initial review pass');

    // Update the same impact key to dismissed
    const review2 = await intelligenceRepository.upsertImpactReview({
      projectId: testProjectId,
      impactKey,
      status: 'dismissed',
      reviewedBy: testUserId,
      notes: 'Dismissed after review',
    });

    assert.equal(review2.status, 'dismissed');
    assert.equal(review2.notes, 'Dismissed after review');

    const allReviews = await intelligenceRepository.listImpactReviews(testProjectId);
    assert.equal(allReviews.filter((r) => r.impactKey === impactKey).length, 1);
  });
});
