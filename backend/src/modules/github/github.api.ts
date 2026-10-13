import { env } from '../../config/env';
import {
  GitHubApiError,
  GitHubNotConfiguredError,
  GitHubForbiddenError,
  GitHubNotFoundError,
} from './github.errors';
import { GitHubUserApiProfile, GitHubRepoApiResponse } from './github.types';

export interface IGitHubApiClient {
  exchangeOAuthCode(code: string, redirectUri: string): Promise<{ accessToken: string; scope: string }>;
  getAuthenticatedUser(token: string): Promise<GitHubUserApiProfile>;
  createRepository(token: string, name: string, description?: string, isPrivate?: boolean): Promise<GitHubRepoApiResponse>;
  getRepository(token: string, owner: string, repo: string): Promise<GitHubRepoApiResponse>;
}

export class GitHubApiClient implements IGitHubApiClient {
  private readonly baseUrl: string;
  private readonly oauthUrl: string;

  constructor(baseUrl = 'https://api.github.com', oauthUrl = 'https://github.com/login/oauth') {
    this.baseUrl = baseUrl;
    this.oauthUrl = oauthUrl;
  }

  /**
   * Exchanges an authorization code for an OAuth access token with GitHub.
   */
  async exchangeOAuthCode(code: string, redirectUri: string): Promise<{ accessToken: string; scope: string }> {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new GitHubNotConfiguredError(
        'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required for GitHub OAuth token exchange.'
      );
    }

    const res = await fetch(`${this.oauthUrl}/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Versora-Application',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      throw new GitHubApiError(`GitHub OAuth token exchange failed with HTTP ${res.status}.`, res.status);
    }

    const data = (await res.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error || !data.access_token) {
      const msg = data.error_description || data.error || 'Failed to exchange authorization code for access token.';
      throw new GitHubApiError(msg, res.status);
    }

    return {
      accessToken: data.access_token,
      scope: data.scope || '',
    };
  }

  /**
   * Retrieves profile of authenticated GitHub user.
   */
  async getAuthenticatedUser(token: string): Promise<GitHubUserApiProfile> {
    const res = await fetch(`${this.baseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Versora-Application',
      },
    });

    if (res.status === 401) {
      throw new GitHubApiError('GitHub access token has expired or been revoked.', 401);
    }

    if (!res.ok) {
      throw new GitHubApiError(`Failed to fetch GitHub user profile (HTTP ${res.status}).`, res.status);
    }

    return (await res.json()) as GitHubUserApiProfile;
  }

  /**
   * Creates a new GitHub repository for the authenticated user.
   */
  async createRepository(
    token: string,
    name: string,
    description?: string,
    isPrivate = false
  ): Promise<GitHubRepoApiResponse> {
    const res = await fetch(`${this.baseUrl}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Versora-Application',
      },
      body: JSON.stringify({
        name,
        description: description || undefined,
        private: isPrivate,
        auto_init: false, // We will push the local repository directly
      }),
    });

    if (res.status === 401) {
      throw new GitHubApiError('GitHub access token has expired or been revoked.', 401);
    }

    if (res.status === 422) {
      const errData = (await res.json().catch(() => ({}))) as { message?: string };
      throw new GitHubApiError(
        errData.message || `A repository with the name '${name}' already exists or name is invalid.`,
        422
      );
    }

    if (!res.ok) {
      throw new GitHubApiError(`Failed to create repository on GitHub (HTTP ${res.status}).`, res.status);
    }

    return (await res.json()) as GitHubRepoApiResponse;
  }

  /**
   * Retrieves metadata and permissions for a specific GitHub repository.
   */
  async getRepository(token: string, owner: string, repo: string): Promise<GitHubRepoApiResponse> {
    const res = await fetch(`${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Versora-Application',
      },
    });

    if (res.status === 404) {
      throw new GitHubNotFoundError(`GitHub repository '${owner}/${repo}' was not found or is inaccessible.`);
    }

    if (res.status === 403) {
      throw new GitHubForbiddenError(`Access denied to GitHub repository '${owner}/${repo}'.`);
    }

    if (res.status === 401) {
      throw new GitHubApiError('GitHub access token has expired or been revoked.', 401);
    }

    if (!res.ok) {
      throw new GitHubApiError(`Failed to inspect GitHub repository (HTTP ${res.status}).`, res.status);
    }

    return (await res.json()) as GitHubRepoApiResponse;
  }
}

export const githubApiClient = new GitHubApiClient();
