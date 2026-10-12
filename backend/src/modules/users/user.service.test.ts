import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { UserService } from './user.service';
import { IUserRepository } from './user.repository';
import { User, NewUser, UpdateUserData } from './user.types';
import { ProfileValidationError } from './user.errors';
import { DuplicateUsernameError, UnauthorizedError } from '../auth/auth.errors';

function createStubUserRepository(seedUsers: User[] = []): IUserRepository {
  const usersList: User[] = [...seedUsers];

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
        id: 'user-uuid-1',
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
    async update(id: string, data: UpdateUserData): Promise<User | null> {
      const user = usersList.find((u) => u.id === id);
      if (!user) return null;
      if (data.displayName !== undefined) user.displayName = data.displayName.trim();
      if (data.username !== undefined) user.username = data.username.toLowerCase().trim();
      if (data.bio !== undefined) user.bio = data.bio === null ? null : data.bio.trim();
      user.updatedAt = new Date();
      return user;
    },
  };
}

describe('User Profile Service (UserService)', () => {
  const testUserId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '22222222-2222-2222-2222-222222222222';

  let initialUser: User;
  let otherUser: User;
  let service: UserService;

  beforeEach(() => {
    initialUser = {
      id: testUserId,
      username: 'elena_rostova',
      email: 'elena@institution.org',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$secret$hash',
      displayName: 'Dr. Elena Rostova',
      avatarUrl: null,
      bio: 'Quantum computation researcher',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    otherUser = {
      id: otherUserId,
      username: 'marcus_vance',
      email: 'marcus@institution.org',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$secret$hash2',
      displayName: 'Marcus Vance',
      avatarUrl: null,
      bio: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const userRepo = createStubUserRepository([initialUser, otherUser]);
    service = new UserService(userRepo);
  });

  describe('getProfile', () => {
    it('successfully retrieves authenticated user SafeUser profile', async () => {
      const profile = await service.getProfile(testUserId);

      assert.equal(profile.id, testUserId);
      assert.equal(profile.username, 'elena_rostova');
      assert.equal(profile.email, 'elena@institution.org');
      assert.equal(profile.displayName, 'Dr. Elena Rostova');
      assert.equal(profile.bio, 'Quantum computation researcher');
    });

    it('strictly omits passwordHash from retrieved profile', async () => {
      const profile = await service.getProfile(testUserId);
      assert.equal('passwordHash' in profile, false);
      assert.equal((profile as Record<string, unknown>).passwordHash, undefined);
    });

    it('throws UnauthorizedError when user does not exist', async () => {
      await assert.rejects(
        () => service.getProfile('00000000-0000-0000-0000-000000000000'),
        (err: Error) => {
          assert.ok(err instanceof UnauthorizedError);
          return true;
        }
      );
    });
  });

  describe('updateProfile', () => {
    it('successfully updates displayName, username, and bio', async () => {
      const updated = await service.updateProfile(testUserId, {
        displayName: 'Prof. Elena Rostova',
        username: 'elena_quantum',
        bio: 'Lead investigator at Quantum Lab',
      });

      assert.equal(updated.displayName, 'Prof. Elena Rostova');
      assert.equal(updated.username, 'elena_quantum');
      assert.equal(updated.bio, 'Lead investigator at Quantum Lab');
      assert.equal(updated.email, 'elena@institution.org');
      assert.equal('passwordHash' in updated, false);
      assert.notEqual(updated.updatedAt, initialUser.createdAt);
    });

    it('allows updating only a subset of permitted fields', async () => {
      const updated = await service.updateProfile(testUserId, {
        displayName: 'Elena Rostova, Ph.D.',
      });

      assert.equal(updated.displayName, 'Elena Rostova, Ph.D.');
      assert.equal(updated.username, 'elena_rostova'); // Unchanged
      assert.equal(updated.bio, 'Quantum computation researcher'); // Unchanged
    });

    it('normalizes username to lowercase and trims whitespace', async () => {
      const updated = await service.updateProfile(testUserId, {
        username: '  ELENA_NEW  ',
      });

      assert.equal(updated.username, 'elena_new');
    });

    it('allows re-submitting the current username without duplicate error', async () => {
      const updated = await service.updateProfile(testUserId, {
        displayName: 'Elena Updated',
        username: 'elena_rostova',
      });

      assert.equal(updated.username, 'elena_rostova');
      assert.equal(updated.displayName, 'Elena Updated');
    });

    it('allows setting bio to null or empty string', async () => {
      const updated = await service.updateProfile(testUserId, {
        bio: null,
      });

      assert.equal(updated.bio, null);
    });

    it('rejects duplicate username taken by another user with DuplicateUsernameError', async () => {
      await assert.rejects(
        () =>
          service.updateProfile(testUserId, {
            username: 'marcus_vance', // Already taken by otherUser
          }),
        (err: Error) => {
          assert.ok(err instanceof DuplicateUsernameError);
          assert.equal((err as DuplicateUsernameError).status, 409);
          return true;
        }
      );
    });

    it('rejects invalid username (< 3 chars or invalid characters)', async () => {
      await assert.rejects(
        () =>
          service.updateProfile(testUserId, {
            username: 'ab',
          }),
        (err: Error) => {
          assert.ok(err instanceof ProfileValidationError);
          return true;
        }
      );

      await assert.rejects(
        () =>
          service.updateProfile(testUserId, {
            username: 'invalid user name with spaces!',
          }),
        (err: Error) => {
          assert.ok(err instanceof ProfileValidationError);
          return true;
        }
      );
    });

    it('rejects empty displayName', async () => {
      await assert.rejects(
        () =>
          service.updateProfile(testUserId, {
            displayName: '   ',
          }),
        (err: Error) => {
          assert.ok(err instanceof ProfileValidationError);
          return true;
        }
      );
    });

    it('rejects bio exceeding 500 characters', async () => {
      const longBio = 'a'.repeat(501);
      await assert.rejects(
        () =>
          service.updateProfile(testUserId, {
            bio: longBio,
          }),
        (err: Error) => {
          assert.ok(err instanceof ProfileValidationError);
          return true;
        }
      );
    });

    it('rejects attempts to modify protected fields (email, id, passwordHash)', async () => {
      await assert.rejects(
        () =>
          service.updateProfile(testUserId, {
            email: 'hacker@institution.org',
          }),
        (err: Error) => {
          assert.ok(err instanceof ProfileValidationError);
          return true;
        }
      );

      await assert.rejects(
        () =>
          service.updateProfile(testUserId, {
            passwordHash: '$fake$hash',
          }),
        (err: Error) => {
          assert.ok(err instanceof ProfileValidationError);
          return true;
        }
      );

      await assert.rejects(
        () =>
          service.updateProfile(testUserId, {
            id: '99999999-9999-9999-9999-999999999999',
          }),
        (err: Error) => {
          assert.ok(err instanceof ProfileValidationError);
          return true;
        }
      );
    });

    it('rejects empty payload when no fields are supplied', async () => {
      await assert.rejects(
        () => service.updateProfile(testUserId, {}),
        (err: Error) => {
          assert.ok(err instanceof ProfileValidationError);
          return true;
        }
      );
    });
  });
});
