import { z } from 'zod';

export const RELATIONSHIP_TYPES = [
  'depends_on',
  'documents',
  'tests',
  'generated_from',
  'related_to',
] as const;

export const createRelationshipSchema = z
  .object({
    sourceArtifactId: z
      .string({ required_error: 'sourceArtifactId is required' })
      .uuid('sourceArtifactId must be a valid UUID'),
    targetArtifactId: z
      .string({ required_error: 'targetArtifactId is required' })
      .uuid('targetArtifactId must be a valid UUID'),
    relationshipType: z.enum(RELATIONSHIP_TYPES, {
      errorMap: () => ({
        message: `relationshipType must be one of: ${RELATIONSHIP_TYPES.join(', ')}`,
      }),
    }),
    description: z
      .string()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .nullable(),
  })
  .strict();

export const updateImpactReviewSchema = z
  .object({
    impactKey: z
      .string({ required_error: 'impactKey is required' })
      .min(1, 'impactKey cannot be empty')
      .max(255, 'impactKey cannot exceed 255 characters'),
    status: z.enum(['reviewed', 'dismissed'], {
      errorMap: () => ({ message: "status must be either 'reviewed' or 'dismissed'" }),
    }),
    notes: z
      .string()
      .max(500, 'Notes cannot exceed 500 characters')
      .optional()
      .nullable(),
  })
  .strict();

export const queryActivitiesSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
  entityType: z.enum(['all', 'artifact', 'git', 'github', 'relationship']).optional(),
  category: z.enum(['all', 'artifact', 'git', 'github', 'relationship']).optional(),
});

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
export type UpdateImpactReviewInput = z.infer<typeof updateImpactReviewSchema>;
export type QueryActivitiesInput = z.infer<typeof queryActivitiesSchema>;
