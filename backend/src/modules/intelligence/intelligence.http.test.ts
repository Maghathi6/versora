import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import { createIntelligenceRouter } from './intelligence.routes';
import { IntelligenceService } from './intelligence.service';
import { IIntelligenceRepository } from './intelligence.repository';
import { IArtifactRepository, ProjectStats } from '../artifacts/artifact.repository';
import { IProjectRepository } from '../projects/project.repository';
import { IGitService } from '../git/git.service';
import { Artifact, NewArtifact } from '../artifacts/artifact.types';
import { Project } from '../projects/project.types';
import { User } from '../users/user.types';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { TokenService } from '../auth/token.service';
import {
  ArtifactRelationship,
  ProjectActivity,
  ProjectImpactReview,
} from '../../db/schema/intelligence';

describe('HTTP Intelligence Endpoints (/api/v1/projects/:projectId)', () => {
  let server: Server;
  let baseUrl: string;

  const userAId = '11111111-1111-1111-1111-111111111111';
  const userBId = '22222222-2222-2222-2222-222222222222';
  const projectAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const projectBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const art1Id = '11111111-2222-3333-4444-555555555555';
  const art2Id = '66666666-7777-8888-9999-000000000000';

  const secretKey = 'test-jwt-secret-key-at-least-16-chars-long';
  const tokenService = new TokenService(secretKey, '1h');
  let validTokenA: string;
  let validTokenB: string;

  let service: IntelligenceService;
  const relationshipsList: ArtifactRelationship[] = [];
  const activitiesList: ProjectActivity[] = [];
  const reviewsList: ProjectImpactReview[] = [];

  before(async () => {
    validTokenA = tokenService.signAccessToken({ userId: userAId, username: 'user_a' });
    validTokenB = tokenService.signAccessToken({ userId: userBId, username: 'user_b' });

    const users: User[] = [
      {
        id: userAId,
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
        id: userBId,
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

    const userRepo = {
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

    const projects: Project[] = [
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

    const projRepo: IProjectRepository = {
      async create(data) {
        return projects[0];
      },
      async findById(id) {
        return projects.find((p) => p.id === id) || null;
      },
      async findByOwnerId(ownerId) {
        return projects.filter((p) => p.ownerId === ownerId);
      },
      async findByOwnerAndName(ownerId, name) {
        return projects.find((p) => p.ownerId === ownerId && p.name === name) || null;
      },
      async update(id, data) {
        return projects[0];
      },
      async delete(id) {
        return true;
      },
    };

    const artifacts: Artifact[] = [
      {
        id: art1Id,
        projectId: projectAId,
        parentId: null,
        name: 'source.ts',
        path: '/source.ts',
        type: 'file',
        artifactType: 'code',
        mimeType: 'text/typescript',
        sizeBytes: 100,
        storageKey: 'key-1',
        hash: 'hash-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: art2Id,
        projectId: projectAId,
        parentId: null,
        name: 'target.ts',
        path: '/target.ts',
        type: 'file',
        artifactType: 'code',
        mimeType: 'text/typescript',
        sizeBytes: 150,
        storageKey: 'key-2',
        hash: 'hash-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const artifactRepo: IArtifactRepository = {
      async create(data) {
        return artifacts[0];
      },
      async findById(id) {
        return artifacts.find((a) => a.id === id) || null;
      },
      async findByProjectAndParent(pId, parentId) {
        return artifacts.filter((a) => a.projectId === pId);
      },
      async findByProjectAndName(pId, parentId, name) {
        return artifacts.find((a) => a.projectId === pId && a.name === name) || null;
      },
      async findAllByProjectId(pId) {
        return artifacts.filter((a) => a.projectId === pId);
      },
      async findDescendants() {
        return [];
      },
      async update(id, data) {
        return artifacts[0];
      },
      async delete(id) {
        return true;
      },
      async deleteMany(ids) {
        return 0;
      },
      async getStatsByProject() {
        return { totalFiles: 2, totalFolders: 0, totalSizeBytes: 250 };
      },
    };

    const intelligenceRepo: IIntelligenceRepository = {
      async createRelationship(data) {
        const r: ArtifactRelationship = {
          id: 'rel-1',
          projectId: data.projectId,
          sourceArtifactId: data.sourceArtifactId,
          targetArtifactId: data.targetArtifactId,
          relationshipType: data.relationshipType,
          description: data.description || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        relationshipsList.push(r);
        return r;
      },
      async findRelationshipById(id) {
        return relationshipsList.find((r) => r.id === id) || null;
      },
      async findRelationship(pId, sId, tId, type) {
        return relationshipsList.find(
          (r) => r.projectId === pId && r.sourceArtifactId === sId && r.targetArtifactId === tId && r.relationshipType === type
        ) || null;
      },
      async deleteRelationship(id) {
        const idx = relationshipsList.findIndex((r) => r.id === id);
        if (idx === -1) return false;
        relationshipsList.splice(idx, 1);
        return true;
      },
      async listRelationshipsByProject(pId) {
        return relationshipsList.filter((r) => r.projectId === pId).map((r) => ({
          id: r.id,
          projectId: r.projectId,
          sourceArtifactId: r.sourceArtifactId,
          targetArtifactId: r.targetArtifactId,
          relationshipType: r.relationshipType as any,
          description: r.description,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));
      },
      async listRelationshipsForArtifact(pId, artifactId) {
        const all = await this.listRelationshipsByProject(pId);
        return {
          outgoing: all.filter((r) => r.sourceArtifactId === artifactId),
          incoming: all.filter((r) => r.targetArtifactId === artifactId),
        };
      },
      async recordActivity(data) {
        const a: ProjectActivity = {
          id: 'act-1',
          projectId: data.projectId,
          actorId: data.actorId,
          eventType: data.eventType,
          entityType: data.entityType,
          entityId: data.entityId || null,
          summary: data.summary,
          metadata: data.metadata || null,
          createdAt: new Date(),
        };
        activitiesList.push(a);
        return a;
      },
      async listActivities(pId) {
        return activitiesList.filter((a) => a.projectId === pId).map((a) => ({
          id: a.id,
          projectId: a.projectId,
          actorId: a.actorId,
          eventType: a.eventType,
          entityType: a.entityType as any,
          entityId: a.entityId,
          summary: a.summary,
          metadata: a.metadata ? JSON.parse(a.metadata) : null,
          createdAt: a.createdAt.toISOString(),
        }));
      },
      async upsertImpactReview(data) {
        const rev: ProjectImpactReview = {
          id: 'rev-1',
          projectId: data.projectId,
          impactKey: data.impactKey,
          status: data.status,
          reviewedBy: data.reviewedBy,
          notes: data.notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        reviewsList.push(rev);
        return rev;
      },
      async listImpactReviews(pId) {
        return reviewsList.filter((r) => r.projectId === pId);
      },
    };

    const gitSvc: IGitService = {
      isRepoInitialized: () => true,
      getProjectRepoPath: () => '/mock',
      initRepository: async () => ({ isInitialized: true, branch: 'main', initialCommitHash: null, message: '', filesTrackedCount: 0 }),
      getStatus: async () => ({
        isInitialized: true,
        currentBranch: 'main',
        hasCommits: true,
        headCommitHash: 'abc',
        staged: [],
        unstaged: [],
        untracked: [],
        totalChangesCount: 0,
      }),
      getDiff: async () => ({ isClean: true, files: [], totalAdditions: 0, totalDeletions: 0 }),
      commit: async () => ({ hash: '', shortHash: '', message: '', author: { name: '', email: '' }, timestamp: '', parents: [] }),
      getHistory: async () => [],
      getCommit: async () => ({} as any),
      listBranches: async () => [],
      createBranch: async () => ({} as any),
      switchBranch: async () => ({ currentBranch: '', message: '' }),
      previewRestore: async () => ({} as any),
      restore: async () => ({} as any),
    };

    service = new IntelligenceService(intelligenceRepo, artifactRepo, projRepo, gitSvc);

    const app: Application = express();
    app.use(express.json());

    const authMiddleware = createAuthMiddleware({ tokenSvc: tokenService, userRepo });
    const router = createIntelligenceRouter(service, authMiddleware);

    const v1Router = Router();
    v1Router.use('/projects', router);
    app.use('/api/v1', v1Router);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects unauthenticated requests to relationships with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/relationships`);
    assert.equal(res.status, 401);
  });

  it('rejects access to another user project with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/relationships`, {
      headers: { Authorization: `Bearer ${validTokenB}` },
    });
    assert.equal(res.status, 403);
  });

  it('creates relationship via POST /projects/:projectId/relationships (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/relationships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validTokenA}`,
      },
      body: JSON.stringify({
        sourceArtifactId: art1Id,
        targetArtifactId: art2Id,
        relationshipType: 'depends_on',
        description: 'Module dependencies',
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.relationshipType, 'depends_on');
    assert.equal(body.data.sourceArtifactId, art1Id);
    assert.equal(body.data.targetArtifactId, art2Id);
  });

  it('lists relationships via GET /projects/:projectId/relationships (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/relationships`, {
      headers: { Authorization: `Bearer ${validTokenA}` },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert(Array.isArray(body.data));
    assert.equal(body.data.length, 1);
  });

  it('retrieves artifact traceability via GET /projects/:projectId/artifacts/:artifactId/traceability (200 OK)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectAId}/artifacts/${art1Id}/traceability`,
      {
        headers: { Authorization: `Bearer ${validTokenA}` },
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.artifact.id, art1Id);
    assert(Array.isArray(body.data.outgoingRelationships));
    assert(Array.isArray(body.data.gitHistory));
  });

  it('retrieves impact analysis via GET /projects/:projectId/intelligence/impact (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/intelligence/impact`, {
      headers: { Authorization: `Bearer ${validTokenA}` },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.changedCount, 0);
    assert.equal(body.data.impactCount, 0);
  });

  it('records impact review via POST /projects/:projectId/intelligence/impact/review (200 OK)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectAId}/intelligence/impact/review`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validTokenA}`,
        },
        body: JSON.stringify({
          impactKey: 'art-1:art-2:depends_on:incoming',
          status: 'reviewed',
          notes: 'Reviewed changes',
        }),
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'reviewed');
  });

  it('lists activities via GET /projects/:projectId/activities (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectAId}/activities`, {
      headers: { Authorization: `Bearer ${validTokenA}` },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert(Array.isArray(body.data));
  });

  it('deletes relationship via DELETE /projects/:projectId/relationships/:relationshipId (200 OK)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectAId}/relationships/rel-1`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${validTokenA}` },
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.success, true);
  });
});
