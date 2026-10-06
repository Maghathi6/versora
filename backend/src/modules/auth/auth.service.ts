import { userRepository, IUserRepository } from '../users/user.repository';
import { SafeUser, toSafeUser } from '../users/user.types';
import { hashPassword, verifyPassword } from './password';
import { registerSchema, RegisterInput, loginSchema, LoginInput } from './auth.schemas';
import {
  DuplicateEmailError,
  DuplicateUsernameError,
  RegistrationValidationError,
  LoginValidationError,
  InvalidCredentialsError,
} from './auth.errors';
import { ITokenService, tokenService } from './token.service';

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
}

export interface IAuthService {
  register(input: unknown): Promise<SafeUser>;
  login(input: unknown): Promise<AuthResult>;
}

export class AuthService implements IAuthService {
  private userRepo: IUserRepository;
  private tokenSvc: ITokenService;

  constructor(
    userRepo: IUserRepository = userRepository,
    tokenSvc: ITokenService = tokenService
  ) {
    this.userRepo = userRepo;
    this.tokenSvc = tokenSvc;
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

  /**
   * Authenticates a user with email and password.
   *
   * Flow:
   * 1. Validate login input against loginSchema
   * 2. Normalize email
   * 3. Query user by email from userRepository
   * 4. If user does not exist, throw generic InvalidCredentialsError
   * 5. Verify password using Argon2id verifyPassword()
   * 6. If password verification fails, throw generic InvalidCredentialsError
   * 7. Convert user entity to SafeUser (stripping passwordHash)
   * 8. Generate signed JWT access token via tokenService
   * 9. Return AuthResult { user: SafeUser, accessToken: string }
   *
   * Security Guarantees:
   * - Generic error prevents email enumeration
   * - Passwords and password hashes are never logged or exposed
   * - Token payload is strictly minimal and expires promptly
   */
  async login(rawInput: unknown): Promise<AuthResult> {
    // 1. Validate login input
    const parseResult = loginSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        issue: err.message,
      }));
      throw new LoginValidationError(details);
    }

    const input: LoginInput = parseResult.data;

    // 2. Normalize email
    const normalizedEmail = input.email.trim().toLowerCase();

    // 3. Find user by email
    const user = await this.userRepo.findByEmail(normalizedEmail);

    // 4. Verify user exists
    if (!user) {
      throw new InvalidCredentialsError();
    }

    // 5 & 6. Verify password
    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // 7. Convert user entity to SafeUser (stripping passwordHash)
    const safeUser = toSafeUser(user);

    // 8. Generate JWT access token
    const accessToken = this.tokenSvc.signAccessToken({
      userId: safeUser.id,
      username: safeUser.username,
    });

    // 9. Return authenticated result
    return {
      user: safeUser,
      accessToken,
    };
  }
}

// Export default singleton instance using production repository
export const authService = new AuthService();
