import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema/users';
import { User, NewUser, UpdateUserData } from './user.types';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(userData: NewUser): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User | null>;
}


export const userRepository: IUserRepository = {
  /**
   * Finds a user by their primary UUID.
   */
  async findById(id: string): Promise<User | null> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] || null;
  },

  /**
   * Finds a user by their unique email address.
   */
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    return rows[0] || null;
  },

  /**
   * Finds a user by their unique username.
   */
  async findByUsername(username: string): Promise<User | null> {
    const normalizedUsername = username.toLowerCase().trim();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, normalizedUsername))
      .limit(1);
    return rows[0] || null;
  },

  /**
   * Inserts a new user record into PostgreSQL and returns the created entity.
   */
  async create(userData: NewUser): Promise<User> {
    const rows = await db
      .insert(users)
      .values({
        ...userData,
        email: userData.email.toLowerCase().trim(),
        username: userData.username.toLowerCase().trim(),
      })
      .returning();
    return rows[0];
  },

  /**
   * Updates permitted profile fields of an existing user and returns the updated entity.
   */
  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const updatePayload: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.displayName !== undefined) {
      updatePayload.displayName = data.displayName.trim();
    }
    if (data.username !== undefined) {
      updatePayload.username = data.username.toLowerCase().trim();
    }
    if (data.bio !== undefined) {
      updatePayload.bio = data.bio === null ? null : data.bio.trim();
    }

    const rows = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, id))
      .returning();
    return rows[0] || null;
  },
};

