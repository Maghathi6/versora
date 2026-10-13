import { Router } from 'express';
import { GitHubController, githubController } from './github.controller';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { IUserRepository, userRepository } from '../users/user.repository';
import { TokenService, tokenService } from '../auth/token.service';

export function createGitHubOAuthRouter(
  controller: GitHubController = githubController,
  userRepo: IUserRepository = userRepository,
  tokenSvc: TokenService = tokenService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware({ userRepo, tokenSvc });

  // OAuth status and control
  router.get('/status', requireAuth, controller.getOAuthStatus);
  router.get('/authorize', requireAuth, controller.authorize);
  router.get('/callback', controller.callback); // Public callback endpoint from GitHub
  router.delete('/disconnect', requireAuth, controller.disconnect);

  return router;
}

export function createProjectGitHubRouter(
  controller: GitHubController = githubController,
  userRepo: IUserRepository = userRepository,
  tokenSvc: TokenService = tokenService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware({ userRepo, tokenSvc });

  // Remote configuration and Git operations
  router.get('/:projectId/github/status', requireAuth, controller.getRemoteStatus);
  router.post('/:projectId/github/publish', requireAuth, controller.publish);
  router.post('/:projectId/github/link', requireAuth, controller.link);
  router.delete('/:projectId/github/unlink', requireAuth, controller.unlink);
  router.post('/:projectId/github/fetch', requireAuth, controller.fetch);
  router.post('/:projectId/github/push', requireAuth, controller.push);
  router.post('/:projectId/github/pull', requireAuth, controller.pull);

  return router;
}

export const githubOAuthRouter = createGitHubOAuthRouter();
export const projectGitHubRouter = createProjectGitHubRouter();
