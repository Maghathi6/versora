import { z } from 'zod';

const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/;

/**
 * Validates a safe single file or folder name (not a path).
 * Prevents directory traversal and filesystem-illegal characters.
 */
export const artifactNameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(1, 'Name cannot be empty')
  .max(255, 'Name must not exceed 255 characters')
  .refine((name) => name !== '.' && name !== '..', {
    message: "Name cannot be '.' or '..'",
  })
  .refine((name) => !ILLEGAL_FILENAME_CHARS.test(name), {
    message: 'Name contains illegal characters (cannot contain /, \\, :, *, ?, ", <, >, |)',
  });

export const createFolderSchema = z
  .object({
    name: artifactNameSchema,
    parentId: z
      .string()
      .uuid('Parent ID must be a valid UUID')
      .nullable()
      .optional(),
  })
  .strict('Unrecognized fields are not permitted in folder creation payload');

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const createArtifactSchema = z
  .object({
    name: artifactNameSchema,
    parentId: z
      .string()
      .uuid('Parent ID must be a valid UUID')
      .nullable()
      .optional(),
    content: z.string().optional(),
  })
  .strict('Unrecognized fields are not permitted in artifact creation payload');

export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

export const renameArtifactSchema = z
  .object({
    name: artifactNameSchema,
  })
  .strict('Unrecognized fields are not permitted in rename payload');

export type RenameArtifactInput = z.infer<typeof renameArtifactSchema>;

export const moveArtifactSchema = z
  .object({
    targetParentId: z
      .string()
      .uuid('Target parent ID must be a valid UUID')
      .nullable()
      .optional(),
  })
  .strict('Unrecognized fields are not permitted in move payload');

export type MoveArtifactInput = z.infer<typeof moveArtifactSchema>;

export const artifactParamsSchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID'),
  artifactId: z.string().uuid('Artifact ID must be a valid UUID').optional(),
});

export const listArtifactsQuerySchema = z.object({
  parentId: z
    .string()
    .uuid('Parent ID query parameter must be a valid UUID')
    .or(z.literal('null'))
    .or(z.literal(''))
    .optional(),
});

export const updateArtifactContentSchema = z
  .object({
    content: z
      .string({
        required_error: 'Content is required',
        invalid_type_error: 'Content must be a string',
      })
      .max(10 * 1024 * 1024, 'Content must not exceed 10MB'),
  })
  .strict('Unrecognized fields are not permitted in content update payload');

export type UpdateArtifactContentInput = z.infer<typeof updateArtifactContentSchema>;
