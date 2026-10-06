import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password';
import { AuthService } from './auth.service';
import {
  DuplicateEmailError,
  DuplicateUsernameError,
  RegistrationValidationError,
  LoginValidationError,
  InvalidCredentialsError,
} from './auth.errors';
import { IUserRepository } from '../users/user.repository';
import { User, NewUser } from '../users/user.types';

// In-memory test stub repository for testing service logic without a live database
function createStubUserRepository(existingUsers: User[] = []): IUserRepository {
  const usersList: User[] = [...existingUsers];

  return {
    async findById(id: string): Promise<User | null> {
      return usersList.find((u) => u.id === id) || null;
    },
    async findByEmail(email: string): Promise<User | null> {
      return usersList.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
    },
    async findByUsername(username: string): Promise<User | null> {
      return usersList.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
    },
    async create(userData: NewUser): Promise<User> {
      const newUser: User = {
        id: '11111111-1111-1111-1111-111111111111',
        username: userData.username,
        email: userData.email,
        passwordHash: userData.passwordHash,
        displayName: userData.displayName,
        avatarUrl: userData.avatarUrl || null,
        bio: userData.bio || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersList.push(newUser);
      return newUser;
    },
  };
}

describe('Password Security', () => {
  it('should produce a hashed value different from the plaintext password', async () => {
    const plaintext = 'SecureP@ssw0rd123';
    const hash = await hashPassword(plaintext);

    assert.notEqual(hash, plaintext);
    assert.ok(hash.startsWith('$argon2id$'), 'Hash should use Argon2id format');
  });

  it('should successfully verify the correct password against its hash', async () => {
    const password = 'CorrectPassword99';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);

    assert.equal(isValid, true);
  });

  it('should fail verification when an incorrect password is provided', async () => {
    const password = 'CorrectPassword99';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword('WrongPassword123', hash);

    assert.equal(isValid, false);
  });

  it('should return false safely when given empty or corrupt hash strings', async () => {
    const isValidEmpty = await verifyPassword('any', '');
    const isValidCorrupt = await verifyPassword('any', 'not-a-valid-argon-hash');

    assert.equal(isValidEmpty, false);
    assert.equal(isValidCorrupt, false);
  });
});

