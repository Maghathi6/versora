import { Router, RequestHandler } from 'express';
import { AuthController, authController } from './auth.controller';
import { IAuthService } from './auth.service';
import { authenticate } from '../../middlewares/auth.middleware';

/**
 * Creates an Express Router for authentication endpoints.
 *
 * @param service Optional IAuthService for dependency injection / testing.
 * @param authMiddleware Optional middleware for verifying authentication.
 * @returns Express Router configured with auth routes.
 */
export function createAuthRouter(
  service?: IAuthService,
  authMiddleware: RequestHandler = authenticate
): Router {
  const router = Router();
  const controller = service ? new AuthController(service) : authController;

  /**
   * @route   POST /api/v1/auth/register
   * @desc    Register a new user account
   * @access  Public
   */
  router.post('/register', controller.register);

  /**
   * @route   POST /api/v1/auth/login
   * @desc    Authenticate user and retrieve token + safe user details
   * @access  Public
   */
  router.post('/login', controller.login);

  /**
   * @route   GET /api/v1/auth/me
   * @desc    Retrieve currently authenticated user profile
   * @access  Private (JWT Bearer Token)
   */
  router.get('/me', authMiddleware, controller.me);

  return router;
}

const authRouter = createAuthRouter();
export default authRouter;
