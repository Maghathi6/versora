import { Router, RequestHandler } from 'express';
import { ProjectController, projectController } from './project.controller';
import { IProjectService } from './project.service';
import { authenticate } from '../../middlewares/auth.middleware';

/**
 * Creates an Express Router for authenticated project management endpoints.
 *
 * @param service Optional IProjectService for dependency injection / testing.
 * @param authMiddleware Optional middleware for verifying authentication.
 * @returns Express Router configured with project endpoints.
 */
export function createProjectRouter(
  service?: IProjectService,
  authMiddleware: RequestHandler = authenticate
): Router {
  const router = Router();
  const controller = service ? new ProjectController(service) : projectController;

  // All project endpoints strictly require authentication
  router.use(authMiddleware);

  /**
   * @route   POST /api/v1/projects
   * @desc    Create project for the authenticated user
   * @access  Private (JWT Bearer Token)
   */
  router.post('/', controller.create);

  /**
   * @route   GET /api/v1/projects
   * @desc    List projects owned by the authenticated user
   * @access  Private (JWT Bearer Token)
   */
  router.get('/', controller.list);

  /**
   * @route   GET /api/v1/projects/:projectId
   * @desc    Retrieve one owned project
   * @access  Private (JWT Bearer Token)
   */
  router.get('/:projectId', controller.getById);

  /**
   * @route   PATCH /api/v1/projects/:projectId
   * @desc    Update name or description of an owned project
   * @access  Private (JWT Bearer Token)
   */
  router.patch('/:projectId', controller.update);

  /**
   * @route   DELETE /api/v1/projects/:projectId
   * @desc    Delete an owned project (safe deletion policy)
   * @access  Private (JWT Bearer Token)
   */
  router.delete('/:projectId', controller.delete);

  return router;
}

const projectRouter = createProjectRouter();
export default projectRouter;
