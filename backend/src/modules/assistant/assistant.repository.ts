import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../../db';
import {
  assistantConversations,
  assistantMessages,
} from '../../db/schema/assistant';
import {
  AssistantConversation,
  AssistantMessage,
  EvidenceReference,
} from './assistant.types';

export interface IAssistantRepository {
  createConversation(data: {
    projectId: string;
    userId: string;
    title: string;
  }): Promise<AssistantConversation>;

  findConversationById(conversationId: string): Promise<AssistantConversation | null>;

  listConversationsByUser(
    projectId: string,
    userId: string
  ): Promise<AssistantConversation[]>;

  updateConversationTitle(
    conversationId: string,
    title: string
  ): Promise<AssistantConversation>;

  deleteConversation(conversationId: string): Promise<void>;

  createMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    sources?: EvidenceReference[];
    uncertaintyNote?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<AssistantMessage>;

  listMessagesByConversation(conversationId: string): Promise<AssistantMessage[]>;

  touchConversation(conversationId: string): Promise<void>;
}

export class AssistantRepository implements IAssistantRepository {
  async createConversation(data: {
    projectId: string;
    userId: string;
    title: string;
  }): Promise<AssistantConversation> {
    const [row] = await db
      .insert(assistantConversations)
      .values({
        projectId: data.projectId,
        userId: data.userId,
        title: data.title,
      })
      .returning();

    return this.mapConversation(row);
  }

  async findConversationById(conversationId: string): Promise<AssistantConversation | null> {
    const [row] = await db
      .select()
      .from(assistantConversations)
      .where(eq(assistantConversations.id, conversationId))
      .limit(1);

    return row ? this.mapConversation(row) : null;
  }

  async listConversationsByUser(
    projectId: string,
    userId: string
  ): Promise<AssistantConversation[]> {
    const rows = await db
      .select()
      .from(assistantConversations)
      .where(
        and(
          eq(assistantConversations.projectId, projectId),
          eq(assistantConversations.userId, userId)
        )
      )
      .orderBy(desc(assistantConversations.updatedAt));

    return rows.map((r) => this.mapConversation(r));
  }

  async updateConversationTitle(
    conversationId: string,
    title: string
  ): Promise<AssistantConversation> {
    const [row] = await db
      .update(assistantConversations)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(eq(assistantConversations.id, conversationId))
      .returning();

    return this.mapConversation(row);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await db
      .delete(assistantConversations)
      .where(eq(assistantConversations.id, conversationId));
  }

  async createMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    sources?: EvidenceReference[];
    uncertaintyNote?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<AssistantMessage> {
    const [row] = await db
      .insert(assistantMessages)
      .values({
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        sources: data.sources || [],
        uncertaintyNote: data.uncertaintyNote || null,
        metadata: data.metadata || null,
      })
      .returning();

    return this.mapMessage(row);
  }

  async listMessagesByConversation(conversationId: string): Promise<AssistantMessage[]> {
    const rows = await db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, conversationId))
      .orderBy(asc(assistantMessages.createdAt));

    return rows.map((r) => this.mapMessage(r));
  }

  async touchConversation(conversationId: string): Promise<void> {
    await db
      .update(assistantConversations)
      .set({ updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversationId));
  }

  private mapConversation(row: any): AssistantConversation {
    return {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      title: row.title,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    };
  }

  private mapMessage(row: any): AssistantMessage {
    return {
      id: row.id,
      conversationId: row.conversationId,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      sources: Array.isArray(row.sources) ? row.sources : [],
      uncertaintyNote: row.uncertaintyNote || null,
      metadata: row.metadata || null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }
}

export const assistantRepository = new AssistantRepository();
