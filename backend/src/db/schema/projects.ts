import { pgTable, uuid, varchar, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Projects Table Schema
 * Represents project workspaces in Versora owned by users.
 * Maps relational metadata to native Git repositories in later phases.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('projects_owner_id_idx').on(table.ownerId),
    index('projects_owner_created_idx').on(table.ownerId, table.createdAt),
    unique('projects_owner_name_unique').on(table.ownerId, table.name),
  ]
);

export type ProjectTable = typeof projects;
