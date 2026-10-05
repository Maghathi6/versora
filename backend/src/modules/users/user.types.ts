import { users } from '../../db/schema/users';

/**
 * Full user model matching the PostgreSQL database schema.
 */
export type User = typeof users.$inferSelect;

/**
 * Payload type required to insert a new user into the database.
 */
export type NewUser = typeof users.$inferInsert;

/**
 * Safe user data representation that strictly omits credential hashes.
 * All public-facing API responses MUST return SafeUser instead of User.
 */
export type SafeUser = Omit<User, 'passwordHash'>;

/**
 * Utility function to strip sensitive authentication credentials from a user record.
 */
export function toSafeUser(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
