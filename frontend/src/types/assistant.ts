export type EvidenceType =
  | 'artifact'
  | 'commit'
  | 'task'
  | 'review'
  | 'relationship'
  | 'activity';

export interface EvidenceReference {
  type: EvidenceType;
  identifier: string;
  title: string;
  description?: string;
  location?: string;
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
  targetId?: string;
  customPrompt?: string;
}
