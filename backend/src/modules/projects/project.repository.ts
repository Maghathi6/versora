import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db';
import { projects } from '../../db/schema/projects';
import { Project, NewProject, UpdateProjectData } from './project.types';

export interface IProjectRepository {
  create(data: NewProject): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findByOwnerId(ownerId: string): Promise<Project[]>;
  findByOwnerAndName(ownerId: string, name: string): Promise<Project | null>;
  update(id: string, data: UpdateProjectData): Promise<Project | null>;
  delete(id: string): Promise<boolean>;
}

export const projectRepository: IProjectRepository = {
  /**
   * Inserts a new project into PostgreSQL and returns the created record.
   */
  async create(data: NewProject): Promise<Project> {
    const rows = await db
      .insert(projects)
      .values({
        name: data.name.trim(),
        description: data.description ? data.description.trim() : null,
        ownerId: data.ownerId,
      })
      .returning();
    return rows[0];
  },

  /**
   * Finds a project by its primary UUID.
   */
  async findById(id: string): Promise<Project | null> {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return rows[0] || null;
  },

  /**
   * Lists all projects owned by a specific user, sorted from newest to oldest.
   */
  async findByOwnerId(ownerId: string): Promise<Project[]> {
    return db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, ownerId))
      .orderBy(desc(projects.createdAt));
  },

  /**
   * Finds an existing project owned by a user matching the specified name (case-insensitive).
   */
  async findByOwnerAndName(ownerId: string, name: string): Promise<Project | null> {
    const trimmed = name.trim();
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.ownerId, ownerId),
          sql`lower(${projects.name}) = lower(${trimmed})`
        )
      )
      .limit(1);
    return rows[0] || null;
  },

  /**
   * Updates name or description of an existing project and sets updatedAt.
   */
  async update(id: string, data: UpdateProjectData): Promise<Project | null> {
    const updatePayload: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) {
      updatePayload.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updatePayload.description = data.description === null ? null : data.description.trim();
    }

    const rows = await db
      .update(projects)
      .set(updatePayload)
      .where(eq(projects.id, id))
      .returning();
    return rows[0] || null;
  },

  /**
   * Permanently deletes a project from the database.
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    return result.length > 0;
  },
};
