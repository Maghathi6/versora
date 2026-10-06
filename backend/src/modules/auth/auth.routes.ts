import { Router } from 'express';
import { AuthController, authController } from './auth.controller';
import { IAuthService } from './auth.service';

/**
 * Creates an Express Router for authentication endpoints.
 *
 * @param service Optional IAuthService for dependency injection / testing.
 * @returns Express Router configured with auth routes.
 */
export function createAuthRouter(service?: IAuthService): Router {
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
   * @desc    Authenticate user and retrieve safe user details
   * @access  Public
   */
  router.post('/login', controller.login);

  return router;
}

const authRouter = createAuthRouter();
export default authRouter;
