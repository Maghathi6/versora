/**
 * AI Project Assistant Domain Types & Contracts
 */

export type AIProviderName = 'mock' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateResponseOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GenerateResponseResult {
  content: string;
  model: string;
  provider: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface IAIProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateChatResponse(options: GenerateResponseOptions): Promise<GenerateResponseResult>;
}

export type EvidenceType =
  | 'artifact'
  | 'commit'
  | 'task'
  | 'review'
  | 'relationship'
  | 'activity';

export interface EvidenceReference {
  type: EvidenceType;
  identifier: string; // artifact path or ID, commit hash, task ID, review ID
  title: string;
  description?: string;
  location?: string; // line range, branch name, folder path
}

export interface AssistantConversation {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: EvidenceReference[];
  uncertaintyNote?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ConversationDetailResponse {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
}

export interface SendMessageResponse {
  userMessage: AssistantMessage;
  assistantMessage: AssistantMessage;
}

export interface AssistantConfigResponse {
  configured: boolean;
  provider: string | null;
  model: string | null;
  supportsQuickActions: boolean;
  message?: string;
}

export type QuickActionType =
  | 'explain-artifact'
  | 'summarize-commit'
  | 'explain-impact'
  | 'review-assistance'
  | 'project-summary';

export interface QuickActionInput {
  action: QuickActionType;
  targetId?: string; // artifactId or commitHash or reviewId
  customPrompt?: string;
}

export interface ProjectContextData {
  projectId: string;
  projectName: string;
  projectDescription?: string | null;
  ownerId: string;
  artifactsSummary: {
    totalCount: number;
    matchedArtifacts: Array<{
      id: string;
      name: string;
      path: string;
      type: string;
      artifactType: string;
      sizeBytes: number;
      contentSnippet?: string;
      isBinaryOrLarge?: boolean;
    }>;
  };
  relationships: Array<{
    id: string;
    sourceName: string;
    targetName: string;
    relationshipType: string;
    description?: string | null;
  }>;
  impactAnalysis?: {
    activeImpactsCount: number;
    items: Array<{
      changedName: string;
      affectedName: string;
      relationshipType: string;
      severity: string;
      reason: string;
    }>;
  };
  gitSummary?: {
    isInitialized: boolean;
    currentBranch?: string | null;
    recentCommits: Array<{
      hash: string;
      message: string;
      author: string;
      date: string;
    }>;
    workingTreeStatus?: {
      totalChanges: number;
      modified: string[];
      untracked: string[];
      deleted: string[];
    };
    targetCommitDiff?: string;
  };
  reviews: Array<{
    id: string;
    title: string;
    status: string;
    targetType: string;
    targetRef: string;
    reviewersCount: number;
    approvalsCount: number;
    hasStaleApprovals?: boolean;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assigneeName?: string | null;
  }>;
  recentActivities: Array<{
    eventType: string;
    summary: string;
    timestamp: string;
  }>;
}
