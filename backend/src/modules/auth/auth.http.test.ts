import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express, { Application, Router } from 'express';
import { createAuthRouter } from './auth.routes';
import { AuthService } from './auth.service';
import { IUserRepository } from '../users/user.repository';
import { User, NewUser } from '../users/user.types';
import { notFoundHandler, globalErrorHandler } from '../../middlewares/error.middleware';
import { hashPassword } from './password';

// In-memory test repository for exercising the HTTP boundary without a live DB
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
        id: '22222222-2222-2222-2222-222222222222',
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

describe('HTTP Registration Endpoint (POST /api/v1/auth/register)', () => {
  let server: Server;
  let baseUrl: string;

  // Pre-seeded existing user for conflict tests
  const existingUser: User = {
    id: '99999999-9999-9999-9999-999999999999',
    username: 'existing_user',
    email: 'existing@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$fake$hash',
    displayName: 'Existing User',
    avatarUrl: null,
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  before(async () => {
    const userRepo = createStubUserRepository([existingUser]);
    const service = new AuthService(userRepo);

    // Build test Express application matching the production routing structure
    const app: Application = express();
    app.use(express.json());

    const rootRouter = Router();
    const v1Router = Router();
    v1Router.use('/auth', createAuthRouter(service));
    rootRouter.use('/v1', v1Router);
    rootRouter.use('/auth', createAuthRouter(service));

    app.use('/api', rootRouter);
    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    // Bind to ephemeral port
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

  it('valid registration returns a successful response (HTTP 201 with SafeUser)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'elena_rostova',
        email: 'elena@example.com',
        password: 'ValidPassword123!',
        displayName: 'Elena Rostova',
      }),
    });

    assert.equal(res.status, 201, 'Status code should be 201 Created');
    assert.ok(res.headers.get('content-type')?.includes('application/json'));

    const body = (await res.json()) as {
      success: boolean;
      data: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        bio: string | null;
        createdAt: string;
        updatedAt: string;
      };
      timestamp: string;
    };

    assert.equal(body.success, true);
    assert.equal(body.data.username, 'elena_rostova');
    assert.equal(body.data.email, 'elena@example.com');
    assert.equal(body.data.displayName, 'Elena Rostova');
    assert.ok(body.data.id);
    assert.ok(body.data.createdAt);
    assert.ok(body.data.updatedAt);
    assert.ok(body.timestamp);
  });

  it('CRITICAL SECURITY: passwordHash is never present in the response body', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'security_audit',
        email: 'audit@example.com',
        password: 'SecretPassword99!',
        displayName: 'Security Auditor',
      }),
    });

    assert.equal(res.status, 201);
    const rawText = await res.text();

    // Verify raw JSON string does not contain passwordHash
    assert.equal(
      rawText.includes('passwordHash'),
      false,
      'passwordHash must not appear anywhere in the serialized HTTP response body'
    );

    const body = JSON.parse(rawText);
    assert.equal('passwordHash' in body.data, false);
    assert.equal((body.data as Record<string, unknown>).passwordHash, undefined);
  });

  it('invalid registration returns 400 with VALIDATION_ERROR code and field issues', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ab', // too short (<3)
        email: 'invalid-email',
        password: 'short', // too short (<8)
        displayName: '', // empty
      }),
    });

    assert.equal(res.status, 400, 'Status code should be 400 Bad Request');
    const body = (await res.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
        details?: Array<{ field: string; issue: string }>;
      };
      timestamp: string;
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(body.error.message, 'Registration input failed validation rules.');
    assert.ok(Array.isArray(body.error.details));
    assert.ok(body.error.details.length >= 4);

    const fields = body.error.details.map((d) => d.field);
    assert.ok(fields.includes('username'));
    assert.ok(fields.includes('email'));
    assert.ok(fields.includes('password'));
    assert.ok(fields.includes('displayName'));
  });

  it('duplicate email returns 409 Conflict with DUPLICATE_EMAIL code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'unique_user_name',
        email: 'existing@example.com', // Duplicate!
        password: 'ValidPassword123!',
        displayName: 'Unique Display Name',
      }),
    });

    assert.equal(res.status, 409, 'Status code should be 409 Conflict');
    const body = (await res.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
      };
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'DUPLICATE_EMAIL');
    assert.ok(body.error.message.includes('existing@example.com'));
  });

  it('duplicate username returns 409 Conflict with DUPLICATE_USERNAME code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'existing_user', // Duplicate!
        email: 'new_unique_email@example.com',
        password: 'ValidPassword123!',
        displayName: 'Another Display Name',
      }),
    });

    assert.equal(res.status, 409, 'Status code should be 409 Conflict');
    const body = (await res.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
      };
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'DUPLICATE_USERNAME');
    assert.ok(body.error.message.includes('existing_user'));
  });

  it('malformed JSON payload in request body returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"username": "broken_json',
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'BAD_REQUEST');
  });

  it('supports POST /api/auth/register route alias seamlessly', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alias_user',
        email: 'alias@example.com',
        password: 'ValidPassword123!',
        displayName: 'Alias User',
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      success: boolean;
      data: { username: string; email: string };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.username, 'alias_user');
  });
});

