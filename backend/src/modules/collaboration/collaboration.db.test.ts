import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, checkDatabaseConnection } from '../../db';
import { userRepository } from '../users/user.repository';
import { projectRepository } from '../projects/project.repository';
import { artifactRepository } from '../artifacts/artifact.repository';
import { collaborationRepository } from './collaboration.repository';
import { users } from '../../db/schema/users';
import { eq } from 'drizzle-orm';

describe('Database Integration Tests for Collaboration (Real PostgreSQL)', () => {
  let isDbAvailable = false;
  let ownerId: string;
  let memberId: string;
  let testProjectId: string;
  let testArtifactId: string;

  before(async () => {
    const conn = await checkDatabaseConnection();
    isDbAvailable = conn.ok;
    if (!isDbAvailable) {
      console.warn('Skipping PostgreSQL integration test: Database is not reachable.');
      return;
    }

    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const owner = await userRepository.create({
      username: `collab_owner_${uniqueSuffix}`,
      email: `collab_owner_${uniqueSuffix}@example.com`,
      passwordHash: 'dummy_hash',
      displayName: 'Collab Owner User',
    });
    ownerId = owner.id;

    const member = await userRepository.create({
      username: `collab_mem_${uniqueSuffix}`,
      email: `collab_mem_${uniqueSuffix}@example.com`,
      passwordHash: 'dummy_hash',
      displayName: 'Collab Member User',
    });
    memberId = member.id;

    const project = await projectRepository.create({
      name: `Collab Project ${uniqueSuffix}`,
      ownerId,
    });
    testProjectId = project.id;

    const art = await artifactRepository.create({
      projectId: testProjectId,
      name: 'service.ts',
      path: '/service.ts',
      type: 'file',
      artifactType: 'code',
    });
    testArtifactId = art.id;
  });

  after(async () => {
    if (!isDbAvailable) return;
    try {
      if (testProjectId) {
        await projectRepository.delete(testProjectId);
      }
      if (ownerId) {
        await db.delete(users).where(eq(users.id, ownerId));
      }
      if (memberId) {
        await db.delete(users).where(eq(users.id, memberId));
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it('persists project member and retrieves via repository', async () => {
    if (!isDbAvailable) return;

    const member = await collaborationRepository.addMember(testProjectId, memberId, 'member');
    assert.ok(member.id);
    assert.equal(member.role, 'member');

    const found = await collaborationRepository.findMember(testProjectId, memberId);
    assert.ok(found);
    assert.equal(found?.userId, memberId);

    const list = await collaborationRepository.listMembers(testProjectId);
    assert.ok(list.some((m) => m.userId === memberId));
  });

  it('persists invitation and updates status', async () => {
    if (!isDbAvailable) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const inv = await collaborationRepository.createInvitation({
      projectId: testProjectId,
      inviterId: ownerId,
      inviteeId: memberId,
      role: 'reviewer',
      status: 'pending',
      token: 'test-token-' + Date.now(),
      expiresAt,
    });

    assert.ok(inv.id);
    assert.equal(inv.status, 'pending');

    const updated = await collaborationRepository.updateInvitationStatus(inv.id, 'accepted');
    assert.equal(updated?.status, 'accepted');
  });

  it('persists threaded artifact comments and retrieves hierarchically', async () => {
    if (!isDbAvailable) return;

    const parent = await collaborationRepository.createComment({
      projectId: testProjectId,
      artifactId: testArtifactId,
      authorId: ownerId,
      content: 'Top-level discussion question',
    });

    const reply = await collaborationRepository.createComment({
      projectId: testProjectId,
      artifactId: testArtifactId,
      authorId: memberId,
      parentId: parent.id,
      content: 'Threaded reply to question',
    });

    assert.ok(parent.id);
    assert.ok(reply.id);

    const commentsList = await collaborationRepository.listArtifactComments(testArtifactId);
    const parentInList = commentsList.find((c) => c.id === parent.id);
    assert.ok(parentInList);
    assert.equal(parentInList.replyCount, 1);
    assert.equal(parentInList.replies?.length, 1);
    assert.equal(parentInList.replies![0].id, reply.id);
  });

  it('persists project task, updates status, and filters', async () => {
    if (!isDbAvailable) return;

    const task = await collaborationRepository.createTask({
      projectId: testProjectId,
      creatorId: ownerId,
      assigneeId: memberId,
      title: 'Review database indexes',
      description: 'Check postgres query plans',
      status: 'todo',
      priority: 'high',
      labels: JSON.stringify(['db', 'perf']),
    });

    assert.ok(task.id);
    assert.equal(task.title, 'Review database indexes');

    const updated = await collaborationRepository.updateTask(task.id, { status: 'in_progress' });
    assert.equal(updated?.status, 'in_progress');

    const inProgressList = await collaborationRepository.listTasks(testProjectId, {
      status: 'in_progress',
    });
    assert.ok(inProgressList.some((t) => t.id === task.id));
  });

  it('persists review, reviewer assignment, and decision', async () => {
    if (!isDbAvailable) return;

    const review = await collaborationRepository.createReview({
      projectId: testProjectId,
      creatorId: ownerId,
      title: 'PostgreSQL schema review',
      targetType: 'branch',
      targetRef: 'main',
      status: 'open',
    });

    assert.ok(review.id);

    await collaborationRepository.addReviewer(review.id, memberId);

    const decision = await collaborationRepository.upsertDecision({
      reviewId: review.id,
      reviewerId: memberId,
      decision: 'approved',
      feedback: 'All migrations verified',
      commitHashAtDecision: 'hash-abc',
    });

    assert.equal(decision.decision, 'approved');

    const fetchedReview = await collaborationRepository.findReviewById(review.id);
    assert.ok(fetchedReview);
    assert.equal(fetchedReview.decisionsCount.approved, 1);
  });

  it('persists in-app notifications and manages unread count', async () => {
    if (!isDbAvailable) return;

    const notif = await collaborationRepository.createNotification({
      recipientId: memberId,
      actorId: ownerId,
      projectId: testProjectId,
      type: 'invitation',
      title: 'Test Notification',
      message: 'You have a new invite',
      entityType: 'invitation',
      entityId: 'dummy-id',
    });

    assert.ok(notif.id);

    const unread = await collaborationRepository.getUnreadNotificationCount(memberId);
    assert.ok(unread >= 1);

    const marked = await collaborationRepository.markNotificationAsRead(notif.id, memberId);
    assert.equal(marked, true);
  });
});
