import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from './auth.middleware';
import { TokenService } from '../modules/auth/token.service';
import { UnauthorizedError } from '../modules/auth/auth.errors';
import { IUserRepository } from '../modules/users/user.repository';
import { User, NewUser } from '../modules/users/user.types';

describe('Authentication Middleware (auth.middleware)', () => {
  const secretKey = 'test-secret-key-for-auth-middleware-tests';
  const tokenSvc = new TokenService(secretKey, '15m');

  const activeUser: User = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    username: 'active_user',
    email: 'active@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$fake$hash',
    displayName: 'Active User',
    avatarUrl: null,
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createStubUserRepo(users: User[] = []): IUserRepository {
    const list = [...users];
    return {
      async findById(id: string): Promise<User | null> {
        return list.find((u) => u.id === id) || null;
      },
      async findByEmail(email: string): Promise<User | null> {
        return list.find((u) => u.email === email) || null;
      },
      async findByUsername(username: string): Promise<User | null> {
        return list.find((u) => u.username === username) || null;
      },
      async create(userData: NewUser): Promise<User> {
        return {
          id: 'test-id',
          username: userData.username,
          email: userData.email,
          passwordHash: userData.passwordHash,
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl || null,
          bio: userData.bio || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    };
  }

  const userRepo = createStubUserRepo([activeUser]);
  const middleware = createAuthMiddleware({ userRepo, tokenSvc });

  it('10. missing Authorization header fails with 401 UNAUTHORIZED', async () => {
    const req = { headers: {} } as Request;
    let capturedError: unknown;

    await middleware(req, {} as Response, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof UnauthorizedError);
    assert.equal((capturedError as UnauthorizedError).code, 'UNAUTHORIZED');
    assert.equal((capturedError as UnauthorizedError).status, 401);
  });

  it('11. invalid Authorization format fails with 401 UNAUTHORIZED', async () => {
    const reqNonBearer = { headers: { authorization: 'Basic user:pass' } } as Request;
    let capturedError1: unknown;

    await middleware(reqNonBearer, {} as Response, (err?: unknown) => {
      capturedError1 = err;
    });

    assert.ok(capturedError1 instanceof UnauthorizedError);
    assert.equal((capturedError1 as UnauthorizedError).code, 'UNAUTHORIZED');
    assert.equal((capturedError1 as UnauthorizedError).status, 401);

    const reqMissingToken = { headers: { authorization: 'Bearer' } } as Request;
    let capturedError2: unknown;

    await middleware(reqMissingToken, {} as Response, (err?: unknown) => {
      capturedError2 = err;
    });

    assert.ok(capturedError2 instanceof UnauthorizedError);
    assert.equal((capturedError2 as UnauthorizedError).code, 'UNAUTHORIZED');
  });

  it('12. invalid JWT fails with 401 UNAUTHORIZED', async () => {
    const req = { headers: { authorization: 'Bearer invalid.tampered.token' } } as Request;
    let capturedError: unknown;

    await middleware(req, {} as Response, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof UnauthorizedError);
    assert.equal((capturedError as UnauthorizedError).code, 'UNAUTHORIZED');
    assert.equal((capturedError as UnauthorizedError).status, 401);
  });

  it('13. expired JWT fails with 401 UNAUTHORIZED', async () => {
    const expiredToken = tokenSvc.signAccessToken(
      { userId: activeUser.id, username: activeUser.username },
      { expiresIn: '-1s' }
    );
    const req = { headers: { authorization: `Bearer ${expiredToken}` } } as Request;
    let capturedError: unknown;

    await middleware(req, {} as Response, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof UnauthorizedError);
    assert.equal((capturedError as UnauthorizedError).code, 'UNAUTHORIZED');
    assert.equal((capturedError as UnauthorizedError).status, 401);
  });

  it('14. valid JWT allows authenticated request to succeed', async () => {
    const validToken = tokenSvc.signAccessToken({
      userId: activeUser.id,
      username: activeUser.username,
    });
    const req = { headers: { authorization: `Bearer ${validToken}` } } as Request;
    let nextCalled = false;
    let capturedError: unknown;

    await middleware(req, {} as Response, (err?: unknown) => {
      nextCalled = true;
      capturedError = err;
    });

    assert.equal(nextCalled, true);
    assert.equal(capturedError, undefined);
    assert.ok(req.user);
    assert.equal(req.user.id, activeUser.id);
    assert.equal(req.user.username, activeUser.username);
  });

  it('15. valid JWT referencing deleted or nonexistent user fails with 401 UNAUTHORIZED', async () => {
    const tokenForNonexistentUser = tokenSvc.signAccessToken({
      userId: 'nonexistent-uuid-0000-000000000000',
      username: 'deleted_user',
    });
    const req = { headers: { authorization: `Bearer ${tokenForNonexistentUser}` } } as Request;
    let capturedError: unknown;

    await middleware(req, {} as Response, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof UnauthorizedError);
    assert.equal((capturedError as UnauthorizedError).code, 'UNAUTHORIZED');
    assert.equal((capturedError as UnauthorizedError).status, 401);
  });

  it('16. req.user strictly never contains passwordHash', async () => {
    const validToken = tokenSvc.signAccessToken({
      userId: activeUser.id,
      username: activeUser.username,
    });
    const req = { headers: { authorization: `Bearer ${validToken}` } } as Request;

    await middleware(req, {} as Response, () => {});

    assert.ok(req.user);
    assert.equal('passwordHash' in req.user, false, 'passwordHash must not exist on req.user');
    assert.equal((req.user as Record<string, unknown>).passwordHash, undefined);
  });
});
