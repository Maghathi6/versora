import { Router } from 'express';
import { workflowController, WorkflowController } from './workflow.controller';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';

export const projectWorkflowRouter = (
  ctrl: WorkflowController = workflowController,
  auth = createAuthMiddleware()
): Router => {
  const router = Router({ mergeParams: true });

  // All workflow routes require authentication
  router.use(auth);

  // Unified Project Dashboard
  router.get('/:projectId/dashboard', ctrl.getDashboard);

  // Omni Project Search (artifacts, tasks, reviews, commits)
  router.get('/:projectId/search', ctrl.search);

  // 360-degree Workflow Context (change-to-review impact & linkages)
  router.get('/:projectId/workflow/context', ctrl.getContext);

  return router;
};

export default projectWorkflowRouter();
