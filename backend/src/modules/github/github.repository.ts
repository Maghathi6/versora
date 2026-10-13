import { eq, and, gt } from 'drizzle-orm';
import { db } from '../../db';
import {
  userGithubAccounts,
  projectGithubRemotes,
  githubOAuthStates,
  UserGithubAccount,
  NewUserGithubAccount,
  ProjectGithubRemote,
  NewProjectGithubRemote,
  GithubOAuthState,
} from '../../db/schema';

export interface IGitHubRepository {
  findAccountByUserId(userId: string): Promise<UserGithubAccount | null>;
  upsertAccount(data: NewUserGithubAccount): Promise<UserGithubAccount>;
  deleteAccountByUserId(userId: string): Promise<boolean>;

  findRemoteByProjectId(projectId: string): Promise<ProjectGithubRemote | null>;
  upsertRemote(data: NewProjectGithubRemote): Promise<ProjectGithubRemote>;
  deleteRemoteByProjectId(projectId: string): Promise<boolean>;
  updateRemoteTimestamps(
    projectId: string,
    timestamps: { lastFetchedAt?: Date; lastPushedAt?: Date; lastPulledAt?: Date }
  ): Promise<ProjectGithubRemote | null>;

  createOAuthState(userId: string, state: string, returnTo?: string, ttlMinutes?: number): Promise<GithubOAuthState>;
  consumeOAuthState(state: string): Promise<GithubOAuthState | null>;
}

export class DrizzleGitHubRepository implements IGitHubRepository {
  async findAccountByUserId(userId: string): Promise<UserGithubAccount | null> {
    const rows = await db
      .select()
      .from(userGithubAccounts)
      .where(eq(userGithubAccounts.userId, userId))
      .limit(1);
    return rows[0] || null;
  }

  async upsertAccount(data: NewUserGithubAccount): Promise<UserGithubAccount> {
    const existing = await this.findAccountByUserId(data.userId);
    if (existing) {
      const [updated] = await db
        .update(userGithubAccounts)
        .set({
          githubUserId: data.githubUserId,
          githubUsername: data.githubUsername,
          encryptedAccessToken: data.encryptedAccessToken,
          tokenIv: data.tokenIv,
          tokenTag: data.tokenTag,
          scope: data.scope,
          avatarUrl: data.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(userGithubAccounts.userId, data.userId))
        .returning();
      return updated;
    }

    const [created] = await db.insert(userGithubAccounts).values(data).returning();
    return created;
  }

  async deleteAccountByUserId(userId: string): Promise<boolean> {
    const deleted = await db
      .delete(userGithubAccounts)
      .where(eq(userGithubAccounts.userId, userId))
      .returning();
    return deleted.length > 0;
  }

  async findRemoteByProjectId(projectId: string): Promise<ProjectGithubRemote | null> {
    const rows = await db
      .select()
      .from(projectGithubRemotes)
      .where(eq(projectGithubRemotes.projectId, projectId))
      .limit(1);
    return rows[0] || null;
  }

  async upsertRemote(data: NewProjectGithubRemote): Promise<ProjectGithubRemote> {
    const existing = await this.findRemoteByProjectId(data.projectId);
    if (existing) {
      const [updated] = await db
        .update(projectGithubRemotes)
        .set({
          githubOwner: data.githubOwner,
          githubRepoName: data.githubRepoName,
          remoteUrl: data.remoteUrl,
          isPrivate: data.isPrivate,
          defaultBranch: data.defaultBranch || 'main',
          updatedAt: new Date(),
        })
        .where(eq(projectGithubRemotes.projectId, data.projectId))
        .returning();
      return updated;
    }

    const [created] = await db.insert(projectGithubRemotes).values(data).returning();
    return created;
  }

  async deleteRemoteByProjectId(projectId: string): Promise<boolean> {
    const deleted = await db
      .delete(projectGithubRemotes)
      .where(eq(projectGithubRemotes.projectId, projectId))
      .returning();
    return deleted.length > 0;
  }

  async updateRemoteTimestamps(
    projectId: string,
    timestamps: { lastFetchedAt?: Date; lastPushedAt?: Date; lastPulledAt?: Date }
  ): Promise<ProjectGithubRemote | null> {
    const updateData: Partial<ProjectGithubRemote> = {
      updatedAt: new Date(),
    };
    if (timestamps.lastFetchedAt) updateData.lastFetchedAt = timestamps.lastFetchedAt;
    if (timestamps.lastPushedAt) updateData.lastPushedAt = timestamps.lastPushedAt;
    if (timestamps.lastPulledAt) updateData.lastPulledAt = timestamps.lastPulledAt;

    const [updated] = await db
      .update(projectGithubRemotes)
      .set(updateData)
      .where(eq(projectGithubRemotes.projectId, projectId))
      .returning();
    return updated || null;
  }

  async createOAuthState(
    userId: string,
    state: string,
    returnTo?: string,
    ttlMinutes = 10
  ): Promise<GithubOAuthState> {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const [row] = await db
      .insert(githubOAuthStates)
      .values({
        userId,
        state,
        returnTo: returnTo || null,
        expiresAt,
      })
      .returning();
    return row;
  }

  async consumeOAuthState(state: string): Promise<GithubOAuthState | null> {
    const now = new Date();
    // Find unexpired state
    const rows = await db
      .select()
      .from(githubOAuthStates)
      .where(and(eq(githubOAuthStates.state, state), gt(githubOAuthStates.expiresAt, now)))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    // Delete once consumed (one-time use CSRF defense)
    await db.delete(githubOAuthStates).where(eq(githubOAuthStates.state, state));
    return rows[0];
  }
}

export const githubRepository = new DrizzleGitHubRepository();
