import { IArtifactRepository, artifactRepository } from '../artifacts/artifact.repository';
import { IProjectRepository, projectRepository } from '../projects/project.repository';
import { IGitService, gitService } from '../git/git.service';
import { collaborationRepository } from '../collaboration/collaboration.repository';
import {
  IIntelligenceRepository,
  intelligenceRepository,
} from './intelligence.repository';
import {
  ArtifactRelationshipSummary,
  ArtifactTraceabilityData,
  ImpactAnalysisItem,
  ImpactAnalysisResponse,
  ActivityItem,
} from './intelligence.types';
import {
  createRelationshipSchema,
  updateImpactReviewSchema,
  queryActivitiesSchema,
  CreateRelationshipInput,
  UpdateImpactReviewInput,
  QueryActivitiesInput,
} from './intelligence.schemas';
import {
  SelfRelationshipError,
  CrossProjectRelationshipError,
  DuplicateRelationshipError,
  RelationshipNotFoundError,
  IntelligenceValidationError,
} from './intelligence.errors';
import { ProjectNotFoundError, ProjectForbiddenError } from '../projects/project.errors';
import { ArtifactNotFoundError } from '../artifacts/artifact.errors';
import { ProjectImpactReview } from '../../db/schema/intelligence';

export interface IIntelligenceService {
  createRelationship(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<ArtifactRelationshipSummary>;
  deleteRelationship(
    userId: string,
    projectId: string,
    relationshipId: string
  ): Promise<{ success: boolean; message: string }>;
  listRelationships(
    userId: string,
    projectId: string
  ): Promise<ArtifactRelationshipSummary[]>;
  getArtifactTraceability(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<ArtifactTraceabilityData>;
  getImpactAnalysis(userId: string, projectId: string): Promise<ImpactAnalysisResponse>;
  updateImpactReview(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<ProjectImpactReview>;
  recordActivity(
    projectId: string,
    actorId: string,
    eventType: string,
    entityType:
      | 'artifact'
      | 'git'
      | 'github'
      | 'relationship'
      | 'task'
      | 'review'
      | 'comment'
      | 'member'
      | 'collaboration'
      | string,
    entityId: string | null,
    summary: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;
  listActivities(
    userId: string,
    projectId: string,
    rawQuery?: unknown
  ): Promise<ActivityItem[]>;
}

export class IntelligenceService implements IIntelligenceService {
  constructor(
    private intelligenceRepo: IIntelligenceRepository = intelligenceRepository,
    private artifactRepo: IArtifactRepository = artifactRepository,
    private projRepo: IProjectRepository = projectRepository,
    private gitSvc: IGitService = gitService
  ) {}

  private async verifyProjectOwnership(userId: string, projectId: string): Promise<void> {
    const project = await this.projRepo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    if (project.ownerId !== userId) {
      const member = await collaborationRepository.findMember(projectId, userId);
      if (!member) {
        throw new ProjectForbiddenError('You do not have permission to access this project.');
      }
    }
  }

  async createRelationship(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<ArtifactRelationshipSummary> {
    await this.verifyProjectOwnership(userId, projectId);

    const parseResult = createRelationshipSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new IntelligenceValidationError(
        parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          issue: e.message,
        }))
      );
    }

    const input: CreateRelationshipInput = parseResult.data;

    // Reject self-relationship
    if (input.sourceArtifactId === input.targetArtifactId) {
      throw new SelfRelationshipError('An artifact cannot have a relationship with itself.');
    }

    // Verify source artifact
    const sourceArtifact = await this.artifactRepo.findById(input.sourceArtifactId);
    if (!sourceArtifact) {
      throw new ArtifactNotFoundError(input.sourceArtifactId);
    }
    if (sourceArtifact.projectId !== projectId) {
      throw new CrossProjectRelationshipError(
        'Source artifact does not belong to the authenticated project.'
      );
    }

    // Verify target artifact
    const targetArtifact = await this.artifactRepo.findById(input.targetArtifactId);
    if (!targetArtifact) {
      throw new ArtifactNotFoundError(input.targetArtifactId);
    }
    if (targetArtifact.projectId !== projectId) {
      throw new CrossProjectRelationshipError(
        'Target artifact does not belong to the authenticated project.'
      );
    }

    // Check for existing relationship of the same type between source and target
    const existing = await this.intelligenceRepo.findRelationship(
      projectId,
      input.sourceArtifactId,
      input.targetArtifactId,
      input.relationshipType
    );
    if (existing) {
      throw new DuplicateRelationshipError(
        `Relationship '${input.relationshipType}' already exists between '${sourceArtifact.name}' and '${targetArtifact.name}'.`
      );
    }

    const created = await this.intelligenceRepo.createRelationship({
      projectId,
      sourceArtifactId: input.sourceArtifactId,
      targetArtifactId: input.targetArtifactId,
      relationshipType: input.relationshipType,
      description: input.description || null,
    });

    // Record activity
    await this.recordActivity(
      projectId,
      userId,
      'relationship.created',
      'relationship',
      created.id,
      `Connected '${sourceArtifact.name}' to '${targetArtifact.name}' (${input.relationshipType})`,
      {
        sourceArtifactId: input.sourceArtifactId,
        targetArtifactId: input.targetArtifactId,
        sourceName: sourceArtifact.name,
        targetName: targetArtifact.name,
        relationshipType: input.relationshipType,
      }
    );

    return {
      id: created.id,
      projectId: created.projectId,
      sourceArtifactId: created.sourceArtifactId,
      targetArtifactId: created.targetArtifactId,
      relationshipType: created.relationshipType as any,
      description: created.description,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      sourceArtifact: {
        id: sourceArtifact.id,
        name: sourceArtifact.name,
        path: sourceArtifact.path,
        type: sourceArtifact.type,
        artifactType: sourceArtifact.artifactType,
      },
      targetArtifact: {
        id: targetArtifact.id,
        name: targetArtifact.name,
        path: targetArtifact.path,
        type: targetArtifact.type,
        artifactType: targetArtifact.artifactType,
      },
    };
  }

  async deleteRelationship(
    userId: string,
    projectId: string,
    relationshipId: string
  ): Promise<{ success: boolean; message: string }> {
    await this.verifyProjectOwnership(userId, projectId);

    const rel = await this.intelligenceRepo.findRelationshipById(relationshipId);
    if (!rel || rel.projectId !== projectId) {
      throw new RelationshipNotFoundError('Relationship not found.');
    }

    const sourceArtifact = await this.artifactRepo.findById(rel.sourceArtifactId);
    const targetArtifact = await this.artifactRepo.findById(rel.targetArtifactId);

    const deleted = await this.intelligenceRepo.deleteRelationship(relationshipId);
    if (!deleted) {
      throw new RelationshipNotFoundError('Relationship not found or already deleted.');
    }

    // Record activity
    await this.recordActivity(
      projectId,
      userId,
      'relationship.deleted',
      'relationship',
      relationshipId,
      `Removed '${rel.relationshipType}' connection between '${sourceArtifact?.name || 'artifact'}' and '${targetArtifact?.name || 'artifact'}'`,
      {
        sourceArtifactId: rel.sourceArtifactId,
        targetArtifactId: rel.targetArtifactId,
        relationshipType: rel.relationshipType,
      }
    );

    return { success: true, message: 'Relationship removed successfully.' };
  }

  async listRelationships(
    userId: string,
    projectId: string
  ): Promise<ArtifactRelationshipSummary[]> {
    await this.verifyProjectOwnership(userId, projectId);
    return this.intelligenceRepo.listRelationshipsByProject(projectId);
  }

  async getArtifactTraceability(
    userId: string,
    projectId: string,
    artifactId: string
  ): Promise<ArtifactTraceabilityData> {
    await this.verifyProjectOwnership(userId, projectId);

    const artifact = await this.artifactRepo.findById(artifactId);
    if (!artifact || artifact.projectId !== projectId) {
      throw new ArtifactNotFoundError(artifactId);
    }

    const rels = await this.intelligenceRepo.listRelationshipsForArtifact(projectId, artifactId);

    let gitHistory: any[] = [];
    let currentGitStatus: ArtifactTraceabilityData['currentGitStatus'] = { status: 'clean' };

    try {
      if (this.gitSvc.isRepoInitialized(projectId)) {
        // Fetch real Git history for this specific file path
        gitHistory = await this.gitSvc.getHistory(userId, projectId, {
          limit: 50,
          path: artifact.path,
        });

        // Check active Git working tree status
        const status = await this.gitSvc.getStatus(userId, projectId);
        const stagedMatch = status.staged.find((c) => c.path === artifact.path);
        const unstagedMatch = status.unstaged.find((c) => c.path === artifact.path);
        const untrackedMatch = status.untracked.find((c) => c.path === artifact.path);

        if (stagedMatch) {
          currentGitStatus = {
            status: stagedMatch.status as any,
            staged: true,
          };
        } else if (unstagedMatch) {
          currentGitStatus = {
            status: unstagedMatch.status as any,
            staged: false,
          };
        } else if (untrackedMatch) {
          currentGitStatus = {
            status: 'untracked',
            staged: false,
          };
        }
      }
    } catch {
      // In case Git repository is not initialized or error, fallback to clean
      currentGitStatus = { status: 'clean' };
    }

    return {
      artifact,
      outgoingRelationships: rels.outgoing,
      incomingRelationships: rels.incoming,
      gitHistory,
      currentGitStatus,
    };
  }

  async getImpactAnalysis(
    userId: string,
    projectId: string
  ): Promise<ImpactAnalysisResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const now = new Date().toISOString();
    if (!this.gitSvc.isRepoInitialized(projectId)) {
      return { changedCount: 0, impactCount: 0, items: [], generatedAt: now };
    }

    const gitStatus = await this.gitSvc.getStatus(userId, projectId);
    const allProjectArtifacts = await this.artifactRepo.findAllByProjectId(projectId);
    const artifactByPath = new Map(allProjectArtifacts.map((a) => [a.path, a]));
    const artifactById = new Map(allProjectArtifacts.map((a) => [a.id, a]));

    // Map changed files from git status
    const changedArtifacts: Array<{
      artifact: typeof allProjectArtifacts[0];
      changeType: 'modified' | 'added' | 'deleted';
    }> = [];

    const recordedPaths = new Set<string>();

    for (const staged of gitStatus.staged) {
      const art = artifactByPath.get(staged.path);
      if (art && !recordedPaths.has(art.id)) {
        recordedPaths.add(art.id);
        const changeType =
          staged.status === 'untracked'
            ? 'added'
            : staged.status === 'deleted'
            ? 'deleted'
            : 'modified';
        changedArtifacts.push({ artifact: art, changeType });
      }
    }

    for (const unstaged of gitStatus.unstaged) {
      const art = artifactByPath.get(unstaged.path);
      if (art && !recordedPaths.has(art.id)) {
        recordedPaths.add(art.id);
        const changeType =
          unstaged.status === 'deleted' ? 'deleted' : 'modified';
        changedArtifacts.push({ artifact: art, changeType });
      }
    }

    for (const untracked of gitStatus.untracked) {
      const art = artifactByPath.get(untracked.path);
      if (art && !recordedPaths.has(art.id)) {
        recordedPaths.add(art.id);
        changedArtifacts.push({ artifact: art, changeType: 'added' });
      }
    }

    if (changedArtifacts.length === 0) {
      return { changedCount: 0, impactCount: 0, items: [], generatedAt: now };
    }

    // Retrieve all relationships and reviews
    const allRelationships = await this.intelligenceRepo.listRelationshipsByProject(projectId);
    const existingReviews = await this.intelligenceRepo.listImpactReviews(projectId);
    const reviewsMap = new Map(existingReviews.map((r) => [r.impactKey, r]));

    const impactItems: ImpactAnalysisItem[] = [];
    const seenImpactKeys = new Set<string>();

    for (const { artifact: changedArt, changeType } of changedArtifacts) {
      // Find relationships where changedArt is target (i.e., other artifact depends on, tests, documents, or was generated from this changed artifact)
      const incomingToChanged = allRelationships.filter((r) => r.targetArtifactId === changedArt.id);

      for (const rel of incomingToChanged) {
        const affectedArt = artifactById.get(rel.sourceArtifactId);
        if (!affectedArt) continue;

        const impactKey = `${changedArt.id}:${affectedArt.id}:${rel.relationshipType}:incoming`;
        if (seenImpactKeys.has(impactKey)) continue;
        seenImpactKeys.add(impactKey);

        let reason = '';
        let severity: ImpactAnalysisItem['severity'] = 'medium';

        switch (rel.relationshipType) {
          case 'depends_on':
            severity = 'high';
            reason = `Artifact '${affectedArt.name}' depends on ${changeType} artifact '${changedArt.name}'. Interface changes or breaking modifications may impact '${affectedArt.name}'.`;
            break;
          case 'tests':
            severity = 'medium';
            reason = `Test suite '${affectedArt.name}' tests ${changeType} artifact '${changedArt.name}'. Run tests and verify regression coverage.`;
            break;
          case 'documents':
            severity = 'medium';
            reason = `Documentation '${affectedArt.name}' documents ${changeType} artifact '${changedArt.name}'. Review documentation for accurate parameters and usage notes.`;
            break;
          case 'generated_from':
            severity = 'high';
            reason = `Artifact '${affectedArt.name}' was generated from ${changeType} artifact '${changedArt.name}'. Rebuild or re-run generator to synchronize outputs.`;
            break;
          case 'related_to':
          default:
            severity = 'low';
            reason = `Artifact '${affectedArt.name}' is related to ${changeType} artifact '${changedArt.name}'. Recommended review for consistency.`;
            break;
        }

        const review = reviewsMap.get(impactKey);

        impactItems.push({
          impactKey,
          changedArtifact: {
            id: changedArt.id,
            name: changedArt.name,
            path: changedArt.path,
            changeType,
          },
          affectedArtifact: {
            id: affectedArt.id,
            name: affectedArt.name,
            path: affectedArt.path,
            artifactType: affectedArt.artifactType,
          },
          relationshipType: rel.relationshipType,
          direction: 'incoming',
          reason,
          severity,
          status: review ? (review.status as any) : 'active',
          reviewedBy: review?.reviewedBy || null,
          reviewedAt: review?.updatedAt ? review.updatedAt.toISOString() : null,
          notes: review?.notes || null,
        });
      }

      // Find relationships where changedArt is source (i.e., changed artifact points to other artifact)
      const outgoingFromChanged = allRelationships.filter((r) => r.sourceArtifactId === changedArt.id);

      for (const rel of outgoingFromChanged) {
        const targetArt = artifactById.get(rel.targetArtifactId);
        if (!targetArt) continue;

        const impactKey = `${changedArt.id}:${targetArt.id}:${rel.relationshipType}:outgoing`;
        if (seenImpactKeys.has(impactKey)) continue;
        seenImpactKeys.add(impactKey);

        let reason = '';
        let severity: ImpactAnalysisItem['severity'] = 'info';

        switch (rel.relationshipType) {
          case 'depends_on':
            reason = `Changed artifact '${changedArt.name}' depends on '${targetArt.name}'. Verify that dependency contracts and versions remain satisfied.`;
            break;
          case 'tests':
            reason = `Test suite '${changedArt.name}' was ${changeType} for target '${targetArt.name}'.`;
            break;
          case 'documents':
            reason = `Documentation '${changedArt.name}' was ${changeType} for target '${targetArt.name}'.`;
            break;
          case 'generated_from':
            severity = 'medium';
            reason = `Generated artifact '${changedArt.name}' was directly ${changeType}. Note that source generator '${targetArt.name}' was not modified.`;
            break;
          case 'related_to':
          default:
            reason = `Associated artifact '${changedArt.name}' was ${changeType} alongside '${targetArt.name}'.`;
            break;
        }

        const review = reviewsMap.get(impactKey);

        impactItems.push({
          impactKey,
          changedArtifact: {
            id: changedArt.id,
            name: changedArt.name,
            path: changedArt.path,
            changeType,
          },
          affectedArtifact: {
            id: targetArt.id,
            name: targetArt.name,
            path: targetArt.path,
            artifactType: targetArt.artifactType,
          },
          relationshipType: rel.relationshipType,
          direction: 'outgoing',
          reason,
          severity,
          status: review ? (review.status as any) : 'active',
          reviewedBy: review?.reviewedBy || null,
          reviewedAt: review?.updatedAt ? review.updatedAt.toISOString() : null,
          notes: review?.notes || null,
        });
      }
    }

    return {
      changedCount: changedArtifacts.length,
      impactCount: impactItems.length,
      items: impactItems,
      generatedAt: now,
    };
  }

