import fs from 'node:fs';
import path from 'node:path';
import { IArtifactRepository, artifactRepository } from '../artifacts/artifact.repository';
import { intelligenceRepository } from '../intelligence/intelligence.repository';
import { IProjectRepository, projectRepository } from '../projects/project.repository';
import { IUserRepository, userRepository } from '../users/user.repository';
import { IStorageDriver } from '../../storage/storage.interface';
import { localStorageDriver } from '../../storage/local.storage';
import { collaborationRepository } from '../collaboration/collaboration.repository';
import { env } from '../../config/env';
import { Project } from '../projects/project.types';
import { ProjectNotFoundError, ProjectForbiddenError } from '../projects/project.errors';
import { GitRunner, gitRunner } from './git.runner';
import { ProjectLockManager, projectLockManager } from './git.lock';
import { reconcileProjectArtifacts } from './git.reconciler';
import { isTextArtifact } from '../artifacts/artifact.types';
import {
  GitFileChange,
  GitStatusResponse,
  GitCommitItem,
  GitCommitDetail,
  GitCommitFileDiff,
  GitBranchItem,
  GitDiffResponse,
  GitDiffFile,
  GitRestorePreviewResponse,
  GitRestoreResult,
  GitInitResponse,
} from './git.types';
import {
  createBranchSchema,
  switchBranchSchema,
  commitSchema,
  restoreSchema,
  restorePreviewSchema,
  CreateBranchInput,
  SwitchBranchInput,
  CommitInput,
  RestoreInput,
  RestorePreviewInput,
} from './git.schemas';
import {
  GitRepositoryNotInitializedError,
  GitValidationError,
  GitConflictError,
  GitNotFoundError,
  GitExecutionError,
} from './git.errors';

