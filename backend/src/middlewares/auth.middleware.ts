import { Request, Response, NextFunction } from 'express';
import { IUserRepository, userRepository } from '../modules/users/user.repository';
import { toSafeUser } from '../modules/users/user.types';
import { ITokenService, tokenService, TokenPayload } from '../modules/auth/token.service';
import { UnauthorizedError } from '../modules/auth/auth.errors';

export interface AuthMiddlewareOptions {
  userRepo?: IUserRepository;
  tokenSvc?: ITokenService;
}

const GENERIC_UNAUTHORIZED_MESSAGE = 'Authentication token is invalid or missing.';

/**
 * Express middleware that validates JWT access tokens in the Authorization header.
 * Confirms user existence in UserRepository and attaches SafeUser to req.user.
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  const userRepo = options.userRepo || userRepository;
  const tokenSvc = options.tokenSvc || tokenService;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedError(GENERIC_UNAUTHORIZED_MESSAGE);
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
        throw new UnauthorizedError(GENERIC_UNAUTHORIZED_MESSAGE);
      }

      const token = parts[1];
      let payload: TokenPayload;

      try {
        payload = tokenSvc.verifyAccessToken(token);
      } catch {
        // Generic failure: hides invalid signature, expired token, or malformed claims
        throw new UnauthorizedError(GENERIC_UNAUTHORIZED_MESSAGE);
      }

      // Confirm user still exists in the database
      const user = await userRepo.findById(payload.sub);
      if (!user) {
        // Generic failure: hides whether the user exists or was deleted
        throw new UnauthorizedError(GENERIC_UNAUTHORIZED_MESSAGE);
      }

      // Attach safe representation without passwordHash
      req.user = toSafeUser(user);

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthMiddleware();