  async updateImpactReview(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<ProjectImpactReview> {
    await this.verifyProjectOwnership(userId, projectId);

    const parseResult = updateImpactReviewSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new IntelligenceValidationError(
        parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          issue: e.message,
        }))
      );
    }

    const input: UpdateImpactReviewInput = parseResult.data;

    const review = await this.intelligenceRepo.upsertImpactReview({
      projectId,
      impactKey: input.impactKey,
      status: input.status,
      reviewedBy: userId,
      notes: input.notes || null,
    });

    await this.recordActivity(
      projectId,
      userId,
      'impact.reviewed',
      'artifact',
      input.impactKey,
      `Marked potential change impact as '${input.status}'`,
      {
        impactKey: input.impactKey,
        status: input.status,
        notes: input.notes || null,
      }
    );

    return review;
  }

  async recordActivity(
    projectId: string,
    actorId: string,
    eventType: string,
    entityType:
      | 'artifact'
      | 'git'
      | 'github'
      | 'relationship'
      | 'task'
      | 'review'
      | 'comment'
      | 'member'
      | 'collaboration'
      | string,
    entityId: string | null,
    summary: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Security sanitation: strictly strip any sensitive fields
      let sanitizedMeta: string | null = null;
      if (metadata) {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(metadata)) {
          if (
            k.toLowerCase().includes('token') ||
            k.toLowerCase().includes('password') ||
            k.toLowerCase().includes('secret') ||
            k.toLowerCase().includes('auth') ||
            k.toLowerCase().includes('key')
          ) {
            continue;
          }
          // Do not store large file content strings
          if (typeof v === 'string' && v.length > 500) {
            clean[k] = `${v.substring(0, 500)}...[truncated]`;
          } else {
            clean[k] = v;
          }
        }
        sanitizedMeta = JSON.stringify(clean);
      }

      await this.intelligenceRepo.recordActivity({
        projectId,
        actorId,
        eventType,
        entityType,
        entityId: entityId || null,
        summary: summary.substring(0, 500),
        metadata: sanitizedMeta,
      });
    } catch (err) {
      // Activity recording should never throw or break main operations
      console.warn(`[IntelligenceService] Failed to record activity for project ${projectId}:`, err);
    }
  }

  async listActivities(
    userId: string,
    projectId: string,
    rawQuery?: unknown
  ): Promise<ActivityItem[]> {
    await this.verifyProjectOwnership(userId, projectId);

    const parseResult = queryActivitiesSchema.safeParse(rawQuery || {});
    const query = parseResult.success
      ? parseResult.data
      : { limit: 50, offset: 0, entityType: undefined };

    const resolvedEntityType =
      query.entityType && query.entityType !== 'all'
        ? query.entityType
        : query.category && query.category !== 'all'
          ? query.category
          : undefined;

    return this.intelligenceRepo.listActivities(
      projectId,
      query.limit ?? 50,
      resolvedEntityType,
      query.offset ?? 0
    );
  }
}

export const intelligenceService = new IntelligenceService();
