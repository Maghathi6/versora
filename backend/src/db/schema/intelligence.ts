import { pgTable, uuid, varchar, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';
import { artifacts } from './artifacts';

/**
 * Artifact Relationships Table Schema
 * Stores explicit directed relationships between project artifacts within the same project.
 * Relationship types:
 * - depends_on: source depends on target
 * - documents: source documents target
 * - tests: source tests target
 * - generated_from: source was generated from target
 * - related_to: general bidirectional or associative relation
 */
export const artifactRelationships = pgTable(
  'artifact_relationships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceArtifactId: uuid('source_artifact_id')
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    targetArtifactId: uuid('target_artifact_id')
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    relationshipType: varchar('relationship_type', { length: 32 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('artifact_relationships_project_id_idx').on(table.projectId),
    index('artifact_relationships_source_idx').on(table.sourceArtifactId),
    index('artifact_relationships_target_idx').on(table.targetArtifactId),
    index('artifact_relationships_type_idx').on(table.relationshipType),
    unique('artifact_relationships_unique_type_idx').on(
      table.projectId,
      table.sourceArtifactId,
      table.targetArtifactId,
      table.relationshipType
    ),
  ]
);

/**
 * Project Activities Table Schema
 * Tracks meaningful historical events across artifacts, Git, GitHub, and relationships.
 * Provides an explainable, chronological audit timeline for project operations.
 */
export const projectActivities = pgTable(
  'project_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 32 }).notNull(),
    entityId: varchar('entity_id', { length: 128 }),
    summary: varchar('summary', { length: 500 }).notNull(),
    metadata: text('metadata'), // JSON stringified extra safe context (NO secrets)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_activities_project_created_idx').on(table.projectId, table.createdAt),
    index('project_activities_actor_idx').on(table.actorId),
  ]
);

/**
 * Project Impact Reviews Table Schema
 * Stores user review and dismissal states for rule-based change-impact warnings.
 */
export const projectImpactReviews = pgTable(
  'project_impact_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    impactKey: varchar('impact_key', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(), // 'reviewed' | 'dismissed'
    reviewedBy: uuid('reviewed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_impact_reviews_project_idx').on(table.projectId),
    unique('project_impact_reviews_unique_key').on(table.projectId, table.impactKey),
  ]
);

export type ArtifactRelationship = typeof artifactRelationships.$inferSelect;
export type NewArtifactRelationship = typeof artifactRelationships.$inferInsert;
export type ProjectActivity = typeof projectActivities.$inferSelect;
export type NewProjectActivity = typeof projectActivities.$inferInsert;
export type ProjectImpactReview = typeof projectImpactReviews.$inferSelect;
export type NewProjectImpactReview = typeof projectImpactReviews.$inferInsert;
