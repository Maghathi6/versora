import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { env } from '../../config/env';

/**
 * Minimal JWT Access Token Payload
 * Strictly omits sensitive credentials, passwords, and large objects.
 */
export interface TokenPayload {
  sub: string;
  username?: string;
  type?: 'access';
  iat?: number;
  exp?: number;
}

export interface ITokenService {
  signAccessToken(
    params: { userId: string; username?: string },
    options?: { expiresIn?: string }
  ): string;
  verifyAccessToken(token: string): TokenPayload;
}

export class TokenService implements ITokenService {
  private secret: Secret;
  private defaultExpiresIn: string;

  constructor(
    secret: Secret = env.JWT_SECRET,
    defaultExpiresIn: string = env.JWT_EXPIRES_IN
  ) {
    this.secret = secret;
    this.defaultExpiresIn = defaultExpiresIn;
  }

  /**
   * Generates a signed JWT access token containing only minimal user identifiers.
   * Expiration defaults to 15 minutes (or configured JWT_EXPIRES_IN).
   */
  signAccessToken(
    params: { userId: string; username?: string },
    options?: { expiresIn?: string }
  ): string {
    const payload: TokenPayload = {
      sub: params.userId,
      ...(params.username ? { username: params.username } : {}),
      type: 'access',
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: options?.expiresIn || this.defaultExpiresIn,
    } as SignOptions);
  }

  /**
   * Verifies an access token signature, checks expiration, and returns decoded claims.
   * Throws JsonWebTokenError or TokenExpiredError on verification failure.
   */
  verifyAccessToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload;

    if (!decoded.sub || typeof decoded.sub !== 'string') {
      throw new Error('Invalid token payload: missing sub claim');
    }

    return {
      sub: decoded.sub,
      username: decoded.username as string | undefined,
      type: decoded.type as 'access' | undefined,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  }
}

export const tokenService = new TokenService();
