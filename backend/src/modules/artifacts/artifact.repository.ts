import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { artifacts } from '../../db/schema/artifacts';
import { Artifact, NewArtifact } from './artifact.types';

export interface ProjectStats {
  totalFiles: number;
  totalFolders: number;
  totalSizeBytes: number;
}

export interface IArtifactRepository {
  create(data: NewArtifact): Promise<Artifact>;
  findById(id: string): Promise<Artifact | null>;
  findByProjectAndParent(projectId: string, parentId: string | null): Promise<Artifact[]>;
  findByProjectAndName(projectId: string, parentId: string | null, name: string): Promise<Artifact | null>;
  findAllByProjectId(projectId: string): Promise<Artifact[]>;
  findDescendants(folderId: string): Promise<Artifact[]>;
  update(id: string, data: Partial<NewArtifact>): Promise<Artifact | null>;
  delete(id: string): Promise<boolean>;
  deleteMany(ids: string[]): Promise<number>;
  getStatsByProject(projectId: string): Promise<ProjectStats>;
}

export const artifactRepository: IArtifactRepository = {
  async create(data: NewArtifact): Promise<Artifact> {
    const rows = await db
      .insert(artifacts)
      .values({
        ...data,
        name: data.name.trim(),
        path: data.path.trim(),
      })
      .returning();
    return rows[0];
  },

  async findById(id: string): Promise<Artifact | null> {
    const rows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, id))
      .limit(1);
    return rows[0] || null;
  },

  async findByProjectAndParent(projectId: string, parentId: string | null): Promise<Artifact[]> {
    const parentCondition = parentId ? eq(artifacts.parentId, parentId) : isNull(artifacts.parentId);

    const rows = await db
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.projectId, projectId), parentCondition))
      .orderBy(
        sql`CASE WHEN ${artifacts.type} = 'folder' THEN 0 ELSE 1 END`,
        sql`lower(${artifacts.name}) ASC`
      );

    return rows;
  },

  async findByProjectAndName(
    projectId: string,
    parentId: string | null,
    name: string
  ): Promise<Artifact | null> {
    const trimmed = name.trim();
    const parentCondition = parentId ? eq(artifacts.parentId, parentId) : isNull(artifacts.parentId);

    const rows = await db
      .select()
      .from(artifacts)
      .where(
        and(
          eq(artifacts.projectId, projectId),
          parentCondition,
          sql`lower(${artifacts.name}) = lower(${trimmed})`
        )
      )
      .limit(1);

    return rows[0] || null;
  },

  async findAllByProjectId(projectId: string): Promise<Artifact[]> {
    return db
      .select()
      .from(artifacts)
      .where(eq(artifacts.projectId, projectId))
      .orderBy(sql`lower(${artifacts.name}) ASC`);
  },

  /**
   * Retrieves all descendant artifacts (files and subfolders) beneath a given folder using a recursive CTE.
   */
  async findDescendants(folderId: string): Promise<Artifact[]> {
    const query = sql`
      WITH RECURSIVE item_tree AS (
        SELECT * FROM ${artifacts} WHERE ${artifacts.parentId} = ${folderId}
        UNION ALL
        SELECT a.* FROM ${artifacts} a
        INNER JOIN item_tree it ON a.${sql.identifier('parent_id')} = it.${sql.identifier('id')}
      )
      SELECT * FROM item_tree;
    `;

    const result = await db.execute(query);
    return (result.rows as unknown) as Artifact[];
  },

  async update(id: string, data: Partial<NewArtifact>): Promise<Artifact | null> {
    const updatePayload: Partial<typeof artifacts.$inferInsert> = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.path !== undefined) updatePayload.path = data.path.trim();

    const rows = await db
      .update(artifacts)
      .set(updatePayload)
      .where(eq(artifacts.id, id))
      .returning();

    return rows[0] || null;
  },

  async delete(id: string): Promise<boolean> {
    const rows = await db
      .delete(artifacts)
      .where(eq(artifacts.id, id))
      .returning({ id: artifacts.id });
    return rows.length > 0;
  },

  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await db
      .delete(artifacts)
      .where(inArray(artifacts.id, ids))
      .returning({ id: artifacts.id });
    return rows.length;
  },

  async getStatsByProject(projectId: string): Promise<ProjectStats> {
    const rows = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.projectId, projectId));

    let totalFiles = 0;
    let totalFolders = 0;
    let totalSizeBytes = 0;

    for (const r of rows) {
      if (r.type === 'folder') {
        totalFolders++;
      } else {
        totalFiles++;
        totalSizeBytes += Number(r.sizeBytes);
      }
    }

    return { totalFiles, totalFolders, totalSizeBytes };
  },
};
