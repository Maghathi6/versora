import { projects } from '../../db/schema/projects';

/**
 * Inferred database model types for projects.
 */
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

/**
 * Payload for updating an existing project.
 */
export interface UpdateProjectData {
  name?: string;
  description?: string | null;
}

/**
 * Serialized representation of a Project for API responses.
 */
export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Formats a project database entity into an API response object.
 */
export function toProjectResponse(project: Project): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    ownerId: project.ownerId,
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : String(project.createdAt),
    updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : String(project.updatedAt),
  };
}