describe('HTTP Login Endpoint (POST /api/v1/auth/login)', () => {
  let server: Server;
  let baseUrl: string;

  const validPassword = 'SecurePassword123!';
  let seededLoginUser: User;

  before(async () => {
    const passwordHash = await hashPassword(validPassword);
    seededLoginUser = {
      id: '33333333-3333-3333-3333-333333333333',
      username: 'login_tester',
      email: 'login_user@example.com',
      passwordHash,
      displayName: 'Login Tester',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'Test bio',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const userRepo = createStubUserRepository([seededLoginUser]);
    const service = new AuthService(userRepo);

    // Build test Express application matching the production routing structure
    const app: Application = express();
    app.use(express.json());

    const rootRouter = Router();
    const v1Router = Router();
    v1Router.use('/auth', createAuthRouter(service));
    rootRouter.use('/v1', v1Router);
    rootRouter.use('/auth', createAuthRouter(service));

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

  it('correct email + correct password returns HTTP 200 with SafeUser and success true', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login_user@example.com',
        password: validPassword,
      }),
    });

    assert.equal(res.status, 200, 'Status code should be 200 OK');
    assert.ok(res.headers.get('content-type')?.includes('application/json'));

    const body = (await res.json()) as {
      success: boolean;
      data: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        bio: string | null;
        createdAt: string;
        updatedAt: string;
      };
      timestamp: string;
    };

    assert.equal(body.success, true);
    assert.equal(body.data.id, seededLoginUser.id);
    assert.equal(body.data.username, seededLoginUser.username);
    assert.equal(body.data.email, seededLoginUser.email);
    assert.equal(body.data.displayName, seededLoginUser.displayName);
    assert.equal(body.data.avatarUrl, seededLoginUser.avatarUrl);
    assert.equal(body.data.bio, seededLoginUser.bio);
    assert.ok(body.data.createdAt);
    assert.ok(body.data.updatedAt);
    assert.ok(body.timestamp);
  });

  it('CRITICAL SECURITY: passwordHash is never present in the login response body', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login_user@example.com',
        password: validPassword,
      }),
    });

    assert.equal(res.status, 200);
    const rawText = await res.text();

    assert.equal(
      rawText.includes('passwordHash'),
      false,
      'passwordHash must not appear anywhere in serialized HTTP response body'
    );

    const body = JSON.parse(rawText);
    assert.equal('passwordHash' in body.data, false);
    assert.equal((body.data as Record<string, unknown>).passwordHash, undefined);
  });

  it('wrong password returns HTTP 401 with INVALID_CREDENTIALS code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login_user@example.com',
        password: 'IncorrectPassword999!',
      }),
    });

    assert.equal(res.status, 401, 'Status code should be 401 Unauthorized');
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
      timestamp: string;
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid email or password.');
    assert.ok(body.timestamp);
  });

  it('unknown email returns HTTP 401 with INVALID_CREDENTIALS code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: validPassword,
      }),
    });

    assert.equal(res.status, 401, 'Status code should be 401 Unauthorized');
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
      timestamp: string;
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(body.error.message, 'Invalid email or password.');
    assert.ok(body.timestamp);
  });

  it('CRITICAL SECURITY: unknown email and wrong password expose the exact same error response structure', async () => {
    const [resWrongPass, resUnknownEmail] = await Promise.all([
      fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'login_user@example.com',
          password: 'IncorrectPassword999!',
        }),
      }),
      fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: validPassword,
        }),
      }),
    ]);

    assert.equal(resWrongPass.status, 401);
    assert.equal(resUnknownEmail.status, 401);

    const bodyWrongPass = (await resWrongPass.json()) as { error: { code: string; message: string } };
    const bodyUnknownEmail = (await resUnknownEmail.json()) as { error: { code: string; message: string } };

    assert.equal(bodyWrongPass.error.code, bodyUnknownEmail.error.code);
    assert.equal(bodyWrongPass.error.message, bodyUnknownEmail.error.message);
    assert.equal(bodyWrongPass.error.code, 'INVALID_CREDENTIALS');
  });

  it('invalid email returns HTTP 400 with VALIDATION_ERROR code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: validPassword,
      }),
    });

    assert.equal(res.status, 400, 'Status code should be 400 Bad Request');
    const body = (await res.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
        details?: Array<{ field: string; issue: string }>;
      };
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.error.details));
    const fields = body.error.details.map((d) => d.field);
    assert.ok(fields.includes('email'));
  });

  it('empty or missing password returns HTTP 400 with VALIDATION_ERROR code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login_user@example.com',
        password: '',
      }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field: string; issue: string }> };
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.error.details));
    const fields = body.error.details.map((d) => d.field);
    assert.ok(fields.includes('password'));
  });

  it('missing required login fields returns HTTP 400 with VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field: string; issue: string }> };
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.error.details));
    const fields = body.error.details.map((d) => d.field);
    assert.ok(fields.includes('email'));
    assert.ok(fields.includes('password'));
  });

  it('email normalization: login succeeds with mixed casing and surrounding whitespace', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '  LOGIN_USER@EXAMPLE.COM  ',
        password: validPassword,
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: { email: string };
    };

    assert.equal(body.success, true);
    assert.equal(body.data.email, 'login_user@example.com');
  });

  it('supports POST /api/auth/login route alias seamlessly', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login_user@example.com',
        password: validPassword,
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: { username: string; email: string };
    };

    assert.equal(body.success, true);
    assert.equal(body.data.username, 'login_tester');
    assert.equal(body.data.email, 'login_user@example.com');
  });

  it('malformed JSON payload in request body returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": "broken_json',
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    assert.equal(body.success, false);
    assert.equal(body.error.code, 'BAD_REQUEST');
  });
});
