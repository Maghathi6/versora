import { z } from 'zod';

// Strict Git branch naming regex compliant with git-check-ref-format
export const SAFE_BRANCH_NAME_REGEX = /^(?!\/)(?!.*\/$)(?!.*\.\.)(?!.*@\{)(?!.*[\s~^:?*\[\\@])[a-zA-Z0-9._/-]+$/;

export const createBranchSchema = z.object({
  name: z
    .string({ required_error: 'Branch name is required' })
    .trim()
    .min(1, 'Branch name cannot be empty')
    .max(100, 'Branch name cannot exceed 100 characters')
    .refine((val) => !val.endsWith('.lock'), {
      message: 'Branch name cannot end with .lock',
    })
    .refine((val) => !val.startsWith('-'), {
      message: 'Branch name cannot start with a hyphen',
    })
    .refine((val) => !val.startsWith('.') && !val.endsWith('.'), {
      message: 'Branch name cannot start or end with a dot',
    })
    .refine((val) => !val.includes('//'), {
      message: 'Branch name cannot contain consecutive slashes',
    })
    .refine((val) => SAFE_BRANCH_NAME_REGEX.test(val), {
      message: 'Branch name contains invalid characters. Use letters, numbers, hyphens, underscores, or slashes.',
    }),
  fromCommit: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{4,40}$/, 'Invalid commit hash')
    .optional(),
});

export const switchBranchSchema = z.object({
  branch: z
    .string({ required_error: 'Branch name is required' })
    .trim()
    .min(1, 'Branch name cannot be empty')
    .max(100, 'Branch name cannot exceed 100 characters')
    .refine((val) => !val.startsWith('-'), {
      message: 'Branch name cannot start with a hyphen',
    })
    .refine((val) => SAFE_BRANCH_NAME_REGEX.test(val), {
      message: 'Invalid branch name format',
    }),
});

export const commitSchema = z.object({
  message: z
    .string({ required_error: 'Commit message is required' })
    .trim()
    .min(1, 'Commit message cannot be empty')
    .max(2000, 'Commit message cannot exceed 2000 characters'),
  files: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .refine((p) => !p.includes('..') && !p.startsWith('/') && !p.startsWith('\\'), {
          message: 'Path traversal is not permitted in file list',
        })
    )
    .optional(),
});

export const restoreSchema = z.object({
  commitHash: z
    .string({ required_error: 'Target commit hash is required' })
    .trim()
    .regex(/^[a-fA-F0-9]{4,40}$/, 'Commit hash must be a valid hexadecimal string (4-40 characters)'),
  filePath: z
    .string()
    .trim()
    .refine((p) => !p.includes('..') && !p.startsWith('/') && !p.startsWith('\\'), {
      message: 'Path traversal is not permitted in filePath',
    })
    .optional(),
  mode: z.enum(['file', 'project']).default('project'),
});

export const restorePreviewSchema = z.object({
  commitHash: z
    .string({ required_error: 'Target commit hash is required' })
    .trim()
    .regex(/^[a-fA-F0-9]{4,40}$/, 'Commit hash must be a valid hexadecimal string (4-40 characters)'),
  filePath: z
    .string()
    .trim()
    .refine((p) => !p.includes('..') && !p.startsWith('/') && !p.startsWith('\\'), {
      message: 'Path traversal is not permitted in filePath',
    })
    .optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type SwitchBranchInput = z.infer<typeof switchBranchSchema>;
export type CommitInput = z.infer<typeof commitSchema>;
export type RestoreInput = z.infer<typeof restoreSchema>;
export type RestorePreviewInput = z.infer<typeof restorePreviewSchema>;
