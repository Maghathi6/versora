/**
 * GitHub Integration Types & Contracts
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
  authorName: string;
  authorEmail: string;
  date: string;
}

export type GitHubSyncState =
  | 'up_to_date'
  | 'ahead'
  | 'behind'
  | 'diverged'
  | 'not_linked'
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

export interface GitHubPullResult {
  branch: string;
  commitsPulled: number;
  reconciledFilesCount: number;
  message: string;
}

export interface GitHubFetchResult {
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  isDiverged: boolean;
  message: string;
}
