import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import crypto from 'node:crypto';
import { projectAssistantRouter } from './assistant.routes';
import { AssistantController } from './assistant.controller';
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
import { TokenService } from '../auth/token.service';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';

describe('HTTP Assistant Endpoints (API Integration Tests)', () => {
  let server: Server;
  let baseUrl: string;

  const ownerId = '11111111-1111-1111-1111-111111111111';
  const memberId = '22222222-2222-2222-2222-222222222222';
  const outsiderId = '33333333-3333-3333-3333-333333333333';
  const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const artifactId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  const secretKey = 'test-jwt-secret-key-at-least-16-chars-long';
  const tokenService = new TokenService(secretKey, '1h');
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let conversations: any[];
  let messages: any[];
  let mockProvider: MockAIProvider;

  before(async () => {
    ownerToken = tokenService.signAccessToken({ userId: ownerId, username: 'owner_user' });
    memberToken = tokenService.signAccessToken({ userId: memberId, username: 'member_user' });
    outsiderToken = tokenService.signAccessToken({ userId: outsiderId, username: 'outsider_user' });

    conversations = [];
    messages = [];
    mockProvider = new MockAIProvider({
      mockResponse: 'Assistant response grounded in project context.',
    });
    AIProviderFactory.setProviderOverride(mockProvider);

    const mockAssistantRepo: IAssistantRepository = {
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

    const mockProjectRepo: IProjectRepository = {
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

    const mockUserRepo: IUserRepository = {
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
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return null;
      },
    };

    const mockGitSvc: IGitService = {
      async getStatus() {
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
      async getHistory() {
        return [];
      },
      async getCommit() {
        return {
          commit: {
            hash: 'abc1234',
            shortHash: 'abc',
            message: 'feat: assistant',
            author: { name: 'Dev', email: 'dev@versora.io' },
            timestamp: new Date().toISOString(),
            parents: [],
          },
          files: [],
          stats: { totalFiles: 0, totalAdditions: 0, totalDeletions: 0 },
        };
      },
    } as any;

    const mockIntelligenceSvc: IIntelligenceService = {
      async listRelationships() {
        return [];
      },
      async getImpactAnalysis() {
        return { impactCount: 0, items: [] } as any;
      },
    } as any;

    const mockCollaborationSvc: CollaborationService = {
      async checkProjectAccess(userId: string, projId: string) {
        if (projId !== projectId) {
          throw new (require('../projects/project.errors').ProjectNotFoundError)(projId);
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
        throw new (require('../projects/project.errors').ProjectForbiddenError)('You do not have permission to access this project.');
      },
      async getUserRole(userId: string, projId: string) {
        if (projId !== projectId) return null;
        if (userId === ownerId) return 'owner';
        if (userId === memberId) return 'member';
        return null;
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

    const contextRetriever = new ContextRetrieverService(
      mockProjectRepo,
      mockArtifactSvc,
      mockIntelligenceSvc,
      mockGitSvc,
      mockCollaborationSvc
    );
    const evidenceExtractor = new EvidenceExtractorService();

    const assistantService = new AssistantService(
      mockAssistantRepo,
      contextRetriever,
      evidenceExtractor,
      mockCollaborationSvc,
      mockProvider
    );

    const assistantController = new AssistantController(assistantService);
    const authMiddleware = createAuthMiddleware({ tokenSvc: tokenService, userRepo: mockUserRepo });

    const app: Application = express();
    app.use(express.json());

    const apiV1Router = Router();
    apiV1Router.use(
      '/projects',
      projectAssistantRouter(assistantController, authMiddleware)
    );

    app.use('/api/v1', apiV1Router);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  // 1. GET /config
  it('GET /api/v1/projects/:projectId/assistant/config returns configuration', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/assistant/config`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.success, true);
    assert.equal(data.data.configured, true);
    assert.equal(data.data.provider, 'mock');
  });

  // 2. Auth checks
  it('GET /api/v1/projects/:projectId/assistant/conversations returns 401 without auth', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/assistant/conversations`);
    assert.equal(res.status, 401);
  });

  it('GET /api/v1/projects/:projectId/assistant/conversations returns 403 for outsider', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/assistant/conversations`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert.equal(res.status, 403);
  });

  // 3. Conversations CRUD
  let createdConvId: string;

  it('POST /api/v1/projects/:projectId/assistant/conversations creates a new conversation', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/assistant/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ title: 'Frontend Architecture Discussion' }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.title, 'Frontend Architecture Discussion');
    assert.equal(body.data.projectId, projectId);
    createdConvId = body.data.id;
  });

  it('GET /api/v1/projects/:projectId/assistant/conversations lists user conversations', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/assistant/conversations`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, createdConvId);
  });

  it('GET /api/v1/projects/:projectId/assistant/conversations/:id returns conversation details', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectId}/assistant/conversations/${createdConvId}`,
      {
        headers: { Authorization: `Bearer ${memberToken}` },
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.conversation.id, createdConvId);
    assert.equal(body.data.messages.length, 0);
  });

  it('PATCH /api/v1/projects/:projectId/assistant/conversations/:id renames conversation', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectId}/assistant/conversations/${createdConvId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({ title: 'Updated Conversation Title' }),
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.title, 'Updated Conversation Title');
  });

  // 4. Send message
  it('POST /api/v1/projects/:projectId/assistant/conversations/:id/messages generates assistant reply', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectId}/assistant/conversations/${createdConvId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({ content: 'What artifacts are in this project?' }),
      }
    );

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.userMessage.content, 'What artifacts are in this project?');
    assert.ok(body.data.assistantMessage.content.includes('grounded in project context'));
  });

  // 5. Unconfigured provider error response
  it('returns 503 when AI provider is unconfigured', async () => {
    mockProvider.setOptions({ isConfigured: false });

    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectId}/assistant/conversations/${createdConvId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({ content: 'Should fail with 503' }),
      }
    );

    assert.equal(res.status, 503);
    const body = (await res.json()) as any;
    assert.equal(body.success, false);
    assert.ok(body.error.message.includes('not configured'));

    // Reset mock provider to configured for subsequent tests
    mockProvider.setOptions({ isConfigured: true });
  });

  // 6. Quick action endpoint
  it('POST /api/v1/projects/:projectId/assistant/quick-action executes quick action', async () => {
    const res = await fetch(`${baseUrl}/api/v1/projects/${projectId}/assistant/quick-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        action: 'explain-artifact',
        targetId: artifactId,
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(body.data.content);
  });

  // 7. DELETE conversation
  it('DELETE /api/v1/projects/:projectId/assistant/conversations/:id deletes conversation', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/projects/${projectId}/assistant/conversations/${createdConvId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${memberToken}` },
      }
    );

    assert.equal(res.status, 200);

    const getRes = await fetch(
      `${baseUrl}/api/v1/projects/${projectId}/assistant/conversations/${createdConvId}`,
      {
        headers: { Authorization: `Bearer ${memberToken}` },
      }
    );
    assert.equal(getRes.status, 404);
  });
});
