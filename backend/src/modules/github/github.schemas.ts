import { z } from 'zod';

const githubNameRegex = /^[a-zA-Z0-9_.-]+$/;

export const githubOwnerSchema = z
  .string()
  .min(1, 'GitHub owner username/organization is required')
  .max(100, 'GitHub owner cannot exceed 100 characters')
  .regex(githubNameRegex, 'GitHub owner contains invalid characters')
  .refine((val) => !val.startsWith('-') && !val.startsWith('.'), {
    message: 'GitHub owner cannot start with a hyphen or dot',
  });

export const githubRepoNameSchema = z
  .string()
  .min(1, 'GitHub repository name is required')
  .max(100, 'GitHub repository name cannot exceed 100 characters')
  .regex(githubNameRegex, 'GitHub repository name contains invalid characters')
  .refine((val) => !val.startsWith('-') && !val.startsWith('.'), {
    message: 'GitHub repository name cannot start with a hyphen or dot',
  });

export const publishRepositorySchema = z.object({
  name: githubRepoNameSchema,
  description: z.string().max(350, 'Description cannot exceed 350 characters').optional(),
  isPrivate: z.boolean().default(false),
});

export const linkRepositorySchema = z.object({
  owner: githubOwnerSchema,
  repo: githubRepoNameSchema,
});

export const pushOptionsSchema = z.object({
  branch: z.string().min(1).max(100).optional(),
});

export const pullOptionsSchema = z.object({
  branch: z.string().min(1).max(100).optional(),
});

/**
 * Validates that a remote URL strictly matches safe HTTPS GitHub repository format:
 * https://github.com/owner/repo.git or https://github.com/owner/repo
 */
export function validateGitHubRemoteUrl(url: string): { owner: string; repo: string } {
  const trimmed = url.trim();
  const httpsPattern = /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/;
  const match = trimmed.match(httpsPattern);

  if (!match) {
    throw new Error(
      'Invalid remote URL. Versora strictly permits only secure HTTPS GitHub remotes (e.g. https://github.com/owner/repo.git).'
    );
  }

  const owner = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (owner.startsWith('-') || repo.startsWith('-')) {
    throw new Error('GitHub repository owner and name cannot start with a hyphen.');
  }

  return { owner, repo };
}
