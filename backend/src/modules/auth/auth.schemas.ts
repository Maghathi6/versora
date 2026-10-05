import { z } from 'zod';

/**
 * Registration Input Validation Schema
 * Reusable across service boundaries, unit tests, and future HTTP controllers.
 */
export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username must not exceed 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain alphanumeric characters, underscores, and hyphens'
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .max(255, 'Email must not exceed 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name cannot be empty')
    .max(128, 'Display name must not exceed 128 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
