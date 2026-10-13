import { Router, RequestHandler } from 'express';
import { GitController, gitController } from './git.controller';
import { IGitService } from './git.service';
import { authenticate } from '../../middlewares/auth.middleware';

export function createGitRouter(
  service?: IGitService,
  authMiddleware: RequestHandler = authenticate
): Router {
  const router = Router();
  const ctrl = service ? new GitController(service) : gitController;

  // Protect all Git endpoints with JWT authentication
  router.use(authMiddleware);

  // Initialize Git repository for project
  router.post('/:projectId/git/init', ctrl.init);

  // Status and Diffs
  router.get('/:projectId/git/status', ctrl.getStatus);
  router.get('/:projectId/git/diff', ctrl.getDiff);

  // Commit changes (Save Version)
  router.post('/:projectId/git/commit', ctrl.commit);

  // History and Commit details
  router.get('/:projectId/git/history', ctrl.getHistory);
  router.get('/:projectId/git/commits/:commitHash', ctrl.getCommit);

  // Branches
  router.get('/:projectId/git/branches', ctrl.listBranches);
  router.post('/:projectId/git/branches', ctrl.createBranch);
  router.post('/:projectId/git/branches/switch', ctrl.switchBranch);

  // Restoration
  router.post('/:projectId/git/restore/preview', ctrl.previewRestore);
  router.post('/:projectId/git/restore', ctrl.restore);

  return router;
}

export default createGitRouter();
