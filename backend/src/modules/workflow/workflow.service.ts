import { IProjectRepository, projectRepository } from '../projects/project.repository';
import { IArtifactRepository, artifactRepository } from '../artifacts/artifact.repository';
import { ICollaborationService, collaborationService } from '../collaboration/collaboration.service';
import { ICollaborationRepository, collaborationRepository } from '../collaboration/collaboration.repository';
import { IGitService, gitService } from '../git/git.service';
import { IIntelligenceService, intelligenceService } from '../intelligence/intelligence.service';
import { IIntelligenceRepository, intelligenceRepository } from '../intelligence/intelligence.repository';
import { GitHubService } from '../github/github.service';
import { AssistantService } from '../assistant/assistant.service';
import { ProjectNotFoundError } from '../projects/project.errors';
import {
  ProjectDashboardData,
  ProjectSearchResponse,
  WorkflowContextResponse,
  SearchCategory,
} from './workflow.types';

export class WorkflowService {
  constructor(
    private projectRepo: IProjectRepository = projectRepository,
    private artifactRepo: IArtifactRepository = artifactRepository,
    private collaborationSvc: ICollaborationService = collaborationService,
    private collaborationRepo: ICollaborationRepository = collaborationRepository,
    private gitSvc: IGitService = gitService,
    private intelligenceSvc: IIntelligenceService = intelligenceService,
    private intelligenceRepo: IIntelligenceRepository = intelligenceRepository,
    private githubSvc: GitHubService = new GitHubService(),
    private assistantSvc: AssistantService = new AssistantService()
  ) {}

  /**
   * Builds an aggregated, real-time dashboard data structure for a project.
   */
  async getProjectDashboard(userId: string, projectId: string): Promise<ProjectDashboardData> {
    // 1. Authorization: user must have project access
    const { effectiveRole } = await this.collaborationSvc.checkProjectAccess(userId, projectId, 'viewer');

    // 2. Fetch Project Entity
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    // 3. Artifacts Summary
    let allArtifacts: any[] = [];
    try {
      allArtifacts = await this.artifactRepo.findAllByProjectId(projectId);
    } catch {
      allArtifacts = [];
    }

    const files = allArtifacts.filter((a) => a.type === 'file');
    const folders = allArtifacts.filter((a) => a.type === 'folder');
    const totalStorageBytes = files.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);

    // 4. Team Members Count
    let membersCount = 1;
    try {
      const members = await this.collaborationRepo.listMembers(projectId);
      membersCount = members.length;
    } catch {
      membersCount = 1;
    }

    // 5. Native Git Status & Recent Commits
    let gitInfo: ProjectDashboardData['git'] = {
      isInitialized: false,
      cleanWorkingTree: true,
      modifiedCount: 0,
      stagedCount: 0,
      untrackedCount: 0,
      recentCommits: [],
    };
    let commitsCount = 0;

    try {
      const status = await this.gitSvc.getStatus(userId, projectId);
      if (status.isInitialized) {
        const history = await this.gitSvc.getHistory(userId, projectId, { limit: 5 });
        commitsCount = history.length;

        gitInfo = {
          isInitialized: true,
          currentBranch: status.currentBranch || undefined,
          cleanWorkingTree: status.totalChangesCount === 0,
          modifiedCount: status.unstaged.length,
          stagedCount: status.staged.length,
          untrackedCount: status.untracked.length,
          recentCommits: history.map((c) => ({
            hash: c.hash,
            shortHash: c.shortHash || c.hash.substring(0, 7),
            message: c.message,
            authorName: c.author.name,
            authorEmail: c.author.email,
            timestamp: c.timestamp,
          })),
        };
      }
    } catch {
      // Git repository might not be initialized
    }

    // 6. GitHub Remote Sync Status
    let githubInfo: ProjectDashboardData['github'] = {
      isLinked: false,
    };

    try {
      const remoteStatus = await this.githubSvc.getProjectRemoteStatus(userId, projectId);
      if (remoteStatus.isLinked && remoteStatus.remote) {
        githubInfo = {
          isLinked: true,
          repoUrl: remoteStatus.remote.remoteUrl,
          owner: remoteStatus.remote.owner,
          repo: remoteStatus.remote.repo,
          defaultBranch: remoteStatus.remote.defaultBranch,
          aheadBy: remoteStatus.ahead,
          behindBy: remoteStatus.behind,
          lastSyncAt: remoteStatus.remote.lastFetchedAt ? new Date(remoteStatus.remote.lastFetchedAt).toISOString() : null,
          lastSyncError: remoteStatus.lastSyncError,
        };
      }
    } catch {
      // Remote not linked or GitHub not configured
    }

