import { eq, and, or, desc, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  artifactRelationships,
  projectActivities,
  projectImpactReviews,
  ArtifactRelationship,
  NewArtifactRelationship,
  ProjectActivity,
  NewProjectActivity,
  ProjectImpactReview,
  NewProjectImpactReview,
} from '../../db/schema/intelligence';
import { artifacts } from '../../db/schema/artifacts';
import { users } from '../../db/schema/users';
import { ArtifactRelationshipSummary, ActivityItem } from './intelligence.types';

export interface IIntelligenceRepository {
  createRelationship(data: NewArtifactRelationship): Promise<ArtifactRelationship>;
  findRelationshipById(id: string): Promise<ArtifactRelationship | null>;
  findRelationship(
    projectId: string,
    sourceArtifactId: string,
    targetArtifactId: string,
    relationshipType: string
  ): Promise<ArtifactRelationship | null>;
  deleteRelationship(id: string): Promise<boolean>;
  listRelationshipsByProject(projectId: string): Promise<ArtifactRelationshipSummary[]>;
  listRelationshipsForArtifact(
    projectId: string,
    artifactId: string
  ): Promise<{ outgoing: ArtifactRelationshipSummary[]; incoming: ArtifactRelationshipSummary[] }>;
  recordActivity(data: NewProjectActivity): Promise<ProjectActivity>;
  listActivities(
    projectId: string,
    limit?: number,
    entityType?: string,
    offset?: number
  ): Promise<ActivityItem[]>;
  upsertImpactReview(data: NewProjectImpactReview): Promise<ProjectImpactReview>;
  listImpactReviews(projectId: string): Promise<ProjectImpactReview[]>;
}

export const intelligenceRepository: IIntelligenceRepository = {
  async createRelationship(data: NewArtifactRelationship): Promise<ArtifactRelationship> {
    const rows = await db.insert(artifactRelationships).values(data).returning();
    return rows[0];
  },

  async findRelationshipById(id: string): Promise<ArtifactRelationship | null> {
    const rows = await db
      .select()
      .from(artifactRelationships)
      .where(eq(artifactRelationships.id, id))
      .limit(1);
    return rows[0] || null;
  },

  async findRelationship(
    projectId: string,
    sourceArtifactId: string,
    targetArtifactId: string,
    relationshipType: string
  ): Promise<ArtifactRelationship | null> {
    const rows = await db
      .select()
      .from(artifactRelationships)
      .where(
        and(
          eq(artifactRelationships.projectId, projectId),
          eq(artifactRelationships.sourceArtifactId, sourceArtifactId),
          eq(artifactRelationships.targetArtifactId, targetArtifactId),
          eq(artifactRelationships.relationshipType, relationshipType)
        )
      )
      .limit(1);
    return rows[0] || null;
  },

  async deleteRelationship(id: string): Promise<boolean> {
    const rows = await db
      .delete(artifactRelationships)
      .where(eq(artifactRelationships.id, id))
      .returning({ id: artifactRelationships.id });
    return rows.length > 0;
  },

  async listRelationshipsByProject(projectId: string): Promise<ArtifactRelationshipSummary[]> {
    const rows = await db
      .select({
        rel: artifactRelationships,
        src: {
          id: artifacts.id,
          name: artifacts.name,
          path: artifacts.path,
          type: artifacts.type,
          artifactType: artifacts.artifactType,
        },
      })
      .from(artifactRelationships)
      .leftJoin(artifacts, eq(artifactRelationships.sourceArtifactId, artifacts.id))
      .where(eq(artifactRelationships.projectId, projectId))
      .orderBy(desc(artifactRelationships.createdAt));

    // Also fetch target artifacts in a map for clean hydration
    const allProjectArtifacts = await db
      .select({
        id: artifacts.id,
        name: artifacts.name,
        path: artifacts.path,
        type: artifacts.type,
        artifactType: artifacts.artifactType,
      })
      .from(artifacts)
      .where(eq(artifacts.projectId, projectId));

    const artifactMap = new Map(allProjectArtifacts.map((a) => [a.id, a]));

    return rows.map((r) => ({
      id: r.rel.id,
      projectId: r.rel.projectId,
      sourceArtifactId: r.rel.sourceArtifactId,
      targetArtifactId: r.rel.targetArtifactId,
      relationshipType: r.rel.relationshipType as any,
      description: r.rel.description,
      createdAt: r.rel.createdAt.toISOString(),
      updatedAt: r.rel.updatedAt.toISOString(),
      sourceArtifact: artifactMap.get(r.rel.sourceArtifactId) || undefined,
      targetArtifact: artifactMap.get(r.rel.targetArtifactId) || undefined,
    }));
  },

  async listRelationshipsForArtifact(
    projectId: string,
    artifactId: string
  ): Promise<{ outgoing: ArtifactRelationshipSummary[]; incoming: ArtifactRelationshipSummary[] }> {
    const allProjectRels = await this.listRelationshipsByProject(projectId);
    const outgoing = allProjectRels.filter((r) => r.sourceArtifactId === artifactId);
    const incoming = allProjectRels.filter((r) => r.targetArtifactId === artifactId);
    return { outgoing, incoming };
  },

  async recordActivity(data: NewProjectActivity): Promise<ProjectActivity> {
    const rows = await db.insert(projectActivities).values(data).returning();
    return rows[0];
  },

  async listActivities(
    projectId: string,
    limit: number = 50,
    entityType?: string,
    offset: number = 0
  ): Promise<ActivityItem[]> {
    const conditions = [eq(projectActivities.projectId, projectId)];
    if (entityType && entityType !== 'all') {
      conditions.push(eq(projectActivities.entityType, entityType));
    }

    const rows = await db
      .select({
        activity: projectActivities,
        user: {
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(projectActivities)
      .leftJoin(users, eq(projectActivities.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(projectActivities.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => {
      let parsedMeta: Record<string, unknown> | null = null;
      if (r.activity.metadata) {
        try {
          parsedMeta = JSON.parse(r.activity.metadata);
        } catch {
          parsedMeta = { raw: r.activity.metadata };
        }
      }

      return {
        id: r.activity.id,
        projectId: r.activity.projectId,
        actorId: r.activity.actorId,
        actorUsername: r.user?.username || undefined,
        actorDisplayName: r.user?.displayName || undefined,
        eventType: r.activity.eventType,
        entityType: r.activity.entityType as any,
        entityId: r.activity.entityId,
        summary: r.activity.summary,
        metadata: parsedMeta,
        createdAt: r.activity.createdAt.toISOString(),
      };
    });
  },

  async upsertImpactReview(data: NewProjectImpactReview): Promise<ProjectImpactReview> {
    const rows = await db
      .insert(projectImpactReviews)
      .values(data)
      .onConflictDoUpdate({
        target: [projectImpactReviews.projectId, projectImpactReviews.impactKey],
        set: {
          status: data.status,
          reviewedBy: data.reviewedBy,
          notes: data.notes,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return rows[0];
  },

  async listImpactReviews(projectId: string): Promise<ProjectImpactReview[]> {
    return db
      .select()
      .from(projectImpactReviews)
      .where(eq(projectImpactReviews.projectId, projectId));
  },
};
