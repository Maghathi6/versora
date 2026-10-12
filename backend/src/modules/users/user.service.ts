import { IUserRepository, userRepository } from './user.repository';
import { SafeUser, toSafeUser, UpdateUserData } from './user.types';
import { updateProfileSchema, UpdateProfileInput } from './user.schemas';
import { ProfileValidationError } from './user.errors';
import { DuplicateUsernameError, UnauthorizedError } from '../auth/auth.errors';

export interface IUserService {
  getProfile(userId: string): Promise<SafeUser>;
  updateProfile(userId: string, rawInput: unknown): Promise<SafeUser>;
}

export class UserService implements IUserService {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository = userRepository) {
    this.userRepo = userRepo;
  }

  /**
   * Retrieves user profile by authenticated user ID and returns SafeUser without password hash.
   */
  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User account not found.');
    }
    return toSafeUser(user);
  }

  /**
   * Validates and updates user profile fields (displayName, username, bio).
   * Normalizes username consistently with registration rules and enforces uniqueness.
   * Updates `updatedAt` and guarantees password hashes and immutable IDs are never modified or returned.
   */
  async updateProfile(userId: string, rawInput: unknown): Promise<SafeUser> {
    // 1. Confirm user existence
    const currentUser = await this.userRepo.findById(userId);
    if (!currentUser) {
      throw new UnauthorizedError('User account not found.');
    }

    // 2. Validate input payload against strict Zod schema
    const parseResult = updateProfileSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message,
      }));
      throw new ProfileValidationError(details);
    }

    const data: UpdateProfileInput = parseResult.data;

    // 3. Username uniqueness verification
    let normalizedUsername: string | undefined;
    if (data.username !== undefined) {
      normalizedUsername = data.username.toLowerCase().trim();
      // Only verify uniqueness if changing to a username different from current
      if (normalizedUsername !== currentUser.username.toLowerCase()) {
        const existingUser = await this.userRepo.findByUsername(normalizedUsername);
        if (existingUser && existingUser.id !== userId) {
          throw new DuplicateUsernameError(data.username);
        }
      }
    }

    // 4. Construct update payload strictly allowing only permitted fields
    const updatePayload: UpdateUserData = {};
    if (data.displayName !== undefined) {
      updatePayload.displayName = data.displayName.trim();
    }
    if (normalizedUsername !== undefined) {
      updatePayload.username = normalizedUsername;
    }
    if (data.bio !== undefined) {
      updatePayload.bio = data.bio === null ? null : data.bio.trim();
    }

    // 5. Update user in repository
    const updatedUser = await this.userRepo.update(userId, updatePayload);
    if (!updatedUser) {
      throw new UnauthorizedError('Failed to update user profile.');
    }

    // 6. Return SafeUser representation (omits passwordHash)
    return toSafeUser(updatedUser);
  }
}

export const userService = new UserService();
