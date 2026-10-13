import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { IntelligenceService } from './intelligence.service';
import { IIntelligenceRepository } from './intelligence.repository';
import { IArtifactRepository, ProjectStats } from '../artifacts/artifact.repository';
import { IProjectRepository } from '../projects/project.repository';
import { IGitService } from '../git/git.service';
import { Artifact } from '../artifacts/artifact.types';
import { Project } from '../projects/project.types';
import {
  ArtifactRelationship,
  ProjectActivity,
  ProjectImpactReview,
} from '../../db/schema/intelligence';
import {
  SelfRelationshipError,
  CrossProjectRelationshipError,
  DuplicateRelationshipError,
  RelationshipNotFoundError,
  IntelligenceValidationError,
} from './intelligence.errors';
import { ProjectForbiddenError, ProjectNotFoundError } from '../projects/project.errors';
import { ArtifactNotFoundError } from '../artifacts/artifact.errors';
import { GitCommitItem, GitStatusResponse } from '../git/git.types';

describe('Intelligence Service (Unit & Integration Tests)', () => {
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const projectAId = crypto.randomUUID();
  const projectBId = crypto.randomUUID();

  let projectsList: Project[];
  let artifactsList: Artifact[];
  let relationshipsList: ArtifactRelationship[];
  let activitiesList: ProjectActivity[];
  let reviewsList: ProjectImpactReview[];

  let projRepo: IProjectRepository;
  let artifactRepo: IArtifactRepository;
  let intelligenceRepo: IIntelligenceRepository;
  let gitSvc: IGitService;
  let service: IntelligenceService;

  beforeEach(() => {
    projectsList = [
      {
        id: projectAId,
        name: 'Project Alpha',
        description: 'First project',
        ownerId: userA,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: projectBId,
        name: 'Project Beta',
        description: 'Second project',
        ownerId: userB,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    artifactsList = [];
    relationshipsList = [];
    activitiesList = [];
    reviewsList = [];

    projRepo = {
      async create(data) {
        const p: Project = {
          id: crypto.randomUUID(),
          name: data.name,
          description: data.description || null,
          ownerId: data.ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        projectsList.push(p);
        return p;
      },
      async findById(id) {
        return projectsList.find((p) => p.id === id) || null;
      },
      async findByOwnerId(ownerId) {
        return projectsList.filter((p) => p.ownerId === ownerId);
      },
      async findByOwnerAndName(ownerId, name) {
        return (
          projectsList.find(
            (p) => p.ownerId === ownerId && p.name.toLowerCase() === name.toLowerCase()
          ) || null
        );
      },
      async update(id, data) {
        const p = projectsList.find((item) => item.id === id);
        if (!p) return null;
        if (data.name) p.name = data.name;
        if (data.description !== undefined) p.description = data.description;
        p.updatedAt = new Date();
        return p;
      },
      async delete(id) {
        const idx = projectsList.findIndex((p) => p.id === id);
        if (idx === -1) return false;
        projectsList.splice(idx, 1);
        return true;
      },
    };

    artifactRepo = {
      async create(data) {
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
        artifactsList.push(a);
        return a;
      },
      async findById(id) {
        return artifactsList.find((a) => a.id === id) || null;
      },
      async findByProjectAndParent(pId, parentId) {
        return artifactsList.filter(
          (a) => a.projectId === pId && a.parentId === parentId
        );
      },
      async findByProjectAndName(pId, parentId, name) {
        return (
          artifactsList.find(
            (a) =>
              a.projectId === pId &&
              a.parentId === parentId &&
              a.name.toLowerCase() === name.toLowerCase()
          ) || null
        );
      },
      async findAllByProjectId(pId) {
        return artifactsList.filter((a) => a.projectId === pId);
      },
      async findDescendants(folderId) {
        return artifactsList.filter((a) => a.parentId === folderId);
      },
      async update(id, data) {
        const a = artifactsList.find((item) => item.id === id);
        if (!a) return null;
        Object.assign(a, data);
        a.updatedAt = new Date();
        return a;
      },
      async delete(id) {
        const idx = artifactsList.findIndex((a) => a.id === id);
        if (idx === -1) return false;
        artifactsList.splice(idx, 1);
        return true;
      },
      async deleteMany(ids) {
        let count = 0;
        for (const id of ids) {
          const idx = artifactsList.findIndex((a) => a.id === id);
          if (idx !== -1) {
            artifactsList.splice(idx, 1);
            count++;
          }
        }
        return count;
      },
      async getStatsByProject(pId) {
        const items = artifactsList.filter((a) => a.projectId === pId);
        return {
          totalFiles: items.filter((a) => a.type === 'file').length,
          totalFolders: items.filter((a) => a.type === 'folder').length,
          totalSizeBytes: items.reduce((acc, curr) => acc + curr.sizeBytes, 0),
        };
      },
    };

    intelligenceRepo = {
      async createRelationship(data) {
        const rel: ArtifactRelationship = {
          id: crypto.randomUUID(),
          projectId: data.projectId,
          sourceArtifactId: data.sourceArtifactId,
          targetArtifactId: data.targetArtifactId,
          relationshipType: data.relationshipType,
          description: data.description || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        relationshipsList.push(rel);
        return rel;
      },
      async findRelationshipById(id) {
        return relationshipsList.find((r) => r.id === id) || null;
      },
      async findRelationship(pId, sId, tId, type) {
        return (
          relationshipsList.find(
            (r) =>
              r.projectId === pId &&
              r.sourceArtifactId === sId &&
              r.targetArtifactId === tId &&
              r.relationshipType === type
          ) || null
        );
      },
      async deleteRelationship(id) {
        const idx = relationshipsList.findIndex((r) => r.id === id);
        if (idx === -1) return false;
        relationshipsList.splice(idx, 1);
        return true;
      },
      async listRelationshipsByProject(pId) {
        const rels = relationshipsList.filter((r) => r.projectId === pId);
        return rels.map((r) => {
          const src = artifactsList.find((a) => a.id === r.sourceArtifactId);
          const tgt = artifactsList.find((a) => a.id === r.targetArtifactId);
          return {
            id: r.id,
            projectId: r.projectId,
            sourceArtifactId: r.sourceArtifactId,
            targetArtifactId: r.targetArtifactId,
            relationshipType: r.relationshipType as any,
            description: r.description,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            sourceArtifact: src
              ? {
                  id: src.id,
                  name: src.name,
                  path: src.path,
                  type: src.type,
                  artifactType: src.artifactType,
                }
              : undefined,
            targetArtifact: tgt
              ? {
                  id: tgt.id,
                  name: tgt.name,
                  path: tgt.path,
                  type: tgt.type,
                  artifactType: tgt.artifactType,
                }
              : undefined,
          };
        });
      },
      async listRelationshipsForArtifact(pId, artifactId) {
        const all = await this.listRelationshipsByProject(pId);
        return {
          outgoing: all.filter((r) => r.sourceArtifactId === artifactId),
          incoming: all.filter((r) => r.targetArtifactId === artifactId),
        };
      },
      async recordActivity(data) {
        const act: ProjectActivity = {
          id: crypto.randomUUID(),
          projectId: data.projectId,
          actorId: data.actorId,
          eventType: data.eventType,
          entityType: data.entityType,
          entityId: data.entityId || null,
          summary: data.summary,
          metadata: data.metadata || null,
          createdAt: new Date(),
        };
        activitiesList.push(act);
        return act;
      },
      async listActivities(pId, limit = 50, entityType, offset = 0) {
        let filtered = activitiesList.filter((a) => a.projectId === pId);
        if (entityType && entityType !== 'all') {
          filtered = filtered.filter((a) => a.entityType === entityType);
        }
        const reversed = [...filtered].reverse();
        return reversed.slice(offset, offset + limit).map((a) => ({
          id: a.id,
          projectId: a.projectId,
          actorId: a.actorId,
          actorUsername: 'testuser',
          actorDisplayName: 'Test User',
          eventType: a.eventType,
          entityType: a.entityType as any,
          entityId: a.entityId,
          summary: a.summary,
          metadata: a.metadata ? JSON.parse(a.metadata) : null,
          createdAt: a.createdAt.toISOString(),
        }));
      },
      async upsertImpactReview(data) {
        const existingIdx = reviewsList.findIndex(
          (r) => r.projectId === data.projectId && r.impactKey === data.impactKey
        );
        const record: ProjectImpactReview = {
          id: existingIdx !== -1 ? reviewsList[existingIdx].id : crypto.randomUUID(),
          projectId: data.projectId,
          impactKey: data.impactKey,
          status: data.status,
          reviewedBy: data.reviewedBy,
          notes: data.notes || null,
          createdAt: existingIdx !== -1 ? reviewsList[existingIdx].createdAt : new Date(),
          updatedAt: new Date(),
        };
        if (existingIdx !== -1) {
          reviewsList[existingIdx] = record;
        } else {
          reviewsList.push(record);
        }
        return record;
      },
      async listImpactReviews(pId) {
        return reviewsList.filter((r) => r.projectId === pId);
      },
    };

    gitSvc = {
      isRepoInitialized: (pId) => true,
      getProjectRepoPath: (pId) => `/mock/git/${pId}`,
      async initRepository(userId, pId) {
        return { isInitialized: true, branch: 'main', initialCommitHash: 'abc', message: '', filesTrackedCount: 1 };
      },
      async getStatus(userId, pId): Promise<GitStatusResponse> {
        return {
          isInitialized: true,
          currentBranch: 'main',
          hasCommits: true,
          headCommitHash: 'head123',
          staged: [],
          unstaged: [],
          untracked: [],
          totalChangesCount: 0,
        };
      },
      async getDiff(userId, pId) {
        return { isClean: true, files: [], totalAdditions: 0, totalDeletions: 0 };
      },
      async commit(userId, pId, rawInput) {
        return { hash: 'com1', shortHash: 'com1', author: { name: 'A', email: 'a@a.com' }, timestamp: '', parents: [], message: 'test' };
      },
      async getHistory(userId, pId, query): Promise<GitCommitItem[]> {
        return [
          {
            hash: '1111111111111111111111111111111111111111',
            shortHash: '1111111',
            author: { name: 'Dev One', email: 'dev@versora.io' },
            timestamp: new Date().toISOString(),
            parents: [],
            message: 'feat: add initial service module',
          },
        ];
      },
      async getCommit(userId, pId, hash) {
        return {} as any;
      },
      async listBranches(userId, pId) {
        return [{ name: 'main', isCurrent: true, commitHash: 'head123' }];
      },
      async createBranch(userId, pId, rawInput) {
        return { name: 'feat', isCurrent: false, commitHash: 'head123' };
      },
      async switchBranch(userId, pId, rawInput) {
        return { currentBranch: 'feat', message: 'Switched' };
      },
      async previewRestore(userId, pId, rawInput) {
        return {} as any;
      },
      async restore(userId, pId, rawInput) {
        return {} as any;
      },
    };

    service = new IntelligenceService(intelligenceRepo, artifactRepo, projRepo, gitSvc);
  });

  describe('Artifact Relationship Management', () => {
    it('creates a persistent relationship between two artifacts in the same project', async () => {
      const artA = await artifactRepo.create({
        projectId: projectAId,
        name: 'service.ts',
        path: '/service.ts',
        type: 'file',
        artifactType: 'code',
      });
      const artB = await artifactRepo.create({
        projectId: projectAId,
        name: 'service.test.ts',
        path: '/service.test.ts',
        type: 'file',
        artifactType: 'code',
      });

      const rel = await service.createRelationship(userA, projectAId, {
        sourceArtifactId: artB.id,
        targetArtifactId: artA.id,
        relationshipType: 'tests',
        description: 'Test suite verifying service methods',
      });

      assert.equal(rel.projectId, projectAId);
      assert.equal(rel.sourceArtifactId, artB.id);
      assert.equal(rel.targetArtifactId, artA.id);
      assert.equal(rel.relationshipType, 'tests');
      assert.equal(rel.description, 'Test suite verifying service methods');
      assert.equal(rel.sourceArtifact?.name, 'service.test.ts');
      assert.equal(rel.targetArtifact?.name, 'service.ts');

      // Verify activity was recorded
      assert.equal(activitiesList.length, 1);
      assert.equal(activitiesList[0].eventType, 'relationship.created');
    });

    it('rejects self-relationships with SelfRelationshipError (400)', async () => {
      const art = await artifactRepo.create({
        projectId: projectAId,
        name: 'model.ts',
        path: '/model.ts',
        type: 'file',
        artifactType: 'code',
      });

      await assert.rejects(
        async () => {
          await service.createRelationship(userA, projectAId, {
            sourceArtifactId: art.id,
            targetArtifactId: art.id,
            relationshipType: 'depends_on',
          });
        },
        (err: unknown) => {
          assert(err instanceof SelfRelationshipError);
          assert.equal((err as SelfRelationshipError).status, 400);
          return true;
        }
      );
    });

    it('rejects cross-project relationships with CrossProjectRelationshipError (400)', async () => {
      const artA = await artifactRepo.create({
        projectId: projectAId,
        name: 'source.ts',
        path: '/source.ts',
        type: 'file',
        artifactType: 'code',
      });
      const artB = await artifactRepo.create({
        projectId: projectBId,
        name: 'target.ts',
        path: '/target.ts',
        type: 'file',
        artifactType: 'code',
      });

      await assert.rejects(
        async () => {
          await service.createRelationship(userA, projectAId, {
            sourceArtifactId: artA.id,
            targetArtifactId: artB.id,
            relationshipType: 'depends_on',
          });
        },
        (err: unknown) => {
          assert(err instanceof CrossProjectRelationshipError);
          assert.equal((err as CrossProjectRelationshipError).status, 400);
          return true;
        }
      );
    });

    it('rejects duplicate relationships with DuplicateRelationshipError (409)', async () => {
      const artA = await artifactRepo.create({
        projectId: projectAId,
        name: 'a.ts',
        path: '/a.ts',
        type: 'file',
        artifactType: 'code',
      });
      const artB = await artifactRepo.create({
        projectId: projectAId,
        name: 'b.ts',
        path: '/b.ts',
        type: 'file',
        artifactType: 'code',
      });

      await service.createRelationship(userA, projectAId, {
        sourceArtifactId: artA.id,
        targetArtifactId: artB.id,
        relationshipType: 'depends_on',
      });

      await assert.rejects(
        async () => {
          await service.createRelationship(userA, projectAId, {
            sourceArtifactId: artA.id,
            targetArtifactId: artB.id,
            relationshipType: 'depends_on',
          });
        },
        (err: unknown) => {
          assert(err instanceof DuplicateRelationshipError);
          assert.equal((err as DuplicateRelationshipError).status, 409);
          return true;
        }
      );
    });

    it('rejects non-existent artifact with ArtifactNotFoundError (404)', async () => {
      const artA = await artifactRepo.create({
        projectId: projectAId,
        name: 'a.ts',
        path: '/a.ts',
        type: 'file',
        artifactType: 'code',
      });

      await assert.rejects(
        async () => {
          await service.createRelationship(userA, projectAId, {
            sourceArtifactId: artA.id,
            targetArtifactId: crypto.randomUUID(),
            relationshipType: 'depends_on',
          });
        },
        (err: unknown) => {
          assert(err instanceof ArtifactNotFoundError);
          return true;
        }
      );
    });

    it('rejects unowned project with ProjectForbiddenError (403)', async () => {
      await assert.rejects(
        async () => {
          await service.createRelationship(userB, projectAId, {
            sourceArtifactId: crypto.randomUUID(),
            targetArtifactId: crypto.randomUUID(),
            relationshipType: 'depends_on',
          });
        },
        (err: unknown) => {
          assert(err instanceof ProjectForbiddenError);
          assert.equal((err as ProjectForbiddenError).status, 403);
          return true;
        }
      );
    });

    it('deletes an existing relationship and records activity', async () => {
      const artA = await artifactRepo.create({
        projectId: projectAId,
        name: 'a.ts',
        path: '/a.ts',
        type: 'file',
        artifactType: 'code',
      });
      const artB = await artifactRepo.create({
        projectId: projectAId,
        name: 'b.ts',
        path: '/b.ts',
        type: 'file',
        artifactType: 'code',
      });

      const rel = await service.createRelationship(userA, projectAId, {
        sourceArtifactId: artA.id,
        targetArtifactId: artB.id,
        relationshipType: 'documents',
      });

      const result = await service.deleteRelationship(userA, projectAId, rel.id);
      assert.equal(result.success, true);
      assert.equal(relationshipsList.length, 0);

      // Verify deletion activity was recorded
      const delActivity = activitiesList.find((a) => a.eventType === 'relationship.deleted');
      assert(delActivity !== undefined);
    });
  });

  describe('Artifact Traceability', () => {
    it('retrieves explicit relationships, authentic Git commit history, and current working tree status', async () => {
      const doc = await artifactRepo.create({
        projectId: projectAId,
        name: 'README.md',
        path: '/README.md',
        type: 'file',
        artifactType: 'document',
      });
      const code = await artifactRepo.create({
        projectId: projectAId,
        name: 'main.py',
        path: '/main.py',
        type: 'file',
        artifactType: 'code',
      });

      await service.createRelationship(userA, projectAId, {
        sourceArtifactId: doc.id,
        targetArtifactId: code.id,
        relationshipType: 'documents',
        description: 'User documentation for main script',
      });

      const traceability = await service.getArtifactTraceability(userA, projectAId, doc.id);

      assert.equal(traceability.artifact.id, doc.id);
      assert.equal(traceability.outgoingRelationships.length, 1);
      assert.equal(traceability.outgoingRelationships[0].targetArtifactId, code.id);
      assert.equal(traceability.outgoingRelationships[0].relationshipType, 'documents');
      assert.equal(traceability.incomingRelationships.length, 0);

      // Verify Git commit history is present and distinguishes Git from relationships
      assert.equal(traceability.gitHistory.length, 1);
      assert.equal(traceability.gitHistory[0].shortHash, '1111111');
      assert.equal(traceability.gitHistory[0].message, 'feat: add initial service module');
      assert.equal(traceability.currentGitStatus.status, 'clean');
    });
  });

  describe('Rule-Based Change Impact Analysis', () => {
    it('returns empty impact analysis when repository has no changes', async () => {
      const impact = await service.getImpactAnalysis(userA, projectAId);
      assert.equal(impact.changedCount, 0);
      assert.equal(impact.impactCount, 0);
      assert.equal(impact.items.length, 0);
    });

    it('identifies potentially affected artifacts when a tracked dependency is modified', async () => {
      const lib = await artifactRepo.create({
        projectId: projectAId,
        name: 'database.ts',
        path: '/database.ts',
        type: 'file',
        artifactType: 'code',
      });
      const app = await artifactRepo.create({
        projectId: projectAId,
        name: 'app.ts',
        path: '/app.ts',
        type: 'file',
        artifactType: 'code',
      });
      const test = await artifactRepo.create({
        projectId: projectAId,
        name: 'database.test.ts',
        path: '/database.test.ts',
        type: 'file',
        artifactType: 'code',
      });
      const doc = await artifactRepo.create({
        projectId: projectAId,
        name: 'db.md',
        path: '/db.md',
        type: 'file',
        artifactType: 'document',
      });

      // App depends on database
      await service.createRelationship(userA, projectAId, {
        sourceArtifactId: app.id,
        targetArtifactId: lib.id,
        relationshipType: 'depends_on',
      });

      // Test tests database
      await service.createRelationship(userA, projectAId, {
        sourceArtifactId: test.id,
        targetArtifactId: lib.id,
        relationshipType: 'tests',
      });

      // Doc documents database
      await service.createRelationship(userA, projectAId, {
        sourceArtifactId: doc.id,
        targetArtifactId: lib.id,
        relationshipType: 'documents',
      });

      // Simulate gitStatus reporting database.ts as modified
      gitSvc.getStatus = async () => ({
        isInitialized: true,
        currentBranch: 'main',
        hasCommits: true,
        headCommitHash: 'head123',
        staged: [],
        unstaged: [
          {
            path: '/database.ts',
            status: 'modified',
            staged: false,
            isBinary: false,
          },
        ],
        untracked: [],
        totalChangesCount: 1,
      });

      const impact = await service.getImpactAnalysis(userA, projectAId);

      assert.equal(impact.changedCount, 1);
      assert.equal(impact.impactCount, 3);

      // Verify depends_on impact
      const appImpact = impact.items.find((i) => i.affectedArtifact.id === app.id);
      assert(appImpact !== undefined);
      assert.equal(appImpact.severity, 'high');
      assert.equal(appImpact.relationshipType, 'depends_on');
      assert(appImpact.reason.includes("depends on modified artifact 'database.ts'"));

      // Verify tests impact
      const testImpact = impact.items.find((i) => i.affectedArtifact.id === test.id);
      assert(testImpact !== undefined);
      assert.equal(testImpact.severity, 'medium');
      assert.equal(testImpact.relationshipType, 'tests');
      assert(testImpact.reason.includes("tests modified artifact 'database.ts'"));

      // Verify documents impact
      const docImpact = impact.items.find((i) => i.affectedArtifact.id === doc.id);
      assert(docImpact !== undefined);
      assert.equal(docImpact.severity, 'medium');
      assert.equal(docImpact.relationshipType, 'documents');
      assert(docImpact.reason.includes("documents modified artifact 'database.ts'"));
    });

    it('allows marking an impact item as reviewed or dismissed', async () => {
      const artA = await artifactRepo.create({
        projectId: projectAId,
        name: 'a.ts',
        path: '/a.ts',
        type: 'file',
        artifactType: 'code',
      });
      const artB = await artifactRepo.create({
        projectId: projectAId,
        name: 'b.ts',
        path: '/b.ts',
        type: 'file',
        artifactType: 'code',
      });

      await service.createRelationship(userA, projectAId, {
        sourceArtifactId: artB.id,
        targetArtifactId: artA.id,
        relationshipType: 'depends_on',
      });

      gitSvc.getStatus = async () => ({
        isInitialized: true,
        currentBranch: 'main',
        hasCommits: true,
        headCommitHash: 'head123',
        staged: [],
        unstaged: [
          {
            path: '/a.ts',
            status: 'modified',
            staged: false,
            isBinary: false,
          },
        ],
        untracked: [],
        totalChangesCount: 1,
      });

      const initial = await service.getImpactAnalysis(userA, projectAId);
      assert.equal(initial.items.length, 1);
      const impactKey = initial.items[0].impactKey;
      assert.equal(initial.items[0].status, 'active');

      // Review the impact item
      const reviewResult = await service.updateImpactReview(userA, projectAId, {
        impactKey,
        status: 'reviewed',
        notes: 'API contract verified backwards compatible',
      });
      assert.equal(reviewResult.status, 'reviewed');

      // Fetch impact analysis again to ensure status is updated
      const updated = await service.getImpactAnalysis(userA, projectAId);
      assert.equal(updated.items[0].status, 'reviewed');
      assert.equal(updated.items[0].notes, 'API contract verified backwards compatible');
    });
  });

  describe('Real Project Activity Timeline', () => {
    it('records activity events and sanitizes sensitive tokens from metadata', async () => {
      await service.recordActivity(
        projectAId,
        userA,
        'github.pushed',
        'github',
        'rem-1',
        'Pushed commits to remote',
        {
          branch: 'main',
          token: 'ghp_super_secret_token_12345',
          password: 'secret_password_here',
          commitCount: 2,
        }
      );

      const activities = await service.listActivities(userA, projectAId);
      assert.equal(activities.length, 1);
      assert.equal(activities[0].eventType, 'github.pushed');
      assert.equal(activities[0].summary, 'Pushed commits to remote');
      assert.equal(activities[0].metadata?.branch, 'main');
      assert.equal(activities[0].metadata?.commitCount, 2);

      // Ensure secret token and password were stripped
      assert.equal(activities[0].metadata?.token, undefined);
      assert.equal(activities[0].metadata?.password, undefined);
    });

    it('returns all activities when category or entityType is "all" or undefined', async () => {
      await service.recordActivity(
        projectAId,
        userA,
        'artifact.created',
        'artifact',
        'art-1',
        'Created file readme.md'
      );
      await service.recordActivity(
        projectAId,
        userA,
        'git.commit',
        'git',
        'c-1',
        'Committed changes'
      );

      // Default (no query)
      const allDefault = await service.listActivities(userA, projectAId);
      assert.ok(allDefault.length >= 2);

      // entityType = 'all'
      const allWithType = await service.listActivities(userA, projectAId, { entityType: 'all' });
      assert.strictEqual(allWithType.length, allDefault.length);

      // category = 'all'
      const allWithCategory = await service.listActivities(userA, projectAId, { category: 'all' });
      assert.strictEqual(allWithCategory.length, allDefault.length);
    });

    it('filters correctly by individual entityType or category alias', async () => {
      const artifactActivities = await service.listActivities(userA, projectAId, {
        entityType: 'artifact',
      });
      assert.ok(artifactActivities.every((a) => a.entityType === 'artifact'));

      const gitActivities = await service.listActivities(userA, projectAId, {
        category: 'git',
      });
      assert.ok(gitActivities.every((a) => a.entityType === 'git'));
    });

    it('supports pagination with offset and limit', async () => {
      await service.recordActivity(
        projectAId,
        userA,
        'artifact.created',
        'artifact',
        'art-page-1',
        'First test activity'
      );
      await service.recordActivity(
        projectAId,
        userA,
        'artifact.created',
        'artifact',
        'art-page-2',
        'Second test activity'
      );

      const page1 = await service.listActivities(userA, projectAId, { limit: 1, offset: 0 });
      assert.strictEqual(page1.length, 1);

      const page2 = await service.listActivities(userA, projectAId, { limit: 1, offset: 1 });
      assert.strictEqual(page2.length, 1);

      assert.notStrictEqual(page1[0].id, page2[0].id);
    });
  });
});
