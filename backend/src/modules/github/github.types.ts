/**
 * GitHub Integration Types & Contracts
 * DTOs and operational structures for OAuth, remote linking, and Git sync.
 */

export interface GitHubAccountPublic {
  username: string;
  avatarUrl?: string | null;
  scope?: string | null;
  connectedAt: string;
}

export interface GitHubOAuthStatusResponse {
  isConfigured: boolean;
  isConnected: boolean;
  account: GitHubAccountPublic | null;
}

export interface GitHubAuthorizeResponse {
  authorizeUrl: string;
  state: string;
}

export interface GitHubCallbackResult {
  username: string;
  returnTo: string | null;
}

export interface GitHubRemoteInfo {
  id: string;
  projectId: string;
  owner: string;
  repo: string;
  remoteUrl: string;
  isPrivate: boolean;
  defaultBranch: string;
  lastFetchedAt: string | null;
  lastPushedAt: string | null;
  lastPulledAt: string | null;
}

export interface GitHubCommitSummary {
  hash: string;
  shortHash: string;
  message: string;
  timestamp: string;
  authorName?: string;
}

export type GitHubSyncState =
  | 'not_linked'
  | 'in_sync'
  | 'ahead'
  | 'behind'
  | 'diverged'
  | 'untracked'
  | 'uncommitted_changes';

export interface GitHubRemoteStatusResponse {
  isLinked: boolean;
  remote: GitHubRemoteInfo | null;
  localBranch: string;
  remoteBranch: string | null;
  isTracking: boolean;
  ahead: number;
  behind: number;
  isDiverged: boolean;
  hasUncommittedChanges: boolean;
  outgoingCommits: GitHubCommitSummary[];
  incomingCommits: GitHubCommitSummary[];
  syncState: GitHubSyncState;
  lastSyncError: string | null;
}

export interface GitHubPublishInput {
  name: string;
  description?: string;
  isPrivate?: boolean;
}

export interface GitHubLinkInput {
  owner: string;
  repo: string;
}

export interface GitHubPushResult {
  branch: string;
  commitsPushed: number;
  remoteUrl: string;
  message: string;
}

export interface GitHubFetchResult {
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  isDiverged: boolean;
  message: string;
}

export interface GitHubPullResult {
  branch: string;
  commitsPulled: number;
  reconciledFilesCount: number;
  message: string;
}

export interface GitHubUserApiProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
}

export interface GitHubRepoApiResponse {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
  };
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}
