import { z } from 'zod';

/**
 * Validation schema for creating a project (POST /api/v1/projects).
 */
export const createProjectSchema = z
  .object({
    name: z
      .string({ required_error: 'Project name is required', invalid_type_error: 'Project name must be a string' })
      .trim()
      .min(1, 'Project name cannot be empty')
      .max(128, 'Project name must not exceed 128 characters'),
    description: z
      .string({ invalid_type_error: 'Description must be a string' })
      .max(1000, 'Description must not exceed 1000 characters')
      .nullable()
      .optional(),
  })
  .strict('Unrecognized fields are not permitted in project creation payload');

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Validation schema for updating a project (PATCH /api/v1/projects/:projectId).
 */
export const updateProjectSchema = z
  .object({
    name: z
      .string({ invalid_type_error: 'Project name must be a string' })
      .trim()
      .min(1, 'Project name cannot be empty')
      .max(128, 'Project name must not exceed 128 characters')
      .optional(),
    description: z
      .string({ invalid_type_error: 'Description must be a string' })
      .max(1000, 'Description must not exceed 1000 characters')
      .nullable()
      .optional(),
  })
  .strict('Unrecognized fields are not permitted in project update payload')
  .refine(
    (data) => data.name !== undefined || data.description !== undefined,
    {
      message: 'At least one field (name or description) must be provided for update',
    }
  );

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/**
 * Validation schema for project URL parameters (:projectId).
 */
export const projectIdParamSchema = z.object({
  projectId: z
    .string({ required_error: 'Project ID parameter is required' })
    .uuid('Project ID must be a valid UUID'),
});

export type ProjectIdParam = z.infer<typeof projectIdParamSchema>;