    // 7. Reviews & Decisions
    let pendingReviews: ProjectDashboardData['pendingReviews'] = [];
    try {
      const rawReviews = await this.collaborationRepo.listReviews(projectId);
      const filtered = rawReviews.filter((r) => r.status === 'open' || (r.status as string) === 'pending');
      pendingReviews = filtered.slice(0, 5).map((r) => {
        const isAwaitingUser =
          r.reviewers?.some((reviewer: any) => reviewer.userId === userId && reviewer.hasDecided !== true) ||
          false;
        return {
          id: r.id,
          title: r.title,
          targetType: r.targetType,
          targetRef: r.targetRef,
          status: r.status,
          isAwaitingUser,
          approvalsCount: r.decisionsCount?.approved || 0,
          reviewersCount: r.reviewers?.length || 0,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        };
      });
    } catch {
      pendingReviews = [];
    }

    // 8. Tasks (Open, In-Progress, Overdue)
    let myTasks: ProjectDashboardData['myTasks'] = [];
    let openTasksCount = 0;
    let urgentTasksCount = 0;

    try {
      const allTasks = await this.collaborationRepo.listTasks(projectId, {});
      const now = new Date();

      const activeTasks = allTasks.filter((t: any) => t.status !== 'completed');
      openTasksCount = activeTasks.length;
      urgentTasksCount = activeTasks.filter((t: any) => t.priority === 'urgent' || t.priority === 'high').length;

      // Filter tasks relevant to current user or top urgent tasks
      const relevant = activeTasks.filter(
        (t: any) =>
          t.assigneeId === userId ||
          t.creatorId === userId ||
          t.priority === 'urgent' ||
          t.priority === 'high'
      );

      myTasks = relevant.slice(0, 6).map((t: any) => {
        const isOverdue = t.dueDate ? new Date(t.dueDate) < now && t.status !== 'completed' : false;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
          isOverdue,
          assignedToUser: t.assigneeId === userId,
          linkedArtifactId: t.linkedArtifactId,
        };
      });
    } catch {
      myTasks = [];
    }

    // 9. Impact Analysis Summary
    let impactSummary: ProjectDashboardData['impactSummary'] = {
      activeCount: 0,
      highSeverityCount: 0,
      unreviewedCount: 0,
      hasUnreviewedWarning: false,
      topImpacts: [],
    };

    try {
      const impactRes = await this.intelligenceSvc.getImpactAnalysis(userId, projectId);
      if (impactRes) {
        const active = impactRes.items.filter((i) => i.status === 'active');
        const highSev = impactRes.items.filter((i) => i.severity === 'high');
        const unreviewed = impactRes.items.filter((i) => i.status !== 'reviewed' && i.status !== 'dismissed');

        impactSummary = {
          activeCount: impactRes.impactCount,
          highSeverityCount: highSev.length,
          unreviewedCount: unreviewed.length,
          hasUnreviewedWarning: unreviewed.length > 0 && highSev.length > 0,
          topImpacts: impactRes.items.slice(0, 4).map((i) => ({
            impactKey: i.impactKey,
            changedArtifactPath: i.changedArtifact.path,
            affectedArtifactPath: i.affectedArtifact.path,
            relationshipType: i.relationshipType,
            severity: i.severity,
            reason: i.reason,
            status: i.status,
          })),
        };
      }
    } catch {
      // Impact computation optional if repository has no changes
    }

    // 10. Recent Activity Feed
    let recentActivity: ProjectDashboardData['recentActivity'] = [];
    try {
      const rawActivities = await this.intelligenceRepo.listActivities(projectId, 5);
      recentActivity = rawActivities.map((a: any) => ({
        id: a.id,
        eventType: a.eventType,
        entityType: a.entityType,
        summary: a.summary,
        createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
      }));
    } catch {
      recentActivity = [];
    }

    // 11. AI Assistant Config Status
    let aiConfig: { isConfigured: boolean; provider?: string } = { isConfigured: false, provider: undefined };
    try {
      const aiStatus = await this.assistantSvc.getConfig(userId, projectId);
      aiConfig = {
        isConfigured: aiStatus.configured,
        provider: aiStatus.provider || undefined,
      };
    } catch {
      aiConfig = { isConfigured: false, provider: undefined };
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        ownerId: project.ownerId,
        createdAt: project.createdAt ? new Date(project.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: project.updatedAt ? new Date(project.updatedAt).toISOString() : new Date().toISOString(),
      },
      currentUserRole: effectiveRole,
      stats: {
        filesCount: files.length,
        foldersCount: folders.length,
        totalStorageBytes,
        commitsCount,
        openTasksCount,
        urgentTasksCount,
        pendingReviewsCount: pendingReviews.length,
        unreviewedImpactCount: impactSummary.unreviewedCount,
        membersCount,
      },
      git: gitInfo,
      github: githubInfo,
      pendingReviews,
      myTasks,
      impactSummary,
      recentActivity,
      aiAssistant: aiConfig,
    };
  }

  /**
   * Unified cross-entity search across artifacts, tasks, reviews, and commits.
   */
  async searchProject(
    userId: string,
    projectId: string,
    query: string,
    category: SearchCategory = 'all'
  ): Promise<ProjectSearchResponse> {
    await this.collaborationSvc.checkProjectAccess(userId, projectId, 'viewer');

    const q = (query || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      return {
        query,
        totalCount: 0,
        artifacts: [],
        tasks: [],
        reviews: [],
        commits: [],
      };
    }

    const searchAll = category === 'all';

    // 1. Artifacts Search
    let matchedArtifacts: ProjectSearchResponse['artifacts'] = [];
    if (searchAll || category === 'artifacts') {
      try {
        const artifacts = await this.artifactRepo.findAllByProjectId(projectId);
        matchedArtifacts = artifacts
          .filter((a: any) => {
            const nameMatch = a.name.toLowerCase().includes(q);
            const pathMatch = a.path.toLowerCase().includes(q);
            return nameMatch || pathMatch;
          })
          .slice(0, 15)
          .map((a: any) => ({
            id: a.id,
            name: a.name,
            path: a.path,
            type: a.type,
            artifactType: a.artifactType,
            sizeBytes: a.sizeBytes || 0,
            matchSnippet: a.path,
          }));
      } catch {
        matchedArtifacts = [];
      }
    }

    // 2. Tasks Search
    let matchedTasks: ProjectSearchResponse['tasks'] = [];
    if (searchAll || category === 'tasks') {
      try {
        const tasks = await this.collaborationRepo.listTasks(projectId, { search: q });
        matchedTasks = tasks.slice(0, 15).map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          linkedArtifactId: t.linkedArtifactId,
        }));
      } catch {
        matchedTasks = [];
      }
    }

    // 3. Reviews Search
    let matchedReviews: ProjectSearchResponse['reviews'] = [];
    if (searchAll || category === 'reviews') {
      try {
        const reviews = await this.collaborationRepo.listReviews(projectId);
        matchedReviews = reviews
          .filter((r: any) => {
            const titleMatch = r.title.toLowerCase().includes(q);
            const descMatch = (r.description || '').toLowerCase().includes(q);
            const refMatch = r.targetRef.toLowerCase().includes(q);
            return titleMatch || descMatch || refMatch;
          })
          .slice(0, 15)
          .map((r: any) => ({
            id: r.id,
            title: r.title,
            targetType: r.targetType,
            targetRef: r.targetRef,
            status: r.status,
          }));
      } catch {
        matchedReviews = [];
      }
    }

    // 4. Git Commits Search
    let matchedCommits: ProjectSearchResponse['commits'] = [];
    if (searchAll || category === 'commits') {
      try {
        const commits = await this.gitSvc.getHistory(userId, projectId, { limit: 50 });
        matchedCommits = commits
          .filter((c) => {
            const hashMatch = c.hash.toLowerCase().includes(q);
            const msgMatch = c.message.toLowerCase().includes(q);
            const authorMatch = c.author.name.toLowerCase().includes(q);
            return hashMatch || msgMatch || authorMatch;
          })
          .slice(0, 15)
          .map((c) => ({
            hash: c.hash,
            shortHash: c.shortHash || c.hash.substring(0, 7),
            message: c.message,
            author: c.author.name,
            timestamp: c.timestamp,
          }));
      } catch {
        matchedCommits = [];
      }
    }

    const totalCount =
      matchedArtifacts.length + matchedTasks.length + matchedReviews.length + matchedCommits.length;

    return {
      query,
      totalCount,
      artifacts: matchedArtifacts,
      tasks: matchedTasks,
      reviews: matchedReviews,
      commits: matchedCommits,
    };
  }

  /**
   * Retrieves full 360-degree workflow context for a specific artifact or commit.
   * Connects file changes -> impacts -> linked tasks -> reviews.
   */
  async getWorkflowContext(
    userId: string,
    projectId: string,
    options: { artifactId?: string; commitHash?: string }
  ): Promise<WorkflowContextResponse> {
    await this.collaborationSvc.checkProjectAccess(userId, projectId, 'viewer');

    let artifact: any = null;
    let artifactId = options.artifactId;

    if (artifactId) {
      artifact = await this.artifactRepo.findById(artifactId);
    }

    // 1. Upstream & Downstream Relationships
    let upstreamRelationships: WorkflowContextResponse['upstreamRelationships'] = [];
    let downstreamRelationships: WorkflowContextResponse['downstreamRelationships'] = [];

    if (artifactId) {
      try {
        const relationships = await this.intelligenceSvc.listRelationships(userId, projectId);
        // Upstream: other artifacts that this artifact depends on (target is this artifact)
        upstreamRelationships = relationships
          .filter((r) => r.targetArtifactId === artifactId)
          .map((r) => ({
            id: r.id,
            sourceName: r.sourceArtifact?.name || r.sourceArtifactId,
            relationshipType: r.relationshipType,
            description: r.description,
          }));

        // Downstream: other artifacts that depend on this artifact (source is this artifact)
        downstreamRelationships = relationships
          .filter((r) => r.sourceArtifactId === artifactId)
          .map((r) => ({
            id: r.id,
            targetName: r.targetArtifact?.name || r.targetArtifactId,
            relationshipType: r.relationshipType,
            description: r.description,
          }));
      } catch {
        upstreamRelationships = [];
        downstreamRelationships = [];
      }
    }

    // 2. Impacts
    let impacts: WorkflowContextResponse['impacts'] = [];
    try {
      const impactRes = await this.intelligenceSvc.getImpactAnalysis(userId, projectId);
      if (impactRes && impactRes.items) {
        impacts = impactRes.items
          .filter((item) => {
            if (!artifactId && !artifact) return true;
            return (
              item.changedArtifact.id === artifactId ||
              item.affectedArtifact.id === artifactId ||
              (artifact && (item.changedArtifact.path === artifact.path || item.affectedArtifact.path === artifact.path))
            );
          })
          .map((i) => ({
            impactKey: i.impactKey,
            affectedName: i.affectedArtifact.name,
            affectedPath: i.affectedArtifact.path,
            severity: i.severity,
            reason: i.reason,
            status: i.status,
          }));
      }
    } catch {
      impacts = [];
    }

    // 3. Related Tasks
    let relatedTasks: WorkflowContextResponse['relatedTasks'] = [];
    if (artifactId) {
      try {
        const tasks = await this.collaborationRepo.listTasks(projectId, {});
        relatedTasks = tasks
          .filter((t: any) => t.linkedArtifactId === artifactId)
          .map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
          }));
      } catch {
        relatedTasks = [];
      }
    }

    // 4. Related Reviews
    let relatedReviews: WorkflowContextResponse['relatedReviews'] = [];
    try {
      const reviews = await this.collaborationRepo.listReviews(projectId);
      relatedReviews = reviews
        .filter((r: any) => {
          if (options.commitHash && r.targetRef.includes(options.commitHash)) return true;
          if (artifact && (r.targetRef === artifact.name || r.targetRef === artifact.path)) return true;
          return false;
        })
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          targetRef: r.targetRef,
        }));
    } catch {
      relatedReviews = [];
    }

    // 5. Git Commit Details (if commitHash is provided)
    let gitCommit: WorkflowContextResponse['gitCommit'] = null;
    if (options.commitHash) {
      try {
        const commitDetail = await this.gitSvc.getCommit(userId, projectId, options.commitHash);
        gitCommit = {
          hash: commitDetail.commit.hash,
          message: commitDetail.commit.message,
          files: commitDetail.files.map((f) => ({
            path: f.path,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
          })),
        };
      } catch {
        gitCommit = null;
      }
    }

    return {
      artifactId: artifact?.id,
      artifactName: artifact?.name,
      artifactPath: artifact?.path,
      commitHash: options.commitHash,
      upstreamRelationships,
      downstreamRelationships,
      impacts,
      relatedTasks,
      relatedReviews,
      gitCommit,
    };
  }
}

export const workflowService = new WorkflowService();
