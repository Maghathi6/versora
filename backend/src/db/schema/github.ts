import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';

/**
 * User GitHub Accounts Table Schema
 * Stores authenticated GitHub OAuth accounts for Versora users.
 * Access tokens are stored strictly encrypted at rest with AES-256-GCM.
 */
export const userGithubAccounts = pgTable(
  'user_github_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    githubUserId: varchar('github_user_id', { length: 64 }).notNull(),
    githubUsername: varchar('github_username', { length: 128 }).notNull(),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    tokenIv: varchar('token_iv', { length: 64 }).notNull(),
    tokenTag: varchar('token_tag', { length: 64 }).notNull(),
    scope: varchar('scope', { length: 255 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_github_accounts_user_id_idx').on(table.userId),
    index('user_github_accounts_username_idx').on(table.githubUsername),
  ]
);

/**
 * Project GitHub Remotes Table Schema
 * Links a Versora project to a remote GitHub repository.
 * Contains metadata and sync timestamps without storing secrets.
 */
export const projectGithubRemotes = pgTable(
  'project_github_remotes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' })
      .unique(),
    githubOwner: varchar('github_owner', { length: 128 }).notNull(),
    githubRepoName: varchar('github_repo_name', { length: 128 }).notNull(),
    remoteUrl: varchar('remote_url', { length: 512 }).notNull(),
    isPrivate: boolean('is_private').default(false).notNull(),
    defaultBranch: varchar('default_branch', { length: 128 }).default('main').notNull(),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    lastPushedAt: timestamp('last_pushed_at', { withTimezone: true }),
    lastPulledAt: timestamp('last_pulled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_github_remotes_project_id_idx').on(table.projectId),
    index('project_github_remotes_repo_idx').on(table.githubOwner, table.githubRepoName),
  ]
);

/**
 * GitHub OAuth States Table Schema
 * Ephemeral store for OAuth state tokens to prevent CSRF during authorization callbacks.
 */
export const githubOAuthStates = pgTable(
  'github_oauth_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    state: varchar('state', { length: 128 }).notNull().unique(),
    returnTo: varchar('return_to', { length: 512 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('github_oauth_states_state_idx').on(table.state),
    index('github_oauth_states_expires_idx').on(table.expiresAt),
  ]
);

export type UserGithubAccount = typeof userGithubAccounts.$inferSelect;
export type NewUserGithubAccount = typeof userGithubAccounts.$inferInsert;
export type ProjectGithubRemote = typeof projectGithubRemotes.$inferSelect;
export type NewProjectGithubRemote = typeof projectGithubRemotes.$inferInsert;
export type GithubOAuthState = typeof githubOAuthStates.$inferSelect;
export type NewGithubOAuthState = typeof githubOAuthStates.$inferInsert;
