/**
 * Git Version Control Engine Types for Versora
 * Defines contracts for real Git operations, repository metadata, diffs, and history.
 */

export type GitFileChangeStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';

export interface GitFileChange {
  path: string;
  status: GitFileChangeStatus;
  staged: boolean;
  isBinary: boolean;
  oldPath?: string;
}

export interface GitStatusResponse {
  isInitialized: boolean;
  currentBranch: string | null;
  hasCommits: boolean;
  headCommitHash: string | null;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
  totalChangesCount: number;
}

export interface GitCommitItem {
  hash: string;
  shortHash: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  timestamp: string;
  parents: string[];
}

export interface GitCommitFileDiff {
  path: string;
  oldPath?: string;
  status: GitFileChangeStatus;
  additions: number;
  deletions: number;
  isBinary: boolean;
  diff?: string;
}

export interface GitCommitDetail {
  commit: GitCommitItem;
  files: GitCommitFileDiff[];
  stats: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  };
}

export interface GitBranchItem {
  name: string;
  isCurrent: boolean;
  commitHash: string | null;
}

export interface GitDiffFile {
  path: string;
  oldPath?: string;
  status: GitFileChangeStatus;
  isBinary: boolean;
  diff: string;
  additions: number;
  deletions: number;
}

export interface GitDiffResponse {
  files: GitDiffFile[];
  totalAdditions: number;
  totalDeletions: number;
}

export interface GitRestorePreviewResponse {
  commitHash: string;
  shortHash: string;
  mode: 'file' | 'project';
  targetPath?: string;
  filesToChange: Array<{
    path: string;
    action: 'modify' | 'create' | 'delete';
  }>;
  hasUncommittedChanges: boolean;
  warning?: string;
}

export interface GitRestoreResult {
  restoredCommitHash: string;
  mode: 'file' | 'project';
  restoredFiles: string[];
  backupRef?: string;
  message: string;
}

export interface GitInitResponse {
  isInitialized: boolean;
  branch: string;
  initialCommitHash: string | null;
  message: string;
  filesTrackedCount: number;
}
