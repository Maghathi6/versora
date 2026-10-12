import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import { createUserRouter } from './user.routes';
import { UserService } from './user.service';
import { IUserRepository } from './user.repository';
import { User, NewUser, UpdateUserData } from './user.types';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { TokenService } from '../auth/token.service';

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

describe('HTTP User Profile Endpoints (/api/v1/users/me)', () => {
  let server: Server;
  let baseUrl: string;

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const conflictUserId = '22222222-2222-2222-2222-222222222222';
  const secretKey = 'test-jwt-secret-key-at-least-16-chars-long';
  const tokenSvc = new TokenService(secretKey, '15m');

  let validToken: string;

  before(async () => {
    const seededUser: User = {
      id: testUserId,
      username: 'profile_tester',
      email: 'profile_tester@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$secret$hash',
      displayName: 'Profile Tester',
      avatarUrl: null,
      bio: 'Initial Bio',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const conflictUser: User = {
      id: conflictUserId,
      username: 'taken_handle',
      email: 'taken@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$secret$hash2',
      displayName: 'Taken Handle',
      avatarUrl: null,
      bio: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const userRepo = createStubUserRepository([seededUser, conflictUser]);
    const userService = new UserService(userRepo);
    const authMiddleware = createAuthMiddleware({ userRepo, tokenSvc });

    validToken = tokenSvc.signAccessToken({ userId: testUserId, username: 'profile_tester' });

    const app: Application = express();
    app.use(express.json());

    const rootRouter = Router();
    const v1Router = Router();
    v1Router.use('/users', createUserRouter(userService, authMiddleware));
    rootRouter.use('/v1', v1Router);
    rootRouter.use('/users', createUserRouter(userService, authMiddleware));

    app.use('/api', rootRouter);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  describe('GET /api/v1/users/me', () => {
    it('without token returns 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`);
      assert.equal(res.status, 401);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'UNAUTHORIZED');
    });

    it('with invalid token returns 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      assert.equal(res.status, 401);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'UNAUTHORIZED');
    });

    it('with valid token returns HTTP 200 with SafeUser', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: string;
          username: string;
          email: string;
          displayName: string;
          bio: string | null;
        };
      };

      assert.equal(body.success, true);
      assert.equal(body.data.id, testUserId);
      assert.equal(body.data.username, 'profile_tester');
      assert.equal(body.data.email, 'profile_tester@example.com');
      assert.equal(body.data.displayName, 'Profile Tester');
      assert.equal(body.data.bio, 'Initial Bio');
    });

    it('CRITICAL SECURITY: passwordHash is strictly absent from GET response', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.equal(res.status, 200);
      const rawText = await res.text();
      assert.equal(rawText.includes('passwordHash'), false);
      const body = JSON.parse(rawText);
      assert.equal('passwordHash' in body.data, false);
    });

    it('supports GET /api/users/me route alias seamlessly', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: { username: string } };
      assert.equal(body.data.username, 'profile_tester');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('without token returns 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'New Name' }),
      });

      assert.equal(res.status, 401);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'UNAUTHORIZED');
    });

    it('with valid token successfully updates permitted fields', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({
          displayName: 'Updated Display Name',
          username: 'updated_tester',
          bio: 'Updated biographical statement',
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          id: string;
          username: string;
          displayName: string;
          bio: string | null;
          email: string;
          updatedAt: string;
        };
      };

      assert.equal(body.success, true);
      assert.equal(body.data.displayName, 'Updated Display Name');
      assert.equal(body.data.username, 'updated_tester');
      assert.equal(body.data.bio, 'Updated biographical statement');
      assert.equal(body.data.email, 'profile_tester@example.com');
      assert.ok(body.data.updatedAt);
    });

    it('CRITICAL SECURITY: passwordHash is strictly absent from PATCH response', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ displayName: 'Another Name' }),
      });

      assert.equal(res.status, 200);
      const rawText = await res.text();
      assert.equal(rawText.includes('passwordHash'), false);
      const body = JSON.parse(rawText);
      assert.equal('passwordHash' in body.data, false);
    });

    it('rejects duplicate username with 409 DUPLICATE_USERNAME', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ username: 'taken_handle' }),
      });

      assert.equal(res.status, 409);
      const body = (await res.json()) as { error: { code: string; message: string } };
      assert.equal(body.error.code, 'DUPLICATE_USERNAME');
      assert.ok(body.error.message.includes('taken_handle'));
    });

    it('rejects invalid input (short username, empty displayName) with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ username: 'ab', displayName: '' }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as {
        error: { code: string; details?: Array<{ field: string; issue: string }> };
      };
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(body.error.details));
      const fields = body.error.details.map((d) => d.field);
      assert.ok(fields.includes('username'));
      assert.ok(fields.includes('displayName'));
    });

    it('rejects attempts to modify protected fields (email, id, passwordHash) with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ email: 'new_hacked@example.com' }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    it('rejects empty payload with 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    it('supports PATCH /api/users/me route alias seamlessly', async () => {
      const res = await fetch(`${baseUrl}/api/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ displayName: 'Alias Patch Test' }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: { displayName: string } };
      assert.equal(body.data.displayName, 'Alias Patch Test');
    });
  });
});