export interface IGitService {
  initRepository(userId: string, projectId: string): Promise<GitInitResponse>;
  getStatus(userId: string, projectId: string): Promise<GitStatusResponse>;
  getDiff(
    userId: string,
    projectId: string,
    query?: { file?: string; staged?: boolean }
  ): Promise<GitDiffResponse>;
  commit(userId: string, projectId: string, rawInput: unknown): Promise<GitCommitItem>;
  getHistory(
    userId: string,
    projectId: string,
    query?: { limit?: number; branch?: string; path?: string }
  ): Promise<GitCommitItem[]>;
  getCommit(userId: string, projectId: string, commitHash: string): Promise<GitCommitDetail>;
  listBranches(userId: string, projectId: string): Promise<GitBranchItem[]>;
  createBranch(userId: string, projectId: string, rawInput: unknown): Promise<GitBranchItem>;
  switchBranch(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<{ currentBranch: string; message: string }>;
  previewRestore(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<GitRestorePreviewResponse>;
  restore(userId: string, projectId: string, rawInput: unknown): Promise<GitRestoreResult>;
  isRepoInitialized(projectId: string): boolean;
  getProjectRepoPath(projectId: string): string;
}

export class GitService implements IGitService {
  private reposRoot: string;
  private git: GitRunner;
  private locks: ProjectLockManager;
  private artifactRepo: IArtifactRepository;
  private projRepo: IProjectRepository;
  private userRepo: IUserRepository;
  private storage: IStorageDriver;

  constructor(
    reposRoot?: string,
    git: GitRunner = gitRunner,
    locks: ProjectLockManager = projectLockManager,
    artifactRepo: IArtifactRepository = artifactRepository,
    projRepo: IProjectRepository = projectRepository,
    userRepo: IUserRepository = userRepository,
    storage: IStorageDriver = localStorageDriver
  ) {
    this.reposRoot = path.resolve(process.cwd(), reposRoot || env.GIT_REPOS_ROOT);
    this.git = git;
    this.locks = locks;
    this.artifactRepo = artifactRepo;
    this.projRepo = projRepo;
    this.userRepo = userRepo;
    this.storage = storage;
  }

  /**
   * Resolves safe repository working directory on disk and enforces strict path containment.
   */
  getProjectRepoPath(projectId: string): string {
    if (!/^[0-9a-fA-F-]{36}$/.test(projectId) && !/^[a-zA-Z0-9_-]{1,64}$/.test(projectId)) {
      throw new GitValidationError([{ field: 'projectId', issue: 'Invalid project identifier' }]);
    }

    const resolved = path.resolve(this.reposRoot, projectId);
    const normalizedRoot = path.normalize(this.reposRoot) + path.sep;
    const normalizedResolved = path.normalize(resolved);

    if (!normalizedResolved.startsWith(normalizedRoot) && normalizedResolved !== path.normalize(this.reposRoot)) {
      throw new GitExecutionError('Security violation: Project path is outside repository storage.');
    }

    return resolved;
  }

  /**
   * Checks whether a real Git repository has been initialized on disk for the given project.
   */
  isRepoInitialized(projectId: string): boolean {
    try {
      const repoPath = this.getProjectRepoPath(projectId);
      const gitDir = path.join(repoPath, '.git');
      return fs.existsSync(gitDir);
    } catch {
      return false;
    }
  }

  /**
   * Helper to verify project existence and user ownership.
   */
  private async verifyProjectOwnership(userId: string, projectId: string): Promise<Project> {
    const project = await this.projRepo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    if (project.ownerId !== userId) {
      const member = await collaborationRepository.findMember(projectId, userId);
      if (!member) {
        throw new ProjectForbiddenError('You do not have permission to access Git operations in this project.');
      }
    }
    return project;
  }

  /**
   * Initializes a real Git repository for a project, safely migrating existing artifacts.
   */
  async initRepository(userId: string, projectId: string): Promise<GitInitResponse> {
    const project = await this.verifyProjectOwnership(userId, projectId);

    return this.locks.withLock(projectId, async () => {
      const repoPath = this.getProjectRepoPath(projectId);
      const isAlreadyInit = this.isRepoInitialized(projectId);

      if (isAlreadyInit) {
        const status = await this.getStatus(userId, projectId);
        return {
          isInitialized: true,
          branch: status.currentBranch || 'main',
          initialCommitHash: status.headCommitHash,
          message: 'Git repository is already initialized.',
          filesTrackedCount: status.staged.length + status.unstaged.length,
        };
      }

      // 1. Create clean repository directory
      await fs.promises.mkdir(repoPath, { recursive: true });

      // 2. Initialize Git with default branch main
      try {
        await this.git.run(['init', '-b', 'main'], repoPath);
      } catch {
        // Fallback for older git versions
        await this.git.run(['init'], repoPath);
        await this.git.run(['branch', '-M', 'main'], repoPath);
      }

      // 3. Configure author identity scoped to local repository
      const user = await this.userRepo.findById(userId);
      const authorName = user?.displayName || user?.username || 'Versora User';
      const authorEmail = user?.email || 'user@versora.local';

      await this.git.run(['config', 'user.name', authorName], repoPath);
      await this.git.run(['config', 'user.email', authorEmail], repoPath);
      await this.git.run(['config', 'core.autocrlf', 'false'], repoPath);

      // 4. Create standard .gitignore
      const gitignoreContent = [
        '# Versora Project Ignores',
        'node_modules/',
        '.DS_Store',
        'Thumbs.db',
        '.env',
        'dist/',
        'build/',
        '',
      ].join('\n');
      await fs.promises.writeFile(path.join(repoPath, '.gitignore'), gitignoreContent, 'utf-8');

      // 5. Materialize existing artifacts from storage into the Git working tree
      const existingArtifacts = await this.artifactRepo.findAllByProjectId(projectId);
      let materializedCount = 0;

      // Create directories first
      const folders = existingArtifacts
        .filter((a) => a.type === 'folder')
        .sort((a, b) => a.path.split('/').length - b.path.split('/').length);

      for (const folder of folders) {
        const relPath = folder.path.startsWith('/') ? folder.path.slice(1) : folder.path;
        await fs.promises.mkdir(path.join(repoPath, relPath), { recursive: true });
      }

      // Materialize files
      const files = existingArtifacts.filter((a) => a.type === 'file');
      for (const file of files) {
        const relPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        const targetPath = path.join(repoPath, relPath);
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

        if (file.storageKey) {
          try {
            const buf = await this.storage.getBuffer(file.storageKey);
            await fs.promises.writeFile(targetPath, buf);
            materializedCount++;
          } catch {
            // If storage key is missing or empty, create empty file placeholder
            await fs.promises.writeFile(targetPath, Buffer.alloc(0));
            materializedCount++;
          }
        }
      }

      // 6. Stage and make initial commit
      await this.git.run(['add', '-A'], repoPath);

      let initialCommitHash: string | null = null;
      try {
        const commitRes = await this.git.run(
          ['commit', '-m', 'Initialize project repository with existing artifacts'],
          repoPath
        );
        const hashRes = await this.git.run(['rev-parse', 'HEAD'], repoPath);
        initialCommitHash = hashRes.stdout.trim();
      } catch {
        // Empty commit case or no files
      }

      await intelligenceRepository
        .recordActivity({
          projectId,
          actorId: userId,
          eventType: 'git.init',
          entityType: 'git',
          entityId: initialCommitHash,
          summary: `Initialized Git repository on branch 'main' with ${materializedCount} tracked artifacts`,
          metadata: JSON.stringify({
            branch: 'main',
            initialCommitHash,
            filesTrackedCount: materializedCount,
          }),
        })
        .catch(() => {});

      return {
        isInitialized: true,
        branch: 'main',
        initialCommitHash,
        message: 'Git repository successfully initialized.',
        filesTrackedCount: materializedCount,
      };
    });
  }

  /**
   * Retrieves actual Git status for the project workspace.
   */
  async getStatus(userId: string, projectId: string): Promise<GitStatusResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const repoPath = this.getProjectRepoPath(projectId);
    if (!this.isRepoInitialized(projectId)) {
      return {
        isInitialized: false,
        currentBranch: null,
        hasCommits: false,
        headCommitHash: null,
        staged: [],
        unstaged: [],
        untracked: [],
        totalChangesCount: 0,
      };
    }

    return this.locks.withLock(projectId, async () => {
      // 1. Run git status with porcelain v1 and branch header
      const { stdout } = await this.git.run(['status', '--porcelain=v1', '-u', '--branch'], repoPath);
      const lines = stdout.split('\n').filter((l) => l.trim().length > 0);

      let currentBranch: string | null = 'main';
      let hasCommits = false;

      // Line 1 is branch information: "## main" or "## No commits yet on main"
      if (lines.length > 0 && lines[0].startsWith('##')) {
        const branchHeader = lines[0].slice(2).trim();
        if (branchHeader.includes('No commits yet on') || branchHeader.includes('Initial commit on')) {
          currentBranch = branchHeader.replace('No commits yet on', '').replace('Initial commit on', '').trim();
          hasCommits = false;
        } else {
          // e.g. "main...origin/main" or "main"
          const match = branchHeader.split('...')[0].trim();
          currentBranch = match || 'main';
          hasCommits = true;
        }
        lines.shift();
      }

      // Verify HEAD hash
      let headCommitHash: string | null = null;
      try {
        const headRes = await this.git.run(['rev-parse', '--verify', 'HEAD'], repoPath, {
          allowNonZeroExit: true,
        });
        if (headRes.exitCode === 0) {
          headCommitHash = headRes.stdout.trim();
          hasCommits = true;
        }
      } catch {}

      const staged: GitFileChange[] = [];
      const unstaged: GitFileChange[] = [];
      const untracked: GitFileChange[] = [];

      for (const line of lines) {
        if (line.length < 3) continue;
        const x = line[0];
        const y = line[1];
        let filePath = line.slice(3).trim();
        let oldPath: string | undefined;

        // Handle renames: "R  old -> new"
        if (filePath.includes(' -> ')) {
          const parts = filePath.split(' -> ');
          oldPath = parts[0].replace(/^"|"$/g, '');
          filePath = parts[1].replace(/^"|"$/g, '');
        } else {
          filePath = filePath.replace(/^"|"$/g, '');
        }

        // Check if file is binary
        const fullFilePath = path.join(repoPath, filePath);
        let isBinary = false;
        if (fs.existsSync(fullFilePath)) {
          try {
            const buf = await fs.promises.readFile(fullFilePath);
            isBinary = !isTextArtifact(filePath, undefined, buf);
          } catch {
            isBinary = false;
          }
        }

        if (x === '?' && y === '?') {
          untracked.push({
            path: filePath,
            status: 'untracked',
            staged: false,
            isBinary,
          });
        } else {
          // Staged check (X column)
          if (x !== ' ' && x !== '?') {
            const status =
              x === 'A' ? 'added' : x === 'D' ? 'deleted' : x === 'R' ? 'renamed' : 'modified';
            staged.push({
              path: filePath,
              status,
              staged: true,
              isBinary,
              oldPath,
            });
          }

          // Unstaged check (Y column)
          if (y !== ' ' && y !== '?') {
            const status = y === 'D' ? 'deleted' : 'modified';
            unstaged.push({
              path: filePath,
              status,
              staged: false,
              isBinary,
            });
          }
        }
      }

      return {
        isInitialized: true,
        currentBranch,
        hasCommits,
        headCommitHash,
        staged,
        unstaged,
        untracked,
        totalChangesCount: staged.length + unstaged.length + untracked.length,
      };
    });
  }

  /**
   * Retrieves unified textual diffs for pending changes.
   */
  async getDiff(
    userId: string,
    projectId: string,
    query?: { file?: string; staged?: boolean }
  ): Promise<GitDiffResponse> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    return this.locks.withLock(projectId, async () => {
      const files: GitDiffFile[] = [];
      const fileFilter = query?.file?.trim();
      const isStagedOnly = query?.staged === true;

      // 1. Inspect diff using git diff
      const diffArgs = isStagedOnly ? ['diff', '--cached'] : ['diff'];
      if (fileFilter) {
        if (fileFilter.includes('..') || path.isAbsolute(fileFilter)) {
          throw new GitValidationError([{ field: 'file', issue: 'Invalid file path' }]);
        }
        diffArgs.push('--', fileFilter);
      }

      const diffRes = await this.git.run(diffArgs, repoPath);
      const parsedDiffs = this.parseUnifiedDiff(diffRes.stdout);
      files.push(...parsedDiffs);

      // 2. If no staged flag specified and fileFilter points to untracked file, generate new file diff
      if (!isStagedOnly) {
        const status = await this.getStatus(userId, projectId);
        const untrackedFiles = fileFilter
          ? status.untracked.filter((u) => u.path === fileFilter)
          : status.untracked;

        for (const u of untrackedFiles) {
          const fullPath = path.join(repoPath, u.path);
          if (fs.existsSync(fullPath)) {
            const buffer = await fs.promises.readFile(fullPath);
            const isBinary = !isTextArtifact(u.path, undefined, buffer);

            if (isBinary) {
              files.push({
                path: u.path,
                status: 'untracked',
                isBinary: true,
                diff: 'Binary file differences cannot be displayed as text.',
                additions: 0,
                deletions: 0,
              });
            } else {
              const textContent = buffer.toString('utf-8');
              const lines = textContent.split('\n');
              const diffLines = lines.map((l) => `+${l}`).join('\n');
              const diffStr = [
                `--- /dev/null`,
                `+++ b/${u.path}`,
                `@@ -0,0 +1,${lines.length} @@`,
                diffLines,
              ].join('\n');

              files.push({
                path: u.path,
                status: 'untracked',
                isBinary: false,
                diff: diffStr,
                additions: lines.length,
                deletions: 0,
              });
            }
          }
        }
      }

      let totalAdditions = 0;
      let totalDeletions = 0;
      for (const f of files) {
        totalAdditions += f.additions;
        totalDeletions += f.deletions;
      }

      return {
        files,
        totalAdditions,
        totalDeletions,
      };
    });
  }

