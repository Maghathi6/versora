import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { env } from '../../config/env';
import { intelligenceRepository } from '../intelligence/intelligence.repository';
import { IGitHubRepository, githubRepository } from './github.repository';
import { IProjectRepository, projectRepository } from '../projects/project.repository';
import { IArtifactRepository, artifactRepository } from '../artifacts/artifact.repository';
import { IUserRepository, userRepository } from '../users/user.repository';
import { IStorageDriver } from '../../storage/storage.interface';
import { localStorageDriver } from '../../storage/local.storage';
import { GitRunner, gitRunner } from '../git/git.runner';
import { ProjectLockManager, projectLockManager } from '../git/git.lock';
import { IGitHubApiClient, githubApiClient } from './github.api';
import { reconcileProjectArtifacts } from '../git/git.reconciler';
import { encryptToken, decryptToken } from './github.crypto';
import {
  GitHubOAuthStatusResponse,
  GitHubAuthorizeResponse,
  GitHubCallbackResult,
  GitHubRemoteStatusResponse,
  GitHubPublishInput,
  GitHubLinkInput,
  GitHubPushResult,
  GitHubFetchResult,
  GitHubPullResult,
  GitHubCommitSummary,
  GitHubRemoteInfo,
} from './github.types';
import {
  GitHubNotConfiguredError,
  GitHubAuthRequiredError,
  GitHubOAuthStateError,
  GitHubSyncConflictError,
  GitHubValidationError,
  GitHubForbiddenError,
  GitHubNotFoundError,
} from './github.errors';
import {
  publishRepositorySchema,
  linkRepositorySchema,
  validateGitHubRemoteUrl,
} from './github.schemas';
import { ProjectForbiddenError, ProjectNotFoundError } from '../projects/project.errors';
import { GitRepositoryNotInitializedError } from '../git/git.errors';

/**
 * Strips sensitive tokens and authenticated URL credentials from Git error strings and logs.
 */
export function redactGitHubCredentials(text: string): string {
  if (!text) return '';
  return text
    .replace(/(https?:\/\/)[^@/\s]+@/g, '$1***@')
    .replace(/x-access-token:[^@/\s]+/gi, 'x-access-token:***')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_***')
    .replace(/github_pat_[a-zA-Z0-9_]{50,}/g, 'github_pat_***')
    .replace(/authorization:\s*basic\s+[a-zA-Z0-9+=/]+/gi, 'Authorization: Basic ***')
    .replace(/authorization:\s*bearer\s+[a-zA-Z0-9_.-]+/gi, 'Authorization: Bearer ***');
}

export class GitHubService {
  constructor(
    private readonly githubRepo: IGitHubRepository = githubRepository,
    private readonly projectRepo: IProjectRepository = projectRepository,
    private readonly artifactRepo: IArtifactRepository = artifactRepository,
    private readonly userRepo: IUserRepository = userRepository,
    private readonly storage: IStorageDriver = localStorageDriver,
    private readonly git: GitRunner = gitRunner,
    private readonly locks: ProjectLockManager = projectLockManager,
    private readonly api: IGitHubApiClient = githubApiClient,
    private readonly reposRoot: string = env.GIT_REPOS_ROOT
  ) {}

  /**
   * Derives a safe, canonical server-controlled repository path for a project.
   */
  private getProjectRepoPath(projectId: string): string {
    const cleanId = path.basename(projectId.trim());
    return path.resolve(this.reposRoot, cleanId);
  }

