export interface DashboardStats {
  filesCount: number;
  foldersCount: number;
  totalStorageBytes: number;
  commitsCount: number;
  openTasksCount: number;
  urgentTasksCount: number;
  pendingReviewsCount: number;
  unreviewedImpactCount: number;
  membersCount: number;
}

export interface DashboardReviewSummary {
  id: string;
  title: string;
  targetType: 'branch' | 'commit' | 'artifact' | string;
  targetRef: string;
  status: 'pending' | 'open' | 'approved' | 'changes_requested' | 'rejected' | 'closed' | string;
  isAwaitingUser: boolean;
  approvalsCount: number;
  reviewersCount: number;
  createdAt: string;
}

export interface DashboardTaskSummary {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'completed' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  dueDate: string | null;
  isOverdue: boolean;
  assignedToUser: boolean;
  linkedArtifactId?: string | null;
}

export interface DashboardCommitSummary {
  hash: string;
  shortHash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  timestamp: string;
}

export interface DashboardImpactSummary {
  activeCount: number;
  highSeverityCount: number;
  unreviewedCount: number;
  hasUnreviewedWarning: boolean;
  topImpacts: Array<{
    impactKey: string;
    changedArtifactPath: string;
    affectedArtifactPath: string;
    relationshipType: string;
    severity: 'low' | 'medium' | 'high' | 'info' | string;
    reason: string;
    status: 'active' | 'reviewed' | 'dismissed' | string;
  }>;
}

export interface DashboardGitHubSummary {
  isLinked: boolean;
  repoUrl?: string;
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  aheadBy?: number;
  behindBy?: number;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
}

export interface DashboardActivitySummary {
  id: string;
  eventType: string;
  entityType: string;
  summary: string;
  createdAt: string;
}

export interface ProjectDashboardData {
  project: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
  };
  currentUserRole: string;
  stats: DashboardStats;
  git: {
    isInitialized: boolean;
    currentBranch?: string;
    cleanWorkingTree: boolean;
    modifiedCount: number;
    stagedCount: number;
    untrackedCount: number;
    recentCommits: DashboardCommitSummary[];
  };
  github: DashboardGitHubSummary;
  pendingReviews: DashboardReviewSummary[];
  myTasks: DashboardTaskSummary[];
  impactSummary: DashboardImpactSummary;
  recentActivity: DashboardActivitySummary[];
  aiAssistant: {
    isConfigured: boolean;
    provider?: string;
  };
}

export type SearchCategory = 'all' | 'artifacts' | 'tasks' | 'reviews' | 'commits';

export interface SearchArtifactResult {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  artifactType: string;
  sizeBytes: number;
  matchSnippet?: string;
}

export interface SearchTaskResult {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  linkedArtifactId?: string | null;
}

export interface SearchReviewResult {
  id: string;
  title: string;
  targetType: string;
  targetRef: string;
  status: string;
}

export interface SearchCommitResult {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface ProjectSearchResponse {
  query: string;
  totalCount: number;
  artifacts: SearchArtifactResult[];
  tasks: SearchTaskResult[];
  reviews: SearchReviewResult[];
  commits: SearchCommitResult[];
}

export interface WorkflowContextResponse {
  artifactId?: string;
  artifactName?: string;
  artifactPath?: string;
  commitHash?: string;
  upstreamRelationships: Array<{
    id: string;
    sourceName: string;
    relationshipType: string;
    description?: string | null;
  }>;
  downstreamRelationships: Array<{
    id: string;
    targetName: string;
    relationshipType: string;
    description?: string | null;
  }>;
  impacts: Array<{
    impactKey: string;
    affectedName: string;
    affectedPath: string;
    severity: string;
    reason: string;
    status: string;
  }>;
  relatedTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;
  relatedReviews: Array<{
    id: string;
    title: string;
    status: string;
    targetRef: string;
  }>;
  gitCommit?: {
    hash: string;
    message: string;
    files: Array<{
      path: string;
      status: string;
      additions: number;
      deletions: number;
    }>;
  } | null;
}
