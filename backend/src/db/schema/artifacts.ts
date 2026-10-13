import {
  pgTable,
  uuid,
  varchar,
  bigint,
  timestamp,
  index,
  uniqueIndex,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';

/**
 * Artifacts Table Schema
 * Represents files and folders tracked within a project.
 * Supports hierarchical nesting, MIME metadata, storage keys, and future traceability.
 */
export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    name: varchar('name', { length: 255 }).notNull(),
    path: varchar('path', { length: 1024 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(), // 'file' | 'folder'
    artifactType: varchar('artifact_type', { length: 64 }).notNull(), // 'code' | 'document' | 'dataset' | 'result' | 'presentation' | 'model' | 'folder' | 'other'
    mimeType: varchar('mime_type', { length: 128 }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).default(0).notNull(),
    storageKey: varchar('storage_key', { length: 512 }),
    hash: varchar('hash', { length: 64 }), // SHA-256 content checksum
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Foreign key self-reference for folder nesting
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'artifacts_parent_id_fk',
    }).onDelete('cascade'),

    // Indexes for fast querying within project folders
    index('artifacts_project_id_idx').on(table.projectId),
    index('artifacts_parent_id_idx').on(table.parentId),
    index('artifacts_project_parent_idx').on(table.projectId, table.parentId),

    // Partial unique indexes enforcing unique names per directory level
    uniqueIndex('artifacts_root_unique_idx')
      .on(table.projectId, table.name)
      .where(sql`${table.parentId} IS NULL`),

    uniqueIndex('artifacts_subfolder_unique_idx')
      .on(table.projectId, table.parentId, table.name)
      .where(sql`${table.parentId} IS NOT NULL`),
  ]
);

export type ArtifactTable = typeof artifacts;
