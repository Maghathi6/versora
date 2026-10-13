import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';

/**
 * Assistant Conversations Table Schema
 * Stores persistent chat sessions with the AI Project Assistant for a project and user.
 */
export const assistantConversations = pgTable(
  'assistant_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull().default('New Conversation'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('assistant_conversations_project_user_idx').on(table.projectId, table.userId),
    index('assistant_conversations_user_updated_idx').on(table.userId, table.updatedAt),
  ]
);

/**
 * Assistant Messages Table Schema
 * Stores sequential chat turns, structured source/evidence references, and uncertainty notes.
 */
export const assistantMessages = pgTable(
  'assistant_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => assistantConversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    sources: jsonb('sources').default([]), // array of EvidenceReference
    uncertaintyNote: text('uncertainty_note'),
    metadata: jsonb('metadata'), // provider, model, tokens, timing (no secrets)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('assistant_messages_conversation_idx').on(table.conversationId, table.createdAt),
  ]
);
