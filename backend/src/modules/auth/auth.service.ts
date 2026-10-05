import { userRepository, IUserRepository } from '../users/user.repository';
import { SafeUser, toSafeUser } from '../users/user.types';
import { hashPassword } from './password';
import { registerSchema, RegisterInput } from './auth.schemas';
import {
  DuplicateEmailError,
  DuplicateUsernameError,
  RegistrationValidationError,
} from './auth.errors';

export interface IAuthService {
  register(input: unknown): Promise<SafeUser>;
}

export class AuthService implements IAuthService {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository = userRepository) {
    this.userRepo = userRepo;
  }

  /**
   * Registers a new user account.
   *
   * Flow:
   * 1. Validate registration input against registerSchema
   * 2. Verify email uniqueness
   * 3. Verify username uniqueness
   * 4. Hash password securely using Argon2id
   * 5. Persist user via userRepository
   * 6. Convert to SafeUser (stripping passwordHash)
   * 7. Return SafeUser
   */
  async register(rawInput: unknown): Promise<SafeUser> {
    // 1. Validate registration input
    const parseResult = registerSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        issue: err.message,
      }));
      throw new RegistrationValidationError(details);
    }

    const input: RegisterInput = parseResult.data;

    // 2. Check for duplicate email
    const existingEmail = await this.userRepo.findByEmail(input.email);
    if (existingEmail) {
      throw new DuplicateEmailError(input.email);
    }

    // 3. Check for duplicate username
    const existingUsername = await this.userRepo.findByUsername(input.username);
    if (existingUsername) {
      throw new DuplicateUsernameError(input.username);
    }

    // 4. Hash password securely (Argon2id)
    const passwordHash = await hashPassword(input.password);

    // 5. Create user in database
    const createdUser = await this.userRepo.create({
      username: input.username,
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });

    // 6 & 7. Convert and return SafeUser
    return toSafeUser(createdUser);
  }
}

// Export default singleton instance using production repository
export const authService = new AuthService();
