import { Router, RequestHandler } from 'express';
import { UserController, userController } from './user.controller';
import { IUserService } from './user.service';
import { authenticate } from '../../middlewares/auth.middleware';

/**
 * Creates an Express Router for authenticated user profile endpoints.
 *
 * @param service Optional IUserService for dependency injection / testing.
 * @param authMiddleware Optional middleware for verifying authentication.
 * @returns Express Router configured with user routes.
 */
export function createUserRouter(
  service?: IUserService,
  authMiddleware: RequestHandler = authenticate
): Router {
  const router = Router();
  const controller = service ? new UserController(service) : userController;

  /**
   * @route   GET /api/v1/users/me
   * @desc    Retrieve currently authenticated user's SafeUser profile
   * @access  Private (JWT Bearer Token)
   */
  router.get('/me', authMiddleware, controller.getMe);

  /**
   * @route   PATCH /api/v1/users/me
   * @desc    Update authenticated user's profile (displayName, username, bio)
   * @access  Private (JWT Bearer Token)
   */
  router.patch('/me', authMiddleware, controller.patchMe);

  return router;
}

const userRouter = createUserRouter();
export default userRouter;