describe('Registration Service (AuthService)', () => {
  it('should reject registration when input fails validation (short password, invalid email)', async () => {
    const service = new AuthService(createStubUserRepository());

    await assert.rejects(
      async () => {
        await service.register({
          username: 'ab', // too short (<3)
          email: 'not-an-email',
          password: 'short', // too short (<8)
          displayName: '', // empty
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof RegistrationValidationError);
        assert.equal(err.code, 'VALIDATION_ERROR');
        return true;
      }
    );
  });

  it('should reject registration when the email already exists in the system', async () => {
    const existingUser: User = {
      id: '99999999-9999-9999-9999-999999999999',
      username: 'existing_user',
      email: 'alex@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$fake$hash',
      displayName: 'Alex Existing',
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const service = new AuthService(createStubUserRepository([existingUser]));

    await assert.rejects(
      async () => {
        await service.register({
          username: 'new_unique_username',
          email: 'alex@example.com', // Duplicate!
          password: 'Password123!',
          displayName: 'Alex Duplicate',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof DuplicateEmailError);
        assert.equal(err.code, 'DUPLICATE_EMAIL');
        return true;
      }
    );
  });

  it('should reject registration when the username already exists in the system', async () => {
    const existingUser: User = {
      id: '99999999-9999-9999-9999-999999999999',
      username: 'taken_username',
      email: 'existing@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$fake$hash',
      displayName: 'Existing User',
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const service = new AuthService(createStubUserRepository([existingUser]));

    await assert.rejects(
      async () => {
        await service.register({
          username: 'taken_username', // Duplicate!
          email: 'unique_new_email@example.com',
          password: 'Password123!',
          displayName: 'New User',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof DuplicateUsernameError);
        assert.equal(err.code, 'DUPLICATE_USERNAME');
        return true;
      }
    );
  });

  it('should successfully register a valid user and return SafeUser without passwordHash', async () => {
    const service = new AuthService(createStubUserRepository());

    const result = await service.register({
      username: 'dr_elena',
      email: 'elena.rostova@institution.org',
      password: 'StrongPassword123',
      displayName: 'Dr. Elena Rostova',
    });

    assert.equal(result.username, 'dr_elena');
    assert.equal(result.email, 'elena.rostova@institution.org');
    assert.equal(result.displayName, 'Dr. Elena Rostova');
    assert.ok(result.id, 'User should have an id');
    assert.ok(result.createdAt, 'User should have createdAt');
    assert.ok(result.updatedAt, 'User should have updatedAt');

    // CRITICAL: passwordHash must NEVER be present on the returned SafeUser object
    assert.equal(
      'passwordHash' in result,
      false,
      'passwordHash must not exist on SafeUser'
    );
    assert.equal(
      (result as Record<string, unknown>).passwordHash,
      undefined,
      'passwordHash must be strictly undefined'
    );
  });
});

describe('Login Service (AuthService)', () => {
  const plainPassword = 'CorrectPassword123!';
  let seededUser: User;
  let service: AuthService;

  before(async () => {
    // Generate valid Argon2id hash for the seeded user
    const passwordHash = await hashPassword(plainPassword);
    seededUser = {
      id: '22222222-2222-2222-2222-222222222222',
      username: 'johndoe',
      email: 'john.doe@example.com',
      passwordHash,
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'Developer and researcher',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    service = new AuthService(createStubUserRepository([seededUser]));
  });

  it('should successfully log in with valid email and correct password, returning SafeUser and accessToken', async () => {
    const result = await service.login({
      email: 'john.doe@example.com',
      password: plainPassword,
    });

    assert.ok(result.user);
    assert.equal(result.user.id, seededUser.id);
    assert.equal(result.user.username, seededUser.username);
    assert.equal(result.user.email, seededUser.email);
    assert.equal(result.user.displayName, seededUser.displayName);
    assert.equal(result.user.avatarUrl, seededUser.avatarUrl);
    assert.equal(result.user.bio, seededUser.bio);
    assert.deepEqual(result.user.createdAt, seededUser.createdAt);
    assert.deepEqual(result.user.updatedAt, seededUser.updatedAt);

    // Verify accessToken
    assert.ok(result.accessToken, 'Should return accessToken');
    assert.equal(typeof result.accessToken, 'string');
    assert.equal(result.accessToken.split('.').length, 3, 'JWT should contain 3 parts');
  });

  it('should fail with InvalidCredentialsError when an incorrect password is provided (and no token is issued)', async () => {
    await assert.rejects(
      async () => {
        await service.login({
          email: 'john.doe@example.com',
          password: 'WrongPassword999!',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidCredentialsError);
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        assert.equal(err.status, 401);
        assert.equal(err.message, 'Invalid email or password.');
        return true;
      }
    );
  });

  it('should fail with the same InvalidCredentialsError when email does not exist (preventing email enumeration and no token issued)', async () => {
    let wrongPasswordError: InvalidCredentialsError | undefined;
    let unknownEmailError: InvalidCredentialsError | undefined;

    try {
      await service.login({
        email: 'john.doe@example.com',
        password: 'WrongPassword999!',
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        wrongPasswordError = err;
      }
    }

    await assert.rejects(
      async () => {
        await service.login({
          email: 'nonexistent.user@example.com',
          password: plainPassword,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidCredentialsError);
        unknownEmailError = err;
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        assert.equal(err.status, 401);
        // Security assertion: Error message and status are identical to wrong-password failure
        assert.equal(unknownEmailError.message, wrongPasswordError?.message);
        assert.equal(unknownEmailError.code, wrongPasswordError?.code);
        assert.equal(unknownEmailError.status, wrongPasswordError?.status);
        return true;
      }
    );
  });

  it('should normalize email address (case-insensitive and whitespace trimmed)', async () => {
    const result = await service.login({
      email: '  JOHN.DOE@EXAMPLE.COM  ',
      password: plainPassword,
    });

    assert.equal(result.user.id, seededUser.id);
    assert.equal(result.user.email, 'john.doe@example.com');
    assert.ok(result.accessToken);
  });

  it('should return SafeUser and strictly omit passwordHash upon successful login', async () => {
    const result = await service.login({
      email: 'john.doe@example.com',
      password: plainPassword,
    });

    // Verify SafeUser fields exist
    assert.ok(result.user.id);
    assert.ok(result.user.username);
    assert.ok(result.user.email);
    assert.ok(result.user.displayName);
    assert.ok(result.user.createdAt);
    assert.ok(result.user.updatedAt);

    // CRITICAL SECURITY: passwordHash must NEVER be present on the returned SafeUser object
    assert.equal('passwordHash' in result.user, false, 'passwordHash must not exist on SafeUser');
    assert.equal(
      (result.user as Record<string, unknown>).passwordHash,
      undefined,
      'passwordHash must be strictly undefined'
    );
  });

  it('should reject login when input has invalid email format', async () => {
    await assert.rejects(
      async () => {
        await service.login({
          email: 'not-an-email',
          password: plainPassword,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof LoginValidationError);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.equal(err.status, 400);
        assert.ok(Array.isArray(err.details));
        return true;
      }
    );
  });

  it('should reject login when password is empty', async () => {
    await assert.rejects(
      async () => {
        await service.login({
          email: 'john.doe@example.com',
          password: '',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof LoginValidationError);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  it('should reject login when input payload is malformed or missing fields', async () => {
    await assert.rejects(
      async () => {
        await service.login({});
      },
      (err: unknown) => {
        assert.ok(err instanceof LoginValidationError);
        assert.equal(err.code, 'VALIDATION_ERROR');
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await service.login(null);
      },
      (err: unknown) => {
        assert.ok(err instanceof LoginValidationError);
        assert.equal(err.code, 'VALIDATION_ERROR');
        return true;
      }
    );
  });

  it('should reject login when password exceeds maximum allowed length', async () => {
    await assert.rejects(
      async () => {
        await service.login({
          email: 'john.doe@example.com',
          password: 'a'.repeat(129),
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof LoginValidationError);
        assert.equal(err.code, 'VALIDATION_ERROR');
        return true;
      }
    );
  });
});
