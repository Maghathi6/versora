import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password';
import { AuthService } from './auth.service';
import {
  DuplicateEmailError,
  DuplicateUsernameError,
  RegistrationValidationError,
} from './auth.errors';
import { IUserRepository } from '../users/user.repository';
import { User, NewUser } from '../users/user.types';

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
  // Test stub repository
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
