import { ProjectContextData, EvidenceReference } from '../assistant.types';
import { projectRepository, IProjectRepository } from '../../projects/project.repository';
import { artifactService, IArtifactService } from '../../artifacts/artifact.service';
import { isTextArtifact } from '../../artifacts/artifact.types';
import { intelligenceService, IIntelligenceService } from '../../intelligence/intelligence.service';
import { gitService, IGitService } from '../../git/git.service';
import { collaborationService, ICollaborationService } from '../../collaboration/collaboration.service';

export interface ContextRetrievalOptions {
  targetArtifactId?: string;
  targetCommitHash?: string;
  targetReviewId?: string;
  maxArtifactsWithContent?: number;
  maxContentCharsPerFile?: number;
  maxTotalChars?: number;
}

export class ContextRetrieverService {
  constructor(
    private projectRepo: IProjectRepository = projectRepository,
    private artifactSvc: IArtifactService = artifactService,
    private intelligenceSvc: IIntelligenceService = intelligenceService,
    private gitSvc: IGitService = gitService,
    private collaborationSvc: ICollaborationService = collaborationService
  ) {}

  async retrieveProjectContext(
    userId: string,
    projectId: string,
    userQuery: string,
    options: ContextRetrievalOptions = {}
  ): Promise<{ data: ProjectContextData; formattedPromptContext: string }> {
    const maxArtifacts = options.maxArtifactsWithContent || 5;
    const maxCharsPerFile = options.maxContentCharsPerFile || 3500;
    const maxTotalChars = options.maxTotalChars || 15000;

    // 1. Fetch Project Details
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    // 2. Fetch Artifacts & Relevant Contents
    let allArtifacts: any[] = [];
    try {
      allArtifacts = await this.artifactSvc.listArtifacts(userId, projectId, undefined);
    } catch {
      allArtifacts = [];
    }

    const filesOnly = allArtifacts.filter((a) => a.type === 'file');

    // Extract search terms from user query
    const keywords = this.extractKeywords(userQuery);

    // Score files for relevance
    const scoredFiles = filesOnly.map((file) => {
      let score = 0;
      if (options.targetArtifactId && file.id === options.targetArtifactId) {
        score += 100;
      }
      const lowerName = file.name.toLowerCase();
      const lowerPath = file.path.toLowerCase();

      for (const kw of keywords) {
        if (lowerName.includes(kw)) score += 10;
        if (lowerPath.includes(kw)) score += 5;
      }
      return { file, score };
    });

    // Sort by relevance score
    scoredFiles.sort((a, b) => b.score - a.score);

    const matchedArtifacts: ProjectContextData['artifactsSummary']['matchedArtifacts'] = [];
    let filesLoaded = 0;

    for (const item of scoredFiles) {
      const file = item.file;
      const isTarget = options.targetArtifactId === file.id;
      const hasRelevance = item.score > 0 || isTarget || filesOnly.length <= 4;

      if (!hasRelevance && filesLoaded >= 3) {
        matchedArtifacts.push({
          id: file.id,
          name: file.name,
          path: file.path,
          type: file.type,
          artifactType: file.artifactType,
          sizeBytes: file.sizeBytes,
        });
        continue;
      }

      const isText = isTextArtifact(file.name || file.path || '', file.mimeType);

      if (filesLoaded < maxArtifacts && isText) {
        try {
          const contentRes = await this.artifactSvc.getArtifactContent(userId, projectId, file.id);
          const rawText = contentRes.content || '';
          const snippet =
            rawText.length > maxCharsPerFile
              ? rawText.substring(0, maxCharsPerFile) + '\n... [truncated for context limit]'
              : rawText;

          matchedArtifacts.push({
            id: file.id,
            name: file.name,
            path: file.path,
            type: file.type,
            artifactType: file.artifactType,
            sizeBytes: file.sizeBytes,
            contentSnippet: snippet,
          });
          filesLoaded++;
        } catch {
          matchedArtifacts.push({
            id: file.id,
            name: file.name,
            path: file.path,
            type: file.type,
            artifactType: file.artifactType,
            sizeBytes: file.sizeBytes,
            contentSnippet: '[Error reading file content]',
          });
        }
      } else {
        matchedArtifacts.push({
          id: file.id,
          name: file.name,
          path: file.path,
          type: file.type,
          artifactType: file.artifactType,
          sizeBytes: file.sizeBytes,
          contentSnippet: isText
            ? undefined
            : `[Non-text artifact format (${file.artifactType}, size: ${file.sizeBytes} bytes)]`,
          isBinaryOrLarge: !isText,
        });
      }
    }

    // 3. Artifact Relationships & Traceability
    let relationships: ProjectContextData['relationships'] = [];
    try {
      const rawRels = await this.intelligenceSvc.listRelationships(userId, projectId);
      relationships = rawRels.slice(0, 10).map((r) => ({
        id: r.id,
        sourceName: r.sourceArtifact?.name || r.sourceArtifactId,
        targetName: r.targetArtifact?.name || r.targetArtifactId,
        relationshipType: r.relationshipType,
        description: r.description,
      }));
    } catch {
      relationships = [];
    }

    // 4. Impact Analysis
    let impactAnalysis: ProjectContextData['impactAnalysis'] = undefined;
    try {
      const rawImpact = await this.intelligenceSvc.getImpactAnalysis(userId, projectId);
      if (rawImpact && rawImpact.items.length > 0) {
        impactAnalysis = {
          activeImpactsCount: rawImpact.impactCount,
          items: rawImpact.items.slice(0, 8).map((i) => ({
            changedName: i.changedArtifact.name,
            affectedName: i.affectedArtifact.name,
            relationshipType: i.relationshipType,
            severity: i.severity,
            reason: i.reason,
          })),
        };
      }
    } catch {
      impactAnalysis = undefined;
    }

    // 5. Git State & History
    let gitSummary: ProjectContextData['gitSummary'] = undefined;
    try {
      const status = await this.gitSvc.getStatus(userId, projectId);
      if (status.isInitialized) {
        const history = await this.gitSvc.getHistory(userId, projectId, { limit: 8 });
        let targetCommitDiff: string | undefined = undefined;

        // Check if query or options reference a specific commit hash
        const commitHashMatch =
          options.targetCommitHash ||
          userQuery.match(/\b([0-9a-f]{7,40})\b/i)?.[1];

        if (commitHashMatch) {
          try {
            const commitDetail = await this.gitSvc.getCommit(userId, projectId, commitHashMatch);
            const diffSummary = commitDetail.files
              .map((f) => `File ${f.path} (${f.status}): +${f.additions} -${f.deletions}`)
              .join('\n');
            const patchSnippet = commitDetail.files
              .map((f) => f.diff || '')
              .filter(Boolean)
              .join('\n')
              .substring(0, 3000);
            targetCommitDiff = `Target Commit: ${commitDetail.commit.hash} - "${commitDetail.commit.message}"\n${diffSummary}\n\nDiff excerpt:\n${patchSnippet}`;
          } catch {
            // Commit not found
          }
        }

        const allChanges = [...status.staged, ...status.unstaged, ...status.untracked];

        gitSummary = {
          isInitialized: true,
          currentBranch: status.currentBranch,
          recentCommits: history.map((c) => ({
            hash: c.hash,
            message: c.message,
            author: `${c.author.name} <${c.author.email}>`,
            date: c.timestamp,
          })),
          workingTreeStatus: {
            totalChanges: status.totalChangesCount,
            modified: allChanges.filter((c) => c.status === 'modified').map((c) => c.path),
            untracked: status.untracked.map((c) => c.path),
            deleted: allChanges.filter((c) => c.status === 'deleted').map((c) => c.path),
          },
          targetCommitDiff,
        };
      } else {
        gitSummary = {
          isInitialized: false,
          recentCommits: [],
        };
      }
    } catch {
      gitSummary = undefined;
    }

    // 6. Reviews & Approvals
    let reviews: ProjectContextData['reviews'] = [];
    try {
      const rawReviews = await this.collaborationSvc.listReviews(userId, projectId);
      reviews = rawReviews.slice(0, 8).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        targetType: r.targetType,
        targetRef: r.targetRef,
        reviewersCount: r.reviewers?.length || 0,
        approvalsCount: r.decisionsCount?.approved || 0,
      }));
    } catch {
      reviews = [];
    }

    // 7. Tasks & Issues
    let tasks: ProjectContextData['tasks'] = [];
    try {
      const rawTasks = await this.collaborationSvc.listTasks(userId, projectId, {});
      tasks = rawTasks.slice(0, 10).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assignee?.displayName || t.assignee?.username,
      }));
    } catch {
      tasks = [];
    }

    // 8. Recent Activities
    let recentActivities: ProjectContextData['recentActivities'] = [];
    try {
      const rawActivities = await this.intelligenceSvc.listActivities(userId, projectId, { limit: 8 });
      recentActivities = rawActivities.map((a) => ({
        eventType: a.eventType,
        summary: a.summary,
        timestamp: a.createdAt,
      }));
    } catch {
      recentActivities = [];
    }

    const contextData: ProjectContextData = {
      projectId: project.id,
      projectName: project.name,
      projectDescription: project.description,
      ownerId: project.ownerId,
      artifactsSummary: {
        totalCount: filesOnly.length,
        matchedArtifacts,
      },
      relationships,
      impactAnalysis,
      gitSummary,
      reviews,
      tasks,
      recentActivities,
    };

    const formattedPromptContext = this.formatContextToPrompt(contextData, maxTotalChars);

    return {
      data: contextData,
      formattedPromptContext,
    };
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'to', 'in', 'of', 'for',
      'with', 'about', 'can', 'you', 'what', 'how', 'why', 'who', 'does', 'this', 'that',
      'please', 'tell', 'me', 'show', 'explain', 'summarize', 'project',
    ]);

    return query
      .toLowerCase()
      .replace(/[^a-z0-9_\-\.\/]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  private formatContextToPrompt(data: ProjectContextData, maxTotalChars: number): string {
    const parts: string[] = [];

    parts.push(`=== PROJECT METADATA ===`);
    parts.push(`Name: ${data.projectName}`);
    parts.push(`ID: ${data.projectId}`);
    if (data.projectDescription) {
      parts.push(`Description: ${data.projectDescription}`);
    }

    // Artifacts & Files
    parts.push(`\n=== PROJECT ARTIFACTS (${data.artifactsSummary.totalCount} files) ===`);
    for (const item of data.artifactsSummary.matchedArtifacts) {
      parts.push(`- File: ${item.name} (Path: ${item.path}, Type: ${item.artifactType}, Size: ${item.sizeBytes} bytes)`);
      if (item.contentSnippet) {
        parts.push(`  Content Excerpt:\n\`\`\`\n${item.contentSnippet}\n\`\`\``);
      }
    }

    // Relationships
    if (data.relationships.length > 0) {
      parts.push(`\n=== ARTIFACT RELATIONSHIPS & TRACEABILITY ===`);
      for (const rel of data.relationships) {
        parts.push(`- [${rel.sourceName}] --(${rel.relationshipType})--> [${rel.targetName}]${rel.description ? `: ${rel.description}` : ''}`);
      }
    }

    // Impact Analysis
    if (data.impactAnalysis && data.impactAnalysis.items.length > 0) {
      parts.push(`\n=== PREDICTED CHANGE IMPACTS (${data.impactAnalysis.activeImpactsCount} active) ===`);
      for (const imp of data.impactAnalysis.items) {
        parts.push(`- Potential Impact: Modifying "${imp.changedName}" may affect "${imp.affectedName}" (${imp.relationshipType}, severity: ${imp.severity}). Reason: ${imp.reason}`);
      }
    }

    // Git Version Control
    if (data.gitSummary && data.gitSummary.isInitialized) {
      parts.push(`\n=== GIT VERSION CONTROL ===`);
      parts.push(`Current Branch: ${data.gitSummary.currentBranch || 'main'}`);
      if (data.gitSummary.workingTreeStatus) {
        const wt = data.gitSummary.workingTreeStatus;
        parts.push(`Working Tree Changes: ${wt.totalChanges} total (Modified: [${wt.modified.join(', ')}], Untracked: [${wt.untracked.join(', ')}])`);
      }
      if (data.gitSummary.recentCommits.length > 0) {
        parts.push(`Recent Commits:`);
        for (const c of data.gitSummary.recentCommits) {
          parts.push(`- Hash: ${c.hash.substring(0, 8)} | Author: ${c.author} | Date: ${c.date} | Msg: ${c.message}`);
        }
      }
      if (data.gitSummary.targetCommitDiff) {
        parts.push(`\n=== SPECIFIC COMMIT INSPECTION ===\n${data.gitSummary.targetCommitDiff}`);
      }
    }

    // Reviews
    if (data.reviews.length > 0) {
      parts.push(`\n=== CODE & ARTIFACT REVIEWS ===`);
      for (const rev of data.reviews) {
        parts.push(`- Review [ID: ${rev.id}]: "${rev.title}" (Status: ${rev.status}, Target: ${rev.targetType}:${rev.targetRef}, Approvals: ${rev.approvalsCount}/${rev.reviewersCount})`);
      }
    }

    // Tasks
    if (data.tasks.length > 0) {
      parts.push(`\n=== PROJECT TASKS & ISSUES ===`);
      for (const task of data.tasks) {
        parts.push(`- Task [ID: ${task.id}]: "${task.title}" (Status: ${task.status}, Priority: ${task.priority}${task.assigneeName ? `, Assignee: @${task.assigneeName}` : ''})`);
      }
    }

    // Activities
    if (data.recentActivities.length > 0) {
      parts.push(`\n=== RECENT PROJECT ACTIVITY TIMELINE ===`);
      for (const act of data.recentActivities) {
        parts.push(`- [${act.timestamp}] ${act.summary}`);
      }
    }

    const fullPrompt = parts.join('\n');
    if (fullPrompt.length > maxTotalChars) {
      return fullPrompt.substring(0, maxTotalChars) + '\n... [Context truncated to fit model limit]';
    }
    return fullPrompt;
  }
}

export const contextRetrieverService = new ContextRetrieverService();