  /**
   * Helper to parse git unified diff output into structured files.
   */
  private parseUnifiedDiff(rawDiff: string): GitDiffFile[] {
    if (!rawDiff || !rawDiff.trim()) return [];

    const fileChunks = rawDiff.split(/^diff --git /m).filter((c) => c.trim().length > 0);
    const result: GitDiffFile[] = [];

    for (const chunk of fileChunks) {
      const headerLine = chunk.split('\n')[0];
      const match = headerLine.match(/a\/(.+?)\s+b\/(.+)/);
      const filePath = match ? match[2] : 'unknown';

      const isBinary = chunk.includes('Binary files');
      let additions = 0;
      let deletions = 0;

      if (!isBinary) {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) additions++;
          if (line.startsWith('-') && !line.startsWith('---')) deletions++;
        }
      }

      const status = chunk.includes('new file mode')
        ? 'added'
        : chunk.includes('deleted file mode')
        ? 'deleted'
        : chunk.includes('similarity index') || chunk.includes('rename from')
        ? 'renamed'
        : 'modified';

      result.push({
        path: filePath,
        status,
        isBinary,
        diff: isBinary ? 'Binary file differences cannot be displayed as text.' : chunk,
        additions,
        deletions,
      });
    }

    return result;
  }

  /**
   * Commits staged or modified workspace files with a meaningful message.
   */
  async commit(userId: string, projectId: string, rawInput: unknown): Promise<GitCommitItem> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const parseResult = commitSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((e) => ({
        field: e.path.join('.') || 'body',
        issue: e.message,
      }));
      throw new GitValidationError(details);
    }

    const data: CommitInput = parseResult.data;

    return this.locks.withLock(projectId, async () => {
      // 1. Stage changes
      if (data.files && data.files.length > 0) {
        for (const f of data.files) {
          await this.git.run(['add', '--', f], repoPath);
        }
      } else {
        await this.git.run(['add', '-A'], repoPath);
      }

      // 2. Check if there are staged changes
      const diffCached = await this.git.run(['diff', '--cached', '--quiet'], repoPath, {
        allowNonZeroExit: true,
      });

      if (diffCached.exitCode === 0) {
        throw new GitValidationError([
          { field: 'files', issue: 'No changes are pending to save. Modify files before committing.' },
        ]);
      }

      // 3. Configure author dynamically for this commit
      const user = await this.userRepo.findById(userId);
      const authorName = user?.displayName || user?.username || 'Versora User';
      const authorEmail = user?.email || 'user@versora.local';

      await this.git.run(['config', 'user.name', authorName], repoPath);
      await this.git.run(['config', 'user.email', authorEmail], repoPath);

      // 4. Execute git commit
      await this.git.run(['commit', '-m', data.message], repoPath);

      // 5. Retrieve created commit metadata
      const logRes = await this.git.run(
        ['log', '-1', '--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%P%x00%B'],
        repoPath
      );

      const parts = logRes.stdout.trim().split('\x00');
      const hash = parts[0] || '';
      const shortHash = parts[1] || '';
      const name = parts[2] || authorName;
      const email = parts[3] || authorEmail;
      const timestamp = parts[4] || new Date().toISOString();
      const parentsStr = parts[5] || '';
      const parents = parentsStr.trim() ? parentsStr.trim().split(' ') : [];
      const message = parts[6] || data.message;

      await intelligenceRepository
        .recordActivity({
          projectId,
          actorId: userId,
          eventType: 'git.commit',
          entityType: 'git',
          entityId: hash,
          summary: `Committed '${message.trim()}' (${shortHash})`,
          metadata: JSON.stringify({
            hash,
            shortHash,
            message: message.trim(),
            author: { name, email },
          }),
        })
        .catch(() => {});

      return {
        hash,
        shortHash,
        message: message.trim(),
        author: { name, email },
        timestamp,
        parents,
      };
    });
  }

  /**
   * Retrieves chronological Git commit log for the current or specified branch.
   */
  async getHistory(
    userId: string,
    projectId: string,
    query?: { limit?: number; branch?: string; path?: string }
  ): Promise<GitCommitItem[]> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      return [];
    }

    return this.locks.withLock(projectId, async () => {
      // Check if HEAD exists
      const headCheck = await this.git.run(['rev-parse', '--verify', 'HEAD'], repoPath, {
        allowNonZeroExit: true,
      });

      if (headCheck.exitCode !== 0) {
        return [];
      }

      const limit = Math.min(Math.max(query?.limit || 50, 1), 200);
      const branch = query?.branch?.trim();
      const filePath = query?.path?.trim();

      const logArgs = [
        'log',
        `-n${limit}`,
        '--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%P%x00%B%x01',
      ];
      if (branch) {
        logArgs.push(branch);
      }
      if (filePath) {
        logArgs.push('--follow', '--', filePath);
      }

      const { stdout } = await this.git.run(logArgs, repoPath);
      const rawCommits = stdout.split('\x01').filter((c) => c.trim().length > 0);
      const commits: GitCommitItem[] = [];

      for (const raw of rawCommits) {
        const parts = raw.split('\x00');
        if (parts.length >= 7) {
          commits.push({
            hash: parts[0].trim(),
            shortHash: parts[1].trim(),
            author: {
              name: parts[2].trim(),
              email: parts[3].trim(),
            },
            timestamp: parts[4].trim(),
            parents: parts[5].trim() ? parts[5].trim().split(' ') : [],
            message: parts[6].trim(),
          });
        }
      }

      return commits;
    });
  }

  /**
   * Inspects detailed changes introduced by a specific commit.
   */
  async getCommit(userId: string, projectId: string, commitHash: string): Promise<GitCommitDetail> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const cleanHash = commitHash.trim();
    if (!/^[a-fA-F0-9]{4,40}$/.test(cleanHash)) {
      throw new GitValidationError([{ field: 'commitHash', issue: 'Invalid commit hash' }]);
    }

    return this.locks.withLock(projectId, async () => {
      // 1. Commit metadata
      const logRes = await this.git.run(
        ['log', '-1', '--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%P%x00%B', cleanHash],
        repoPath
      );

      const parts = logRes.stdout.trim().split('\x00');
      if (parts.length < 7) {
        throw new GitNotFoundError(`Commit '${cleanHash}' was not found.`);
      }

      const commit: GitCommitItem = {
        hash: parts[0].trim(),
        shortHash: parts[1].trim(),
        author: {
          name: parts[2].trim(),
          email: parts[3].trim(),
        },
        timestamp: parts[4].trim(),
        parents: parts[5].trim() ? parts[5].trim().split(' ') : [],
        message: parts[6].trim(),
      };

      // 2. Commit file diffs
      const showRes = await this.git.run(['show', '--format=', cleanHash], repoPath);
      const files: GitCommitFileDiff[] = this.parseUnifiedDiff(showRes.stdout);

      let totalAdditions = 0;
      let totalDeletions = 0;
      for (const f of files) {
        totalAdditions += f.additions;
        totalDeletions += f.deletions;
      }

      return {
        commit,
        files,
        stats: {
          totalFiles: files.length,
          totalAdditions,
          totalDeletions,
        },
      };
    });
  }

  /**
   * Lists all local branches in the repository.
   */
  async listBranches(userId: string, projectId: string): Promise<GitBranchItem[]> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      return [];
    }

    return this.locks.withLock(projectId, async () => {
      const { stdout } = await this.git.run(['branch', '--list', '--no-color'], repoPath);
      const lines = stdout.split('\n').filter((l) => l.trim().length > 0);

      // In case repo has no commits yet
      if (lines.length === 0) {
        return [{ name: 'main', isCurrent: true, commitHash: null }];
      }

      const branches: GitBranchItem[] = [];

      for (const line of lines) {
        const isCurrent = line.startsWith('*');
        const name = line.replace('*', '').trim();

        let commitHash: string | null = null;
        try {
          const revRes = await this.git.run(['rev-parse', name], repoPath, { allowNonZeroExit: true });
          if (revRes.exitCode === 0) {
            commitHash = revRes.stdout.trim();
          }
        } catch {}

        branches.push({
          name,
          isCurrent,
          commitHash,
        });
      }

      return branches;
    });
  }

  /**
   * Creates a new branch from current HEAD or specified commit.
   */
  async createBranch(userId: string, projectId: string, rawInput: unknown): Promise<GitBranchItem> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const parseResult = createBranchSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((e) => ({
        field: e.path.join('.') || 'body',
        issue: e.message,
      }));
      throw new GitValidationError(details);
    }

    const data: CreateBranchInput = parseResult.data;

    return this.locks.withLock(projectId, async () => {
      // Check if branch name already exists
      const existingRes = await this.git.run(['branch', '--list', data.name], repoPath);
      if (existingRes.stdout.trim().length > 0) {
        throw new GitConflictError(`Branch '${data.name}' already exists.`);
      }

      // Check if repository has commits
      const headCheck = await this.git.run(['rev-parse', '--verify', 'HEAD'], repoPath, {
        allowNonZeroExit: true,
      });

      if (headCheck.exitCode !== 0) {
        throw new GitValidationError([
          { field: 'name', issue: 'Cannot create branch on a repository with no commits yet.' },
        ]);
      }

      const args = ['branch', data.name];
      if (data.fromCommit) {
        args.push(data.fromCommit);
      }

      await this.git.run(args, repoPath);

      const hashRes = await this.git.run(['rev-parse', data.name], repoPath);
      const commitHash = hashRes.stdout.trim();

      await intelligenceRepository
        .recordActivity({
          projectId,
          actorId: userId,
          eventType: 'git.branch_created',
          entityType: 'git',
          entityId: data.name,
          summary: `Created Git branch '${data.name}' from ${data.fromCommit ? data.fromCommit.slice(0, 7) : 'HEAD'}`,
          metadata: JSON.stringify({
            branchName: data.name,
            fromCommit: data.fromCommit || null,
            commitHash,
          }),
        })
        .catch(() => {});

      return {
        name: data.name,
        isCurrent: false,
        commitHash,
      };
    });
  }

  /**
   * Switches branches safely with dirty tree prevention and automatic artifact reconciliation.
   */
  async switchBranch(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<{ currentBranch: string; message: string }> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const parseResult = switchBranchSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((e) => ({
        field: e.path.join('.') || 'body',
        issue: e.message,
      }));
      throw new GitValidationError(details);
    }

    const data: SwitchBranchInput = parseResult.data;

    return this.locks.withLock(projectId, async () => {
      // 1. Prevent switching with uncommitted changes
      const statusRes = await this.git.run(['status', '--porcelain'], repoPath);
      if (statusRes.stdout.trim().length > 0) {
        throw new GitConflictError(
          'Cannot switch branches with uncommitted changes in the workspace. Please save a version or restore changes before switching.'
        );
      }

      // 2. Perform branch checkout
      await this.git.run(['checkout', data.branch], repoPath);

      // 3. Reconcile working tree with PostgreSQL artifacts table & storage
      await reconcileProjectArtifacts(projectId, repoPath, this.artifactRepo, this.storage);

      await intelligenceRepository
        .recordActivity({
          projectId,
          actorId: userId,
          eventType: 'git.branch_switched',
          entityType: 'git',
          entityId: data.branch,
          summary: `Switched Git branch to '${data.branch}'`,
          metadata: JSON.stringify({ branch: data.branch }),
        })
        .catch(() => {});

      return {
        currentBranch: data.branch,
        message: `Successfully switched to branch '${data.branch}'.`,
      };
    });
  }

  /**
   * Previews changes before restoring a file or project snapshot from an earlier commit.
   */
  async previewRestore(
    userId: string,
    projectId: string,
    rawInput: unknown
  ): Promise<GitRestorePreviewResponse> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const parseResult = restorePreviewSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((e) => ({
        field: e.path.join('.') || 'body',
        issue: e.message,
      }));
      throw new GitValidationError(details);
    }

    const data: RestorePreviewInput = parseResult.data;

    return this.locks.withLock(projectId, async () => {
      // Verify target commit exists
      const revRes = await this.git.run(['rev-parse', data.commitHash], repoPath);
      const fullHash = revRes.stdout.trim();
      const shortHash = fullHash.slice(0, 7);

      // Check uncommitted changes in workspace
      const statusRes = await this.git.run(['status', '--porcelain'], repoPath);
      const hasUncommittedChanges = statusRes.stdout.trim().length > 0;

      // Check diff between HEAD and target commit
      const diffArgs = ['diff', '--name-status', 'HEAD', fullHash];
      if (data.filePath) {
        diffArgs.push('--', data.filePath);
      }

      const diffRes = await this.git.run(diffArgs, repoPath);
      const lines = diffRes.stdout.split('\n').filter((l) => l.trim().length > 0);

      const filesToChange: Array<{ path: string; action: 'modify' | 'create' | 'delete' }> = [];
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const code = parts[0][0];
          const path = parts[1];
          const action = code === 'A' ? 'create' : code === 'D' ? 'delete' : 'modify';
          filesToChange.push({ path, action });
        }
      }

      return {
        commitHash: fullHash,
        shortHash,
        mode: data.filePath ? 'file' : 'project',
        targetPath: data.filePath,
        filesToChange,
        hasUncommittedChanges,
        warning: hasUncommittedChanges
          ? 'Warning: You have uncommitted changes in your workspace. Please save a version before restoring.'
          : undefined,
      };
    });
  }

  /**
   * Restores a file or project snapshot from an earlier commit with backup protection.
   */
  async restore(userId: string, projectId: string, rawInput: unknown): Promise<GitRestoreResult> {
    await this.verifyProjectOwnership(userId, projectId);
    const repoPath = this.getProjectRepoPath(projectId);

    if (!this.isRepoInitialized(projectId)) {
      throw new GitRepositoryNotInitializedError();
    }

    const parseResult = restoreSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((e) => ({
        field: e.path.join('.') || 'body',
        issue: e.message,
      }));
      throw new GitValidationError(details);
    }

    const data: RestoreInput = parseResult.data;

    return this.locks.withLock(projectId, async () => {
      // 1. Prevent restore if uncommitted changes exist
      const statusRes = await this.git.run(['status', '--porcelain'], repoPath);
      if (statusRes.stdout.trim().length > 0) {
        throw new GitConflictError(
          'Cannot restore version with uncommitted changes in your workspace. Please save a version or discard changes first.'
        );
      }

      // 2. Create safety backup tag before performing restore
      const backupRef = `backup-restore-${Date.now()}`;
      await this.git.run(['tag', backupRef], repoPath);

      const restoredFiles: string[] = [];

      // 3. Perform restoration
      if (data.mode === 'file' && data.filePath) {
        await this.git.run(['checkout', data.commitHash, '--', data.filePath], repoPath);
        restoredFiles.push(data.filePath);
      } else {
        // Project-wide restoration: checkout all files matching target commit
        await this.git.run(['checkout', data.commitHash, '--', '.'], repoPath);
      }

      // 4. Reconcile working tree with PostgreSQL artifacts table & storage
      await reconcileProjectArtifacts(projectId, repoPath, this.artifactRepo, this.storage);

      await intelligenceRepository
        .recordActivity({
          projectId,
          actorId: userId,
          eventType: 'git.restored',
          entityType: 'git',
          entityId: data.commitHash,
          summary: `Restored ${
            data.mode === 'file' ? `file '${data.filePath}'` : 'project snapshot'
          } from commit ${data.commitHash.slice(0, 7)}`,
          metadata: JSON.stringify({
            commitHash: data.commitHash,
            mode: data.mode,
            filePath: data.filePath || null,
            backupRef,
          }),
        })
        .catch(() => {});

      return {
        restoredCommitHash: data.commitHash,
        mode: data.mode,
        restoredFiles,
        backupRef,
        message: `Successfully restored ${
          data.mode === 'file' ? `file '${data.filePath}'` : 'project snapshot'
        } from commit ${data.commitHash.slice(0, 7)}. Safety backup tag '${backupRef}' created.`,
      };
    });
  }
}

export const gitService = new GitService();
