import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AssistantService } from './assistant.service';
import { IAssistantRepository } from './assistant.repository';
import { ContextRetrieverService } from './context/context-retriever.service';
import { EvidenceExtractorService } from './context/evidence-extractor.service';
import { MockAIProvider } from './providers/mock.provider';
import { AIProviderFactory } from './providers/provider.factory';
import { IProjectRepository } from '../projects/project.repository';
import { IUserRepository } from '../users/user.repository';
import { IArtifactRepository } from '../artifacts/artifact.repository';
import { IGitService } from '../git/git.service';
import { IIntelligenceService } from '../intelligence/intelligence.service';
import { CollaborationService } from '../collaboration/collaboration.service';
import {
  AIProviderNotConfiguredError,
  AIProviderError,
  AIProviderTimeoutError,
  AIProviderRateLimitError,
  ConversationNotFoundError,
  ConversationForbiddenError,
} from './assistant.errors';
import { ProjectNotFoundError, ProjectForbiddenError } from '../projects/project.errors';
import {
  AssistantConversation,
  AssistantMessage,
  ProjectContextData,
} from './assistant.types';

describe('Assistant Service (Unit Tests)', () => {
  const ownerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const outsiderId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  const artifactId = crypto.randomUUID();

  let conversations: any[];
  let messages: any[];
  let mockProvider: MockAIProvider;
  let assistantService: AssistantService;

  // Mock repositories and services
  let mockAssistantRepo: IAssistantRepository;
  let mockProjectRepo: IProjectRepository;
  let mockUserRepo: IUserRepository;
  let mockArtifactRepo: IArtifactRepository;
  let mockGitSvc: IGitService;
  let mockIntelligenceSvc: IIntelligenceService;
  let mockCollaborationSvc: CollaborationService;
  let contextRetriever: ContextRetrieverService;
  let evidenceExtractor: EvidenceExtractorService;

  beforeEach(() => {
    conversations = [];
    messages = [];
    mockProvider = new MockAIProvider({
      mockResponse:
        'This is a grounded answer for Versora.\n\nEvidence: We verified artifact /src/index.ts and task #1.',
    });
    AIProviderFactory.setProviderOverride(mockProvider);

    mockAssistantRepo = {
      async createConversation(data) {
        const row = {
          id: crypto.randomUUID(),
          projectId: data.projectId,
          userId: data.userId,
          title: data.title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        conversations.push(row);
        return row;
      },
      async findConversationById(id) {
        return conversations.find((c) => c.id === id) || null;
      },
      async listConversationsByUser(projId, userId) {
        return conversations.filter((c) => c.userId === userId && c.projectId === projId);
      },
      async updateConversationTitle(id, title) {
        const conv = conversations.find((c) => c.id === id);
        if (!conv) throw new Error('Not found');
        conv.title = title;
        conv.updatedAt = new Date().toISOString();
        return conv;
      },
      async deleteConversation(id) {
        const idx = conversations.findIndex((c) => c.id === id);
        if (idx >= 0) {
          conversations.splice(idx, 1);
        }
      },
      async createMessage(data) {
        const msg = {
          id: crypto.randomUUID(),
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          sources: data.sources || [],
          uncertaintyNote: data.uncertaintyNote || null,
          metadata: data.metadata || null,
          createdAt: new Date().toISOString(),
        };
        messages.push(msg);
        return msg;
      },
      async listMessagesByConversation(convId) {
        return messages.filter((m) => m.conversationId === convId);
      },
      async touchConversation() {},
    };

    mockProjectRepo = {
      async findById(id: string) {
        if (id === projectId) {
          return {
            id: projectId,
            name: 'Versora Core',
            description: 'Change impact tracker',
            ownerId,
            gitRemoteUrl: null,
            defaultBranch: 'main',
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
        }
        return null;
      },
    } as any;

    mockUserRepo = {
      async findById(id: string) {
        return {
          id,
          username: id === ownerId ? 'owner_user' : 'member_user',
          email: `${id}@example.com`,
          passwordHash: 'hash',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    } as any;

    const mockArtifactSvc: any = {
      async listArtifacts(_userId: string, projId: string) {
        if (projId === projectId) {
          return [
            {
              id: artifactId,
              projectId,
              name: 'index.ts',
              path: '/src/index.ts',
              type: 'file',
              artifactType: 'typescript',
              sizeBytes: 120,
              contentSnippet: 'export const app = "versora";',
              isBinary: false,
              isLarge: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any,
          ];
        }
        return [];
      },
      async getArtifact(_userId: string, _projId: string, artId: string) {
        if (artId === artifactId) {
          return {
            id: artifactId,
            projectId,
            name: 'index.ts',
            path: '/src/index.ts',
            type: 'file',
            artifactType: 'typescript',
            sizeBytes: 120,
            contentSnippet: 'export const app = "versora";',
            isBinary: false,
            isLarge: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
        }
        return null;
      },
    };

    mockGitSvc = {
      async getStatus(_userId: string, _projId: string) {
        return {
          isInitialized: true,
          currentBranch: 'main',
          hasCommits: true,
          headCommitHash: 'abc1234567890',
          staged: [],
          unstaged: [],
          untracked: [],
          totalChangesCount: 0,
        };
      },
      async getHistory(_userId: string, _projId: string) {
        return [
          {
            hash: 'abc1234567890abcdef1234567890abcdef1234',
            shortHash: 'abc1234',
            message: 'feat: add phase 4 AI assistant',
            author: { name: 'Dev', email: 'dev@versora.io' },
            timestamp: new Date().toISOString(),
            parents: [],
          },
        ];
      },
      async getCommit(_userId: string, _projId: string, _hash: string) {
        return {
          commit: {
            hash: 'abc1234567890abcdef1234567890abcdef1234',
            shortHash: 'abc1234',
            message: 'feat: add phase 4 AI assistant',
            author: { name: 'Dev', email: 'dev@versora.io' },
            timestamp: new Date().toISOString(),
            parents: [],
          },
          files: [
            {
              path: 'src/index.ts',
              status: 'modified',
              additions: 10,
              deletions: 2,
              isBinary: false,
              diff: '@@ -1,2 +1,10 @@\n+export const assistant = true;',
            },
          ],
          stats: { totalFiles: 1, totalAdditions: 10, totalDeletions: 2 },
        };
      },
    } as any;

    mockIntelligenceSvc = {
      async listRelationships() {
        return [];
      },
      async getImpactAnalysis() {
        return {
          impactCount: 0,
          items: [],
        } as any;
      },
    } as any;

    mockCollaborationSvc = {
      async checkProjectAccess(userId: string, projId: string) {
        if (projId !== projectId) {
          throw new ProjectNotFoundError(projId);
        }
        if (userId === ownerId) {
          return {
            project: { id: projectId, ownerId, name: 'Versora Core' } as any,
            effectiveRole: 'owner' as any,
          };
        }
        if (userId === memberId) {
          return {
            project: { id: projectId, ownerId, name: 'Versora Core' } as any,
            effectiveRole: 'member' as any,
          };
        }
        throw new ProjectForbiddenError('You do not have permission to access this project.');
      },
      async listReviews() {
        return [];
      },
      async listTasks() {
        return [];
      },
      async listActivities() {
        return [];
      },
    } as any;

    contextRetriever = new ContextRetrieverService(
      mockProjectRepo,
      mockArtifactSvc,
      mockIntelligenceSvc,
      mockGitSvc,
      mockCollaborationSvc
    );

    evidenceExtractor = new EvidenceExtractorService();

    assistantService = new AssistantService(
      mockAssistantRepo,
      contextRetriever,
      evidenceExtractor,
      mockCollaborationSvc,
      mockProvider
    );
  });

  // 1. Provider configuration & checking
  it('should return configured status when provider is available', async () => {
    const config = await assistantService.getConfig();
    assert.equal(config.configured, true);
    assert.equal(config.provider, 'mock');
    assert.equal(config.supportsQuickActions, true);
  });

  it('should return unconfigured status when provider is unavailable', async () => {
    mockProvider.setConfigured(false);
    const config = await assistantService.getConfig();
    assert.equal(config.configured, false);
    assert.ok(config.message?.includes('not configured'));
    mockProvider.setConfigured(true);
  });

  // 2. Project authorization & isolation
  it('should reject access if user is not a member of the project', async () => {
    await assert.rejects(
      async () => {
        await assistantService.listConversations(outsiderId, projectId);
      },
      (err: any) => err instanceof ProjectForbiddenError
    );
  });

  it('should reject access if project does not exist', async () => {
    await assert.rejects(
      async () => {
        await assistantService.listConversations(memberId, 'non-existent-proj');
      },
      (err: any) => err instanceof ProjectNotFoundError
    );
  });

  // 3. Conversation CRUD
  it('should create and list conversations for project members', async () => {
    const conv = await assistantService.createConversation(
      memberId,
      projectId,
      { title: 'My Test Assistant Chat' }
    );
    assert.ok(conv.id);
    assert.equal(conv.title, 'My Test Assistant Chat');
    assert.equal(conv.projectId, projectId);
    assert.equal(conv.userId, memberId);

    const list = await assistantService.listConversations(memberId, projectId);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, conv.id);
  });

  it('should isolate conversations between different users', async () => {
    const memberConv = await assistantService.createConversation(
      memberId,
      projectId,
      { title: 'Member Chat' }
    );
    const ownerConv = await assistantService.createConversation(
      ownerId,
      projectId,
      { title: 'Owner Chat' }
    );

    const memberList = await assistantService.listConversations(memberId, projectId);
    assert.equal(memberList.length, 1);
    assert.equal(memberList[0].id, memberConv.id);

    const ownerList = await assistantService.listConversations(ownerId, projectId);
    assert.equal(ownerList.length, 1);
    assert.equal(ownerList[0].id, ownerConv.id);

    // Member cannot retrieve owner's conversation
    await assert.rejects(
      async () => {
        await assistantService.getConversation(memberId, projectId, ownerConv.id);
      },
      (err: any) => err instanceof ConversationForbiddenError
    );
  });

  it('should allow conversation owner to rename and delete conversation', async () => {
    const conv = await assistantService.createConversation(
      memberId,
      projectId,
      { title: 'Initial Title' }
    );

    const updated = await assistantService.renameConversation(
      memberId,
      projectId,
      conv.id,
      { title: 'Updated Title' }
    );
    assert.equal(updated.title, 'Updated Title');

    await assistantService.deleteConversation(memberId, projectId, conv.id);
    const list = await assistantService.listConversations(memberId, projectId);
    assert.equal(list.length, 0);
  });

  it('should prevent non-owners from deleting another user conversation', async () => {
    const conv = await assistantService.createConversation(
      ownerId,
      projectId,
      { title: 'Owner Private' }
    );

    await assert.rejects(
      async () => {
        await assistantService.deleteConversation(memberId, projectId, conv.id);
      },
      (err: any) => err instanceof ConversationForbiddenError
    );
  });

  // 4. Grounded question answering & message persistence
  it('should send message, retrieve context, generate response, and store sources', async () => {
    const conv = await assistantService.createConversation(
      memberId,
      projectId,
      { title: 'Context Query' }
    );

    const res = await assistantService.sendMessage(memberId, projectId, conv.id, {
      content: 'What does this project do and what files exist?',
    });

    assert.ok(res.userMessage.id);
    assert.equal(res.userMessage.content, 'What does this project do and what files exist?');
    assert.ok(res.assistantMessage.id);
    assert.equal(res.assistantMessage.role, 'assistant');
    assert.ok(res.assistantMessage.content.includes('grounded answer for Versora'));

    // Check message persistence in conversation
    const detail = await assistantService.getConversation(memberId, projectId, conv.id);
    assert.equal(detail.messages.length, 2);
  });

  // 5. Evidence Reference Validation
  it('should validate and filter evidence citations against retrieved entities', () => {
    const mockContext: ProjectContextData = {
      projectId,
      projectName: 'Versora Core',
      ownerId,
      artifactsSummary: {
        totalCount: 1,
        matchedArtifacts: [
          {
            id: artifactId,
            name: 'index.ts',
            path: '/src/index.ts',
            type: 'file',
            artifactType: 'typescript',
            sizeBytes: 120,
          },
        ],
      },
      relationships: [],
      gitSummary: {
        isInitialized: true,
        recentCommits: [
          {
            hash: 'abc1234567890abcdef1234567890abcdef1234',
            message: 'feat: assistant',
            author: 'Dev',
            date: new Date().toISOString(),
          },
        ],
      },
      reviews: [],
      tasks: [
        {
          id: 'task-100',
          title: 'Implement AI assistant',
          status: 'in_progress',
          priority: 'high',
        },
      ],
      recentActivities: [],
    };

    const answerWithCitations = `
I inspected the project.
Artifact: /src/index.ts has the main application logic.
Commit abc1234 added the initial assistant.
Task task-100 is high priority.
Also see fake file /src/fake-nonexistent.ts and fake commit deadbeef999.
`;

    const { sources: validated } = evidenceExtractor.extractAndValidateSources(
      answerWithCitations,
      mockContext
    );

    // /src/index.ts, abc1234, and task-100 should be extracted and validated
    const identifiers = validated.map((v) => v.identifier);
    assert.ok(identifiers.includes(artifactId));
    assert.ok(identifiers.includes('abc1234567890abcdef1234567890abcdef1234'));
    assert.ok(identifiers.includes('task-100'));

    // Fake non-existent references must not be in valid sources
    assert.ok(!identifiers.includes('/src/fake-nonexistent.ts'));
    assert.ok(!identifiers.includes('deadbeef999'));
  });

  // 6. Provider Error & Timeout Handling
  it('should handle provider errors gracefully and throw AIProviderError', async () => {
    mockProvider.setOptions({
      shouldFail: true,
      failureError: new AIProviderTimeoutError(),
    });

    const conv = await assistantService.createConversation(
      memberId,
      projectId,
      { title: 'Timeout Chat' }
    );

    await assert.rejects(
      async () => {
        await assistantService.sendMessage(memberId, projectId, conv.id, {
          content: 'Will this time out?',
        });
      },
      (err: any) => err instanceof AIProviderTimeoutError
    );
  });

  it('should handle unconfigured provider error when sending a message', async () => {
    mockProvider.setConfigured(false);

    const conv = await assistantService.createConversation(
      memberId,
      projectId,
      { title: 'Unconfigured Chat' }
    );

    await assert.rejects(
      async () => {
        await assistantService.sendMessage(memberId, projectId, conv.id, {
          content: 'Test message',
        });
      },
      (err: any) => err instanceof AIProviderNotConfiguredError
    );

    mockProvider.setConfigured(true);
  });

  // 7. Prompt-Injection Defense
  it('should format context with clear data boundary tags to prevent prompt injection', () => {
    const contextPrompt = (assistantService as any).buildSystemPrompt('mock project context evidence');
    assert.ok(contextPrompt.includes('UNTRUSTED user and repository data'));
    assert.ok(contextPrompt.includes('<project_context>'));
  });

  // 8. Quick Actions Execution
  it('should execute quick-action: explain-artifact', async () => {
    const res = await assistantService.executeQuickAction(memberId, projectId, {
      action: 'explain-artifact',
      targetId: artifactId,
    });

    assert.ok(res.content);
    assert.ok(Array.isArray(res.sources));
  });

  it('should execute quick-action: summarize-commit', async () => {
    const res = await assistantService.executeQuickAction(memberId, projectId, {
      action: 'summarize-commit',
      targetId: 'abc1234567890abcdef1234567890abcdef1234',
    });

    assert.ok(res.content);
    assert.ok(Array.isArray(res.sources));
  });

  it('should execute quick-action: project-summary', async () => {
    const res = await assistantService.executeQuickAction(memberId, projectId, {
      action: 'project-summary',
    });

    assert.ok(res.content);
    assert.ok(Array.isArray(res.sources));
  });

  // 9. Read-only Guarantee
  it('should be strictly read-only and never mutate project or git repositories', async () => {
    let projectUpdated = false;
    (mockProjectRepo as any).update = async () => {
      projectUpdated = true;
    };

    const conv = await assistantService.createConversation(
      memberId,
      projectId,
      { title: 'Read Only Check' }
    );
    await assistantService.sendMessage(memberId, projectId, conv.id, {
      content: 'Summarize the project and propose tasks.',
    });

    assert.equal(projectUpdated, false, 'Project must not be updated by AI assistant');
  });
});
