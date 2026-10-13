import { test, describe } from 'node:test';
import assert from 'node:assert';
import { WorkflowService } from './workflow.service';
import { redactGitHubCredentials } from '../github/github.service';
import { ProjectNotFoundError, ProjectForbiddenError } from '../projects/project.errors';

describe('WorkflowService (Unit Tests)', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '22222222-2222-2222-2222-222222222222';
  const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockProject = {
    id: projectId,
    name: 'Neural Network Optimizer',
    description: 'Optimization framework for deep models',
    ownerId: userId,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  };

  const mockArtifacts = [
    { id: 'art-1', projectId, name: 'train.py', path: '/train.py', type: 'file', artifactType: 'code', sizeBytes: 1024 },
    { id: 'art-2', projectId, name: 'model.onnx', path: '/model.onnx', type: 'file', artifactType: 'model', sizeBytes: 2048 },
    { id: 'art-3', projectId, name: 'scripts', path: '/scripts', type: 'folder', artifactType: 'folder', sizeBytes: 0 },
  ];

  const mockTasks = [
    {
      id: 'task-1',
      projectId,
      title: 'Benchmark ONNX model latency',
      description: 'Run benchmark script on validation set',
      status: 'in_progress',
      priority: 'urgent',
      assigneeId: userId,
      creatorId: userId,
      dueDate: new Date(Date.now() - 3600000).toISOString(), // Overdue
      linkedArtifactId: 'art-2',
    },
    {
      id: 'task-2',
      projectId,
      title: 'Update documentation for train.py',
      description: 'Add docstrings to optimizer functions',
      status: 'todo',
      priority: 'low',
      assigneeId: otherUserId,
      creatorId: userId,
      dueDate: new Date(Date.now() + 86400000).toISOString(), // Future
      linkedArtifactId: 'art-1',
    },
    {
      id: 'task-3',
      projectId,
      title: 'Fix CUDA memory leak',
      description: 'Resolved memory leak',
      status: 'completed',
      priority: 'high',
      assigneeId: userId,
      creatorId: userId,
      dueDate: null,
      linkedArtifactId: null,
    },
  ];

  const mockReviews = [
    {
      id: 'rev-1',
      projectId,
      title: 'Review train.py optimizer tuning',
      description: 'Adjusted AdamW weight decay',
      targetType: 'artifact',
      targetRef: '/train.py',
      status: 'pending',
      reviewers: [{ userId, hasDecided: false }, { userId: otherUserId, hasDecided: true }],
      decisionsCount: { approved: 1, rejected: 0 },
      createdAt: new Date(),
    },
  ];

  const mockRelationships = [
    {
      id: 'rel-1',
      sourceArtifactId: 'art-1',
      targetArtifactId: 'art-2',
      relationshipType: 'generated_from',
      description: 'train.py exports model.onnx',
      sourceArtifact: { name: 'train.py' },
      targetArtifact: { name: 'model.onnx' },
    },
  ];

  const mockImpactRes = {
    impactCount: 1,
    generatedAt: new Date().toISOString(),
    items: [
      {
        impactKey: 'art-1->art-2',
        changedArtifact: { id: 'art-1', name: 'train.py', path: '/train.py', changeType: 'modified' },
        affectedArtifact: { id: 'art-2', name: 'model.onnx', path: '/model.onnx' },
        relationshipType: 'generated_from',
        severity: 'high' as const,
        reason: 'Modified train.py affects generated artifact model.onnx',
        status: 'active' as const,
      },
    ],
  };

  const createMockService = (overrides: any = {}) => {
    const projectRepo: any = {
      findById: async (id: string) => (id === projectId ? mockProject : null),
      ...overrides.projectRepo,
    };
    const artifactRepo: any = {
      findAllByProjectId: async () => mockArtifacts,
      findById: async (id: string) => mockArtifacts.find((a) => a.id === id) || null,
      ...overrides.artifactRepo,
    };
    const collaborationSvc: any = {
      checkProjectAccess: async (uId: string, pId: string) => {
        if (pId !== projectId) throw new ProjectNotFoundError();
        if (uId !== userId) throw new ProjectForbiddenError('Not a member');
        return { project: mockProject, effectiveRole: 'owner' };
      },
      ...overrides.collaborationSvc,
    };
    const collaborationRepo: any = {
      listMembers: async () => [{ userId, role: 'owner' }, { userId: otherUserId, role: 'maintainer' }],
      listReviews: async () => mockReviews,
      listTasks: async () => mockTasks,
      ...overrides.collaborationRepo,
    };
    const gitSvc: any = {
      getStatus: async () => ({
        isInitialized: true,
        currentBranch: 'main',
        isClean: false,
        staged: [],
        unstaged: [{ path: 'train.py', status: 'modified' }],
        untracked: [],
        totalChangesCount: 1,
      }),
      getHistory: async () => [
        {
          hash: 'abc1234567890abcdef1234567890abcdef123456',
          shortHash: 'abc1234',
          message: 'Update optimizer learning rate schedule',
          author: { name: 'Alice Researcher', email: 'alice@versora.io' },
          timestamp: '2025-01-02T12:00:00Z',
        },
      ],
      getCommit: async () => ({
        commit: {
          hash: 'abc1234567890abcdef1234567890abcdef123456',
          message: 'Update optimizer learning rate schedule',
          author: { name: 'Alice Researcher', email: 'alice@versora.io' },
          timestamp: '2025-01-02T12:00:00Z',
        },
        files: [{ path: 'train.py', status: 'modified', additions: 10, deletions: 4 }],
      }),
      ...overrides.gitSvc,
    };
    const intelligenceSvc: any = {
      listRelationships: async () => mockRelationships,
      getImpactAnalysis: async () => mockImpactRes,
      ...overrides.intelligenceSvc,
    };
    const intelligenceRepo: any = {
      listActivities: async () => [
        { id: 'act-1', eventType: 'git.commit', entityType: 'commit', summary: 'Committed abc1234', createdAt: new Date() },
      ],
      ...overrides.intelligenceRepo,
    };
    const githubSvc: any = {
      getProjectRemoteStatus: async () => ({
        isLinked: true,
        remote: {
          htmlUrl: 'https://github.com/versora/neural-net',
          owner: 'versora',
          repo: 'neural-net',
          defaultBranch: 'main',
        },
        aheadBy: 1,
        behindBy: 0,
        lastFetchedAt: new Date(),
        lastSyncError: null,
      }),
      ...overrides.githubSvc,
    };
    const assistantSvc: any = {
      getConfig: async () => ({ configured: true, provider: 'mock', model: 'mock-test' }),
      ...overrides.assistantSvc,
    };

    return new WorkflowService(
      projectRepo,
      artifactRepo,
      collaborationSvc,
      collaborationRepo,
      gitSvc,
      intelligenceSvc,
      intelligenceRepo,
      githubSvc,
      assistantSvc
    );
  };

  test('getProjectDashboard: returns aggregated real dashboard data for project member', async () => {
    const service = createMockService();
    const dashboard = await service.getProjectDashboard(userId, projectId);

    assert.strictEqual(dashboard.project.id, projectId);
    assert.strictEqual(dashboard.project.name, 'Neural Network Optimizer');
    assert.strictEqual(dashboard.currentUserRole, 'owner');

    // Stats
    assert.strictEqual(dashboard.stats.filesCount, 2);
    assert.strictEqual(dashboard.stats.foldersCount, 1);
    assert.strictEqual(dashboard.stats.totalStorageBytes, 3072);
    assert.strictEqual(dashboard.stats.openTasksCount, 2); // 2 active, 1 completed
    assert.strictEqual(dashboard.stats.urgentTasksCount, 1); // 1 urgent
    assert.strictEqual(dashboard.stats.pendingReviewsCount, 1);
    assert.strictEqual(dashboard.stats.unreviewedImpactCount, 1);
    assert.strictEqual(dashboard.stats.membersCount, 2);

    // Git
    assert.strictEqual(dashboard.git.isInitialized, true);
    assert.strictEqual(dashboard.git.currentBranch, 'main');
    assert.strictEqual(dashboard.git.recentCommits.length, 1);

    // GitHub
    assert.strictEqual(dashboard.github.isLinked, true);
    assert.strictEqual(dashboard.github.repo, 'neural-net');

    // Pending Reviews
    assert.strictEqual(dashboard.pendingReviews.length, 1);
    assert.strictEqual(dashboard.pendingReviews[0].isAwaitingUser, true);

    // My Tasks & Overdue detection
    assert.strictEqual(dashboard.myTasks.length, 2);
    const overdueTask = dashboard.myTasks.find((t) => t.id === 'task-1');
    assert.strictEqual(overdueTask?.isOverdue, true);

    // Impact Summary
    assert.strictEqual(dashboard.impactSummary.activeCount, 1);
    assert.strictEqual(dashboard.impactSummary.hasUnreviewedWarning, true);

    // AI status
    assert.strictEqual(dashboard.aiAssistant.isConfigured, true);
  });

  test('getProjectDashboard: rejects non-member with 403 error', async () => {
    const service = createMockService();
    await assert.rejects(
      async () => service.getProjectDashboard(otherUserId, projectId),
      (err: any) => err instanceof ProjectForbiddenError
    );
  });

  test('getProjectDashboard: handles uninitialized Git repository gracefully', async () => {
    const service = createMockService({
      gitSvc: {
        getStatus: async () => ({ isInitialized: false, totalChangesCount: 0, staged: [], unstaged: [], untracked: [] }),
      },
    });

    const dashboard = await service.getProjectDashboard(userId, projectId);
    assert.strictEqual(dashboard.git.isInitialized, false);
    assert.strictEqual(dashboard.git.recentCommits.length, 0);
  });

  test('searchProject: returns matches across artifacts, tasks, reviews, and commits', async () => {
    const service = createMockService();
    const result = await service.searchProject(userId, projectId, 'train');

    assert.strictEqual(result.query, 'train');
    assert.ok(result.totalCount >= 2);
    assert.ok(result.artifacts.some((a) => a.name.includes('train')));
    assert.ok(result.tasks.some((t) => t.title.includes('train')));
    assert.ok(result.reviews.some((r) => r.title.includes('train')));
  });

  test('searchProject: filters by category when specified', async () => {
    const service = createMockService();
    const result = await service.searchProject(userId, projectId, 'train', 'artifacts');

    assert.ok(result.artifacts.length > 0);
    assert.strictEqual(result.tasks.length, 0);
    assert.strictEqual(result.reviews.length, 0);
    assert.strictEqual(result.commits.length, 0);
  });

  test('searchProject: returns zero results for queries shorter than 2 characters', async () => {
    const service = createMockService();
    const result = await service.searchProject(userId, projectId, 'a');

    assert.strictEqual(result.totalCount, 0);
    assert.strictEqual(result.artifacts.length, 0);
  });

  test('getWorkflowContext: returns upstream/downstream relationships, impacts, tasks, and reviews', async () => {
    const service = createMockService();
    const context = await service.getWorkflowContext(userId, projectId, {
      artifactId: 'art-1',
      commitHash: 'abc1234567890abcdef1234567890abcdef123456',
    });

    assert.strictEqual(context.artifactId, 'art-1');
    assert.strictEqual(context.artifactName, 'train.py');
    assert.strictEqual(context.downstreamRelationships.length, 1);
    assert.strictEqual(context.downstreamRelationships[0].targetName, 'model.onnx');
    assert.strictEqual(context.impacts.length, 1);
    assert.strictEqual(context.relatedTasks.length, 1);
    assert.strictEqual(context.relatedReviews.length, 1);
    assert.ok(context.gitCommit);
    assert.strictEqual(context.gitCommit.hash, 'abc1234567890abcdef1234567890abcdef123456');
  });

  test('redactGitHubCredentials: comprehensively strips sensitive tokens and credentials from logs', () => {
    const tokenMsg = 'fatal: unable to access https://x-access-token:ghp_123456789012345678901234567890123456@github.com/versora/repo.git';
    const redacted = redactGitHubCredentials(tokenMsg);

    assert.strictEqual(redacted.includes('ghp_123456789012345678901234567890123456'), false);
    assert.strictEqual(redacted.includes('https://***@github.com'), true);

    const headerMsg = 'Authorization header failed for x-access-token:secret12345';
    const redactedHeader = redactGitHubCredentials(headerMsg);
    assert.strictEqual(redactedHeader.includes('secret12345'), false);
    assert.strictEqual(redactedHeader.includes('x-access-token:***'), true);

    const patMsg = 'error with token github_pat_11ABCDEF1234567890abcdefghijklmnopqrstuvwxyz_1234567890';
    const redactedPat = redactGitHubCredentials(patMsg);
    assert.strictEqual(redactedPat.includes('github_pat_***'), true);
  });
});
