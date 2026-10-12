import { z } from 'zod';

/**
 * User Profile Update Validation Schema (PATCH /api/v1/users/me)
 * Permits updates only to displayName, username, and bio.
 * Rejects protected fields (id, email, passwordHash, createdAt, updatedAt) via .strict().
 * Normalizes username and display name consistently with registration schemas.
 */
export const updateProfileSchema = z
  .object({
    displayName: z
      .string({ invalid_type_error: 'Display name must be a string' })
      .trim()
      .min(1, 'Display name cannot be empty')
      .max(128, 'Display name must not exceed 128 characters')
      .optional(),
    username: z
      .string({ invalid_type_error: 'Username must be a string' })
      .trim()
      .min(3, 'Username must be at least 3 characters long')
      .max(30, 'Username must not exceed 30 characters')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain alphanumeric characters, underscores, and hyphens'
      )
      .optional(),
    bio: z
      .string({ invalid_type_error: 'Bio must be a string' })
      .max(500, 'Bio must not exceed 500 characters')
      .nullable()
      .optional(),
  })
  .strict('Protected or unrecognized fields cannot be modified')
  .refine(
    (data) => data.displayName !== undefined || data.username !== undefined || data.bio !== undefined,
    {
      message: 'At least one field (displayName, username, or bio) must be provided for update',
    }
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