  /**
   * Verifies that the authenticated user owns the given project.
   */
  private async verifyProjectOwnership(userId: string, projectId: string): Promise<void> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }
    if (project.ownerId !== userId) {
      throw new ProjectForbiddenError();
    }
  }

  /**
   * Checks whether the local Git repository exists for this project.
   */
  private isRepoInitialized(projectId: string): boolean {
    const repoPath = this.getProjectRepoPath(projectId);
    return fs.existsSync(path.join(repoPath, '.git'));
  }

  /**
   * Retrieves and decrypts the user's stored GitHub OAuth access token.
   */
  private async getDecryptedTokenForUser(userId: string): Promise<string> {
    const account = await this.githubRepo.findAccountByUserId(userId);
    if (!account) {
      throw new GitHubAuthRequiredError();
    }
    return decryptToken({
      encrypted: account.encryptedAccessToken,
      iv: account.tokenIv,
      tag: account.tokenTag,
    });
  }

  /**
   * Constructs arguments to supply authenticated credentials in-memory for Git commands.
   * Never embeds tokens in remote URLs or writes them to .git/config on disk.
   */
  private getAuthArgs(token: string): string[] {
    const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
    return [
      '-c',
      `http.extraHeader=Authorization: Basic ${basic}`,
      '-c',
      `http.https://github.com/.extraHeader=Authorization: Basic ${basic}`,
      '-c',
      'credential.helper=',
    ];
  }

  /**
   * Translates Git remote execution failures into safe, actionable domain errors without leaking tokens.
   */
  private handleRemoteGitError(
    rawError: unknown,
    operation: 'publish' | 'push' | 'fetch' | 'pull' | 'link',
    branch?: string
  ): never {
    const err = rawError as { stderr?: string; stdout?: string; message?: string };
    const rawText = (err.stderr || err.stdout || err.message || '').trim();
    const errText = redactGitHubCredentials(rawText);

    if (
      errText.includes('could not read Username') ||
      errText.includes('terminal prompts disabled') ||
      errText.includes('Authentication failed') ||
      errText.includes('Invalid credentials') ||
      errText.includes('Bad credentials') ||
      errText.includes('401 Unauthorized') ||
      errText.includes('HTTP 401')
    ) {
      throw new GitHubAuthRequiredError(
        'GitHub authentication failed. Your access token is missing, expired, revoked, or lacks permission to access this repository. Please reconnect your GitHub account in Settings.'
      );
    }

    if (
      (errText.includes('Permission to') && errText.includes('denied')) ||
      errText.includes('Write access to repository not granted') ||
      errText.includes('403 Forbidden') ||
      errText.includes('HTTP 403')
    ) {
      throw new GitHubForbiddenError(
        'Permission denied: You do not have write access to this GitHub repository. Ensure your connected GitHub account has write permissions.'
      );
    }

    if (
      errText.includes('Repository not found') ||
      errText.includes('Not Found') ||
      errText.includes('404')
    ) {
      throw new GitHubNotFoundError(
        'GitHub repository was not found. Please verify the repository exists on GitHub and that your account has access to it.'
      );
    }

    if (
      errText.includes('rejected') ||
      errText.includes('fetch first') ||
      errText.includes('non-fast-forward')
    ) {
      throw new GitHubSyncConflictError(
        'Push rejected by GitHub: The remote contains commits that you do not have locally. Please pull/synchronize incoming changes first.'
      );
    }

    throw new GitHubSyncConflictError(`Git ${operation} failed: ${errText}`);
  }

  /**
   * Returns current GitHub OAuth configuration and connection status for the user.
   */
  async getOAuthStatus(userId: string): Promise<GitHubOAuthStatusResponse> {
    const isConfigured = Boolean(
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_TOKEN_ENCRYPTION_KEY
    );

    if (!isConfigured) {
      return {
        isConfigured: false,
        isConnected: false,
        account: null,
      };
    }

    const account = await this.githubRepo.findAccountByUserId(userId);
    if (!account) {
      return {
        isConfigured: true,
        isConnected: false,
        account: null,
      };
    }

    return {
      isConfigured: true,
      isConnected: true,
      account: {
        username: account.githubUsername,
        avatarUrl: account.avatarUrl,
        scope: account.scope,
        connectedAt: account.createdAt.toISOString(),
      },
    };
  }

  /**
   * Generates a GitHub OAuth authorization URL with CSRF state protection.
   */
  async generateAuthorizeUrl(userId: string, returnTo?: string): Promise<GitHubAuthorizeResponse> {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_TOKEN_ENCRYPTION_KEY) {
      throw new GitHubNotConfiguredError();
    }

    const state = crypto.randomBytes(32).toString('hex');
    await this.githubRepo.createOAuthState(userId, state, returnTo, 10);

    const redirectUri = encodeURIComponent(env.GITHUB_CALLBACK_URL);
    const scope = encodeURIComponent('repo');
    const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    return {
      authorizeUrl,
      state,
    };
  }

  /**
   * Handles GitHub OAuth callback, exchanges code for token, encrypts token, and persists account.
   */
  async handleOAuthCallback(code: string, state: string): Promise<GitHubCallbackResult> {
    const stateRecord = await this.githubRepo.consumeOAuthState(state);
    if (!stateRecord) {
      throw new GitHubOAuthStateError();
    }

    const { accessToken, scope } = await this.api.exchangeOAuthCode(code, env.GITHUB_CALLBACK_URL);
    const profile = await this.api.getAuthenticatedUser(accessToken);
    const encrypted = encryptToken(accessToken);

    await this.githubRepo.upsertAccount({
      userId: stateRecord.userId,
      githubUserId: String(profile.id),
      githubUsername: profile.login,
      encryptedAccessToken: encrypted.encrypted,
      tokenIv: encrypted.iv,
      tokenTag: encrypted.tag,
      scope: scope || 'repo',
      avatarUrl: profile.avatar_url || null,
    });

    return {
      username: profile.login,
      returnTo: stateRecord.returnTo,
    };
  }

  /**
   * Disconnects the user's GitHub account and deletes encrypted credentials.
   */
  async disconnectAccount(userId: string): Promise<{ success: boolean; message: string }> {
    const deleted = await this.githubRepo.deleteAccountByUserId(userId);
    return {
      success: deleted,
      message: deleted
        ? 'GitHub account disconnected successfully.'
        : 'No connected GitHub account was found.',
    };
  }

  /**
   * Inspects detailed synchronization status between local Git repo and linked GitHub remote.
   */
  async getProjectRemoteStatus(userId: string, projectId: string): Promise<GitHubRemoteStatusResponse> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const remoteRecord = await this.githubRepo.findRemoteByProjectId(projectId);

    return this.locks.withLock(projectId, async () => {
      // 1. Get current branch
      const branchRes = await this.git.run(['branch', '--show-current'], repoPath);
      const localBranch = branchRes.stdout.trim() || 'main';

      // 2. Check uncommitted changes
      const statusRes = await this.git.run(['status', '--porcelain=v1'], repoPath);
      const hasUncommittedChanges = statusRes.stdout.trim().length > 0;

      if (!remoteRecord) {
        return {
          isLinked: false,
          remote: null,
          localBranch,
          remoteBranch: null,
          isTracking: false,
          ahead: 0,
          behind: 0,
          isDiverged: false,
          hasUncommittedChanges,
          outgoingCommits: [],
          incomingCommits: [],
          syncState: 'not_linked',
          lastSyncError: null,
        };
      }

      const remoteInfo: GitHubRemoteInfo = {
        id: remoteRecord.id,
        projectId: remoteRecord.projectId,
        owner: remoteRecord.githubOwner,
        repo: remoteRecord.githubRepoName,
        remoteUrl: remoteRecord.remoteUrl,
        isPrivate: remoteRecord.isPrivate,
        defaultBranch: remoteRecord.defaultBranch,
        lastFetchedAt: remoteRecord.lastFetchedAt ? remoteRecord.lastFetchedAt.toISOString() : null,
        lastPushedAt: remoteRecord.lastPushedAt ? remoteRecord.lastPushedAt.toISOString() : null,
        lastPulledAt: remoteRecord.lastPulledAt ? remoteRecord.lastPulledAt.toISOString() : null,
      };

      const remoteTrackingBranch = `origin/${localBranch}`;
      const revCheck = await this.git.run(
        ['rev-parse', '--verify', `refs/remotes/${remoteTrackingBranch}`],
        repoPath,
        { allowNonZeroExit: true }
      );

      // If remote tracking ref does not exist yet (e.g. freshly linked or not yet fetched)
      if (revCheck.exitCode !== 0) {
        // Collect local unpushed commits
        const localLog = await this.git.run(
          ['log', '-n', '10', '--format=%H%x00%h%x00%s%x00%aI%x00%an', localBranch],
          repoPath,
          { allowNonZeroExit: true }
        );
        const outgoingCommits = this.parseCommitSummaries(localLog.stdout);

        return {
          isLinked: true,
          remote: remoteInfo,
          localBranch,
          remoteBranch: null,
          isTracking: false,
          ahead: outgoingCommits.length,
          behind: 0,
          isDiverged: false,
          hasUncommittedChanges,
          outgoingCommits,
          incomingCommits: [],
          syncState: 'untracked',
          lastSyncError: null,
        };
      }

      // Check ahead and behind counts: git rev-list --left-right --count local...remote
      const countRes = await this.git.run(
        ['rev-list', '--left-right', '--count', `${localBranch}...${remoteTrackingBranch}`],
        repoPath,
        { allowNonZeroExit: true }
      );

      let ahead = 0;
      let behind = 0;
      if (countRes.exitCode === 0) {
        const parts = countRes.stdout.trim().split(/\s+/);
        ahead = parseInt(parts[0], 10) || 0;
        behind = parseInt(parts[1], 10) || 0;
      }

      const isDiverged = ahead > 0 && behind > 0;

      // Collect outgoing commits
      let outgoingCommits: GitHubCommitSummary[] = [];
      if (ahead > 0) {
        const outLog = await this.git.run(
          ['log', '-n', '10', '--format=%H%x00%h%x00%s%x00%aI%x00%an', `${remoteTrackingBranch}..${localBranch}`],
          repoPath,
          { allowNonZeroExit: true }
        );
        outgoingCommits = this.parseCommitSummaries(outLog.stdout);
      }

      // Collect incoming commits
      let incomingCommits: GitHubCommitSummary[] = [];
      if (behind > 0) {
        const inLog = await this.git.run(
          ['log', '-n', '10', '--format=%H%x00%h%x00%s%x00%aI%x00%an', `${localBranch}..${remoteTrackingBranch}`],
          repoPath,
          { allowNonZeroExit: true }
        );
        incomingCommits = this.parseCommitSummaries(inLog.stdout);
      }

      let syncState: GitHubRemoteStatusResponse['syncState'] = 'in_sync';
      if (hasUncommittedChanges) {
        syncState = 'uncommitted_changes';
      } else if (isDiverged) {
        syncState = 'diverged';
      } else if (ahead > 0) {
        syncState = 'ahead';
      } else if (behind > 0) {
        syncState = 'behind';
      }

      return {
        isLinked: true,
        remote: remoteInfo,
        localBranch,
        remoteBranch: remoteTrackingBranch,
        isTracking: true,
        ahead,
        behind,
        isDiverged,
        hasUncommittedChanges,
        outgoingCommits,
        incomingCommits,
        syncState,
        lastSyncError: null,
      };
    });
  }

  /**
   * Publishes the local repository to a new GitHub repository created under user's account.
   */
  async publishRepository(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<{ remote: GitHubRemoteInfo; message: string }> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const parseResult = publishRepositorySchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new GitHubValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: GitHubPublishInput = parseResult.data;

    // Verify user has connected GitHub account
    const token = await this.getDecryptedTokenForUser(userId);

    const existingRemote = await this.githubRepo.findRemoteByProjectId(projectId);
    if (existingRemote) {
      throw new GitHubSyncConflictError(
        `This project is already linked to '${existingRemote.githubOwner}/${existingRemote.githubRepoName}'. Unlink the existing remote before publishing.`
      );
    }

    // 1. Create remote repository via GitHub API
    const repoRes = await this.api.createRepository(token, input.name, input.description, input.isPrivate);
    const remoteUrl = `https://github.com/${repoRes.owner.login}/${repoRes.name}.git`;

    return this.locks.withLock(projectId, async () => {
      // 2. Set or add remote origin in local git repo
      const remoteCheck = await this.git.run(['remote'], repoPath);
      const hasOrigin = remoteCheck.stdout.split('\n').some((r) => r.trim() === 'origin');

      if (hasOrigin) {
        await this.git.run(['remote', 'set-url', 'origin', remoteUrl], repoPath);
      } else {
        await this.git.run(['remote', 'add', 'origin', remoteUrl], repoPath);
      }

      // 3. Get current local branch
      const branchRes = await this.git.run(['branch', '--show-current'], repoPath);
      const branch = branchRes.stdout.trim() || 'main';

      // 4. Push local branch to new GitHub remote using in-memory credentials
      const authArgs = this.getAuthArgs(token);
      try {
        await this.git.run([...authArgs, 'push', '-u', 'origin', branch], repoPath);
      } catch (err: unknown) {
        await intelligenceRepository
          .recordActivity({
            projectId,
            actorId: userId,
            eventType: 'github.sync_failed',
            entityType: 'github',
            entityId: null,
            summary: `GitHub publish failed on branch '${branch}'`,
            metadata: JSON.stringify({
              branch,
              operation: 'publish',
              owner: repoRes.owner.login,
              repo: repoRes.name,
            }),
          })
          .catch(() => {});
        this.handleRemoteGitError(err, 'publish', branch);
      }

      // 5. Persist remote link in database
      const created = await this.githubRepo.upsertRemote({
        projectId,
        githubOwner: repoRes.owner.login,
        githubRepoName: repoRes.name,
        remoteUrl,
        isPrivate: repoRes.private,
        defaultBranch: repoRes.default_branch || branch,
        lastPushedAt: new Date(),
        lastFetchedAt: new Date(),
      });

      await intelligenceRepository
        .recordActivity({
          projectId,
          actorId: userId,
          eventType: 'github.published',
          entityType: 'github',
          entityId: created.id,
          summary: `Published project repository to GitHub as '${repoRes.owner.login}/${repoRes.name}'`,
          metadata: JSON.stringify({
            owner: repoRes.owner.login,
            repo: repoRes.name,
            remoteUrl: created.remoteUrl,
            isPrivate: created.isPrivate,
            defaultBranch: created.defaultBranch,
          }),
        })
        .catch(() => {});

      return {
        remote: {
          id: created.id,
          projectId: created.projectId,
          owner: created.githubOwner,
          repo: created.githubRepoName,
          remoteUrl: created.remoteUrl,
          isPrivate: created.isPrivate,
          defaultBranch: created.defaultBranch,
          lastFetchedAt: created.lastFetchedAt ? created.lastFetchedAt.toISOString() : null,
          lastPushedAt: created.lastPushedAt ? created.lastPushedAt.toISOString() : null,
          lastPulledAt: created.lastPulledAt ? created.lastPulledAt.toISOString() : null,
        },
        message: `Published repository to GitHub as '${repoRes.owner.login}/${repoRes.name}'.`,
      };
    });
  }

  /**
   * Connects/links an existing GitHub repository to this Versora project.
   */
  async linkRepository(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<{ remote: GitHubRemoteInfo; message: string }> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const parseResult = linkRepositorySchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new GitHubValidationError(
        parseResult.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message }))
      );
    }
    const input: GitHubLinkInput = parseResult.data;

    // Verify token and inspect repository permissions via GitHub API
    const token = await this.getDecryptedTokenForUser(userId);
    const repoRes = await this.api.getRepository(token, input.owner, input.repo);

    const remoteUrl = `https://github.com/${repoRes.owner.login}/${repoRes.name}.git`;
    validateGitHubRemoteUrl(remoteUrl);

    return this.locks.withLock(projectId, async () => {
      // Configure remote origin
      const remoteCheck = await this.git.run(['remote'], repoPath);
      const hasOrigin = remoteCheck.stdout.split('\n').some((r) => r.trim() === 'origin');

      if (hasOrigin) {
        await this.git.run(['remote', 'set-url', 'origin', remoteUrl], repoPath);
      } else {
        await this.git.run(['remote', 'add', 'origin', remoteUrl], repoPath);
      }

      // Fetch remote metadata safely
      const authArgs = this.getAuthArgs(token);
      const fetchRes = await this.git.run([...authArgs, 'fetch', 'origin'], repoPath, {
        allowNonZeroExit: true,
      });

      if (fetchRes.exitCode !== 0) {
        const errText = (fetchRes.stderr || fetchRes.stdout).trim();
        if (
          errText.includes('could not read Username') ||
          errText.includes('terminal prompts disabled') ||
          errText.includes('Authentication failed') ||
          errText.includes('Invalid credentials') ||
          errText.includes('Permission to') ||
          errText.includes('401') ||
          errText.includes('403')
        ) {
          await this.git.run(['remote', 'remove', 'origin'], repoPath, { allowNonZeroExit: true });
          this.handleRemoteGitError(fetchRes, 'link');
        }
      }

      const saved = await this.githubRepo.upsertRemote({
        projectId,
        githubOwner: repoRes.owner.login,
        githubRepoName: repoRes.name,
        remoteUrl,
        isPrivate: repoRes.private,
        defaultBranch: repoRes.default_branch || 'main',
        lastFetchedAt: new Date(),
      });

      return {
        remote: {
          id: saved.id,
          projectId: saved.projectId,
          owner: saved.githubOwner,
          repo: saved.githubRepoName,
          remoteUrl: saved.remoteUrl,
          isPrivate: saved.isPrivate,
          defaultBranch: saved.defaultBranch,
          lastFetchedAt: saved.lastFetchedAt ? saved.lastFetchedAt.toISOString() : null,
          lastPushedAt: saved.lastPushedAt ? saved.lastPushedAt.toISOString() : null,
          lastPulledAt: saved.lastPulledAt ? saved.lastPulledAt.toISOString() : null,
        },
        message: `Connected to GitHub repository '${repoRes.owner.login}/${repoRes.name}'.`,
      };
    });
  }

  /**
   * Unlinks the GitHub remote from the Versora project.
   */
  async unlinkRepository(userId: string, projectId: string): Promise<{ success: boolean; message: string }> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    return this.locks.withLock(projectId, async () => {
      if (this.isRepoInitialized(projectId)) {
        await this.git.run(['remote', 'remove', 'origin'], repoPath, { allowNonZeroExit: true });
      }

      const deleted = await this.githubRepo.deleteRemoteByProjectId(projectId);
      return {
        success: deleted,
        message: deleted
          ? 'GitHub remote unlinked successfully from project.'
          : 'Project was not linked to any GitHub remote.',
      };
    });
  }

  /**
   * Fetches latest remote state from GitHub without mutating local working tree.
   */
  async fetchRemote(userId: string, projectId: string): Promise<GitHubFetchResult> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const remoteRecord = await this.githubRepo.findRemoteByProjectId(projectId);
    if (!remoteRecord) {
      throw new GitHubNotFoundError('This project is not linked to a remote GitHub repository.');
    }

    const token = await this.getDecryptedTokenForUser(userId);

    return this.locks.withLock(projectId, async () => {
      const authArgs = this.getAuthArgs(token);
      try {
        await this.git.run([...authArgs, 'fetch', 'origin'], repoPath);
      } catch (err: unknown) {
        await intelligenceRepository
          .recordActivity({
            projectId,
            actorId: userId,
            eventType: 'github.sync_failed',
            entityType: 'github',
            entityId: remoteRecord.id,
            summary: 'GitHub fetch failed',
            metadata: JSON.stringify({
              operation: 'fetch',
            }),
          })
          .catch(() => {});
        this.handleRemoteGitError(err, 'fetch');
      }

      await this.githubRepo.updateRemoteTimestamps(projectId, { lastFetchedAt: new Date() });

      const branchRes = await this.git.run(['branch', '--show-current'], repoPath);
      const localBranch = branchRes.stdout.trim() || 'main';
      const remoteBranch = `origin/${localBranch}`;

      const revCheck = await this.git.run(
        ['rev-parse', '--verify', `refs/remotes/${remoteBranch}`],
        repoPath,
        { allowNonZeroExit: true }
      );

      if (revCheck.exitCode !== 0) {
        return {
          remoteBranch: null,
          ahead: 0,
          behind: 0,
          isDiverged: false,
          message: 'Fetched remote references. No upstream branch tracking yet.',
        };
      }

      const countRes = await this.git.run(
        ['rev-list', '--left-right', '--count', `${localBranch}...${remoteBranch}`],
        repoPath
      );
      const parts = countRes.stdout.trim().split(/\s+/);
      const ahead = parseInt(parts[0], 10) || 0;
      const behind = parseInt(parts[1], 10) || 0;
      const isDiverged = ahead > 0 && behind > 0;

      return {
        remoteBranch,
        ahead,
        behind,
        isDiverged,
        message: 'Fetched latest references from GitHub.',
      };
    });
  }

  /**
   * Pushes committed local changes to the configured GitHub remote.
   */
  async push(
    userId: string,
    projectId: string,
    options?: { branch?: string }
  ): Promise<GitHubPushResult> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const remoteRecord = await this.githubRepo.findRemoteByProjectId(projectId);
    if (!remoteRecord) {
      throw new GitHubNotFoundError('This project is not linked to a remote GitHub repository.');
    }

    const token = await this.getDecryptedTokenForUser(userId);

    return this.locks.withLock(projectId, async () => {
      // 1. Detect uncommitted changes: explain that only committed changes can be pushed
      const statusRes = await this.git.run(['status', '--porcelain=v1'], repoPath);
      if (statusRes.stdout.trim().length > 0) {
        throw new GitHubSyncConflictError(
          'You have uncommitted modifications in your workspace. Please click "Save Version" to commit your files before pushing.'
        );
      }

      // 2. Identify target branch
      const branchRes = await this.git.run(['branch', '--show-current'], repoPath);
      const targetBranch = options?.branch || branchRes.stdout.trim() || 'main';

      // 3. Check outgoing commits count before push
      let commitsPushed = 0;
      const countRes = await this.git.run(
        ['rev-list', '--left-right', '--count', `${targetBranch}...origin/${targetBranch}`],
        repoPath,
        { allowNonZeroExit: true }
      );
      if (countRes.exitCode === 0) {
        const parts = countRes.stdout.trim().split(/\s+/);
        commitsPushed = parseInt(parts[0], 10) || 0;
      }

      // 4. Execute git push with in-memory auth header
      const authArgs = this.getAuthArgs(token);
      const pushRes = await this.git.run(
        [...authArgs, 'push', '-u', 'origin', targetBranch],
        repoPath,
        { allowNonZeroExit: true }
      );

      if (pushRes.exitCode !== 0) {
        const errText = pushRes.stderr || pushRes.stdout;
        await intelligenceRepository
          .recordActivity({
            projectId,
            actorId: userId,
            eventType: 'github.sync_failed',
            entityType: 'github',
            entityId: remoteRecord.id,
            summary: `GitHub push failed on branch '${targetBranch}'`,
            metadata: JSON.stringify({
              branch: targetBranch,
              operation: 'push',
              errorSnippet: errText.slice(0, 200).replace(/https:\/\/[^@]+@/g, 'https://***@'),
            }),
          })
          .catch(() => {});

        this.handleRemoteGitError(pushRes, 'push', targetBranch);
      }

      await this.githubRepo.updateRemoteTimestamps(projectId, {
        lastPushedAt: new Date(),
        lastFetchedAt: new Date(),
      });

      await intelligenceRepository
        .recordActivity({
          projectId,
          actorId: userId,
          eventType: 'github.pushed',
          entityType: 'github',
          entityId: remoteRecord.id,
          summary: `Pushed ${commitsPushed || 1} commit(s) to ${remoteRecord.githubOwner}/${remoteRecord.githubRepoName} on branch '${targetBranch}'`,
          metadata: JSON.stringify({
            branch: targetBranch,
            commitsPushed: commitsPushed || 1,
            owner: remoteRecord.githubOwner,
            repo: remoteRecord.githubRepoName,
          }),
        })
        .catch(() => {});

      return {
        branch: targetBranch,
        commitsPushed: commitsPushed || 1,
        remoteUrl: remoteRecord.remoteUrl,
        message: `Successfully pushed changes to ${remoteRecord.githubOwner}/${remoteRecord.githubRepoName} on branch '${targetBranch}'.`,
      };
    });
  }

  /**
   * Safely pulls incoming changes from GitHub with fast-forward guarantees and artifact reconciliation.
   */
  async pull(
    userId: string,
    projectId: string,
    options?: { branch?: string }
  ): Promise<GitHubPullResult> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const remoteRecord = await this.githubRepo.findRemoteByProjectId(projectId);
    if (!remoteRecord) {
      throw new GitHubNotFoundError('This project is not linked to a remote GitHub repository.');
    }

    const token = await this.getDecryptedTokenForUser(userId);

    return this.locks.withLock(projectId, async () => {
      // 1. Guard against dirty working tree: prevent pulling if uncommitted edits exist
      const statusRes = await this.git.run(['status', '--porcelain=v1'], repoPath);
      if (statusRes.stdout.trim().length > 0) {
        throw new GitHubSyncConflictError(
          'Cannot pull remote changes while your workspace contains uncommitted edits. Please save your version or discard edits before syncing.'
        );
      }

      // 2. Identify target branch
      const branchRes = await this.git.run(['branch', '--show-current'], repoPath);
      const targetBranch = options?.branch || branchRes.stdout.trim() || 'main';

      // 3. Fetch remote state
      const authArgs = this.getAuthArgs(token);
      try {
        await this.git.run([...authArgs, 'fetch', 'origin'], repoPath);
      } catch (err: unknown) {
        await intelligenceRepository
          .recordActivity({
            projectId,
            actorId: userId,
            eventType: 'github.sync_failed',
            entityType: 'github',
            entityId: remoteRecord.id,
            summary: `GitHub pull failed fetching from origin on branch '${targetBranch}'`,
            metadata: JSON.stringify({
              branch: targetBranch,
              operation: 'pull',
            }),
          })
          .catch(() => {});
        this.handleRemoteGitError(err, 'pull', targetBranch);
      }

      // 4. Verify remote tracking branch exists
      const remoteRef = `origin/${targetBranch}`;
      const revCheck = await this.git.run(
        ['rev-parse', '--verify', `refs/remotes/${remoteRef}`],
        repoPath,
        { allowNonZeroExit: true }
      );

      if (revCheck.exitCode !== 0) {
        throw new GitHubNotFoundError(
          `Remote branch '${remoteRef}' does not exist on GitHub yet. Push your local branch first.`
        );
      }

      // 5. Inspect divergence (ahead vs behind)
      const countRes = await this.git.run(
        ['rev-list', '--left-right', '--count', `${targetBranch}...${remoteRef}`],
        repoPath
      );
      const parts = countRes.stdout.trim().split(/\s+/);
      const ahead = parseInt(parts[0], 10) || 0;
      const behind = parseInt(parts[1], 10) || 0;

      if (behind === 0) {
        return {
          branch: targetBranch,
          commitsPulled: 0,
          reconciledFilesCount: 0,
          message: 'Already up to date with remote.',
        };
      }

      if (ahead > 0 && behind > 0) {
        await intelligenceRepository
          .recordActivity({
            projectId,
            actorId: userId,
            eventType: 'github.sync_failed',
            entityType: 'github',
            entityId: remoteRecord.id,
            summary: `GitHub pull detected branch divergence on '${targetBranch}' (${ahead} local, ${behind} remote)`,
            metadata: JSON.stringify({ branch: targetBranch, operation: 'pull', ahead, behind }),
          })
          .catch(() => {});
        throw new GitHubSyncConflictError(
          `Your local branch '${targetBranch}' has diverged from '${remoteRef}' (${ahead} local commit(s), ${behind} remote commit(s)). Versora prevents automatic overwrites to protect your work.`
        );
      }

      // 6. Safe fast-forward update
      const mergeRes = await this.git.run(['merge', '--ff-only', remoteRef], repoPath, {
        allowNonZeroExit: true,
      });

      if (mergeRes.exitCode !== 0) {
        const rawErrText = mergeRes.stderr || mergeRes.stdout;
        const errText = redactGitHubCredentials(rawErrText);
        await intelligenceRepository
          .recordActivity({
            projectId,
            actorId: userId,
            eventType: 'github.sync_failed',
            entityType: 'github',
            entityId: remoteRecord.id,
            summary: `GitHub fast-forward pull failed on '${targetBranch}'`,
            metadata: JSON.stringify({ branch: targetBranch, operation: 'pull', errorSnippet: errText.slice(0, 200) }),
          })
          .catch(() => {});
        throw new GitHubSyncConflictError(
          `Fast-forward synchronization failed: ${errText}`
        );
      }

      // 7. Reconcile working tree with PostgreSQL artifacts & local storage driver
      const reconcileStats = await reconcileProjectArtifacts(
        projectId,
        repoPath,
        this.artifactRepo,
        this.storage
      );

      await this.githubRepo.updateRemoteTimestamps(projectId, {
        lastPulledAt: new Date(),
        lastFetchedAt: new Date(),
      });

      await intelligenceRepository
        .recordActivity({
          projectId,
          actorId: userId,
          eventType: 'github.pulled',
          entityType: 'github',
          entityId: remoteRecord.id,
          summary: `Synchronized ${behind} commit(s) from GitHub on branch '${targetBranch}' (${reconcileStats.added + reconcileStats.updated} file(s) updated)`,
          metadata: JSON.stringify({
            branch: targetBranch,
            commitsPulled: behind,
            filesUpdated: reconcileStats.added + reconcileStats.updated,
          }),
        })
        .catch(() => {});

      return {
        branch: targetBranch,
        commitsPulled: behind,
        reconciledFilesCount: reconcileStats.added + reconcileStats.updated,
        message: `Successfully synchronized ${behind} commit(s) from GitHub. Workspace files updated.`,
      };
    });
  }

  /**
   * Parses git log format lines into structured commit summaries.
   */
  private parseCommitSummaries(rawOutput: string): GitHubCommitSummary[] {
    const lines = rawOutput.split('\n').filter((l) => l.trim().length > 0);
    const result: GitHubCommitSummary[] = [];

    for (const line of lines) {
      const parts = line.split('\x00');
      if (parts.length >= 4) {
        result.push({
          hash: parts[0].trim(),
          shortHash: parts[1].trim(),
          message: parts[2].trim(),
          timestamp: parts[3].trim(),
          authorName: parts[4] ? parts[4].trim() : undefined,
        });
      }
    }

    return result;
  }
}

export const gitHubService = new GitHubService();
