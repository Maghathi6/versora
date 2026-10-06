import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { TokenService, tokenService } from './token.service';

describe('Token Service (JWT)', () => {
  const sampleUserId = '12345678-1234-1234-1234-123456789012';
  const sampleUsername = 'dr_elena';

  it('1. should create a valid JWT string', () => {
    const token = tokenService.signAccessToken({
      userId: sampleUserId,
      username: sampleUsername,
    });

    assert.equal(typeof token, 'string');
    assert.equal(token.split('.').length, 3, 'JWT should contain header, payload, and signature');
  });

  it('2. should contain user ID in sub claim', () => {
    const token = tokenService.signAccessToken({
      userId: sampleUserId,
      username: sampleUsername,
    });

    const decoded = jwt.decode(token) as Record<string, unknown>;
    assert.equal(decoded.sub, sampleUserId);
    assert.equal(decoded.username, sampleUsername);
    assert.equal(decoded.type, 'access');
  });

  it('3. should verify valid token successfully and return decoded payload', () => {
    const token = tokenService.signAccessToken({
      userId: sampleUserId,
      username: sampleUsername,
    });

    const verified = tokenService.verifyAccessToken(token);
    assert.equal(verified.sub, sampleUserId);
    assert.equal(verified.username, sampleUsername);
    assert.equal(verified.type, 'access');
    assert.ok(verified.iat);
    assert.ok(verified.exp);
  });

  it('4. should fail verification when signature is invalid', () => {
    const customService = new TokenService('a-very-secret-key-that-is-at-least-32-chars-long');
    const attackerService = new TokenService('completely-different-secret-key-32-chars-long');

    const forgedToken = attackerService.signAccessToken({
      userId: sampleUserId,
      username: sampleUsername,
    });

    assert.throws(
      () => {
        customService.verifyAccessToken(forgedToken);
      },
      (err: unknown) => {
        assert.ok(err instanceof jwt.JsonWebTokenError);
        assert.equal((err as Error).message, 'invalid signature');
        return true;
      }
    );
  });

  it('5. should fail verification when token is expired', () => {
    const customService = new TokenService('secret-key-at-least-32-chars-long-for-testing');
    const expiredToken = customService.signAccessToken(
      { userId: sampleUserId, username: sampleUsername },
      { expiresIn: '-1s' }
    );

    assert.throws(
      () => {
        customService.verifyAccessToken(expiredToken);
      },
      (err: unknown) => {
        assert.ok(err instanceof jwt.TokenExpiredError);
        assert.equal((err as Error).message, 'jwt expired');
        return true;
      }
    );
  });

  it('6. should ensure password and passwordHash are not present in JWT payload', () => {
    const token = tokenService.signAccessToken({
      userId: sampleUserId,
      username: sampleUsername,
    });

    const decoded = jwt.decode(token) as Record<string, unknown>;
    assert.equal('password' in decoded, false, 'password must not be in token');
    assert.equal('passwordHash' in decoded, false, 'passwordHash must not be in token');
    assert.equal(decoded.password, undefined);
    assert.equal(decoded.passwordHash, undefined);
  });
});
