import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/users/user.routes';
import projectRoutes from '../modules/projects/project.routes';
import artifactRoutes from '../modules/artifacts/artifact.routes';
import gitRoutes from '../modules/git/git.routes';
import { githubOAuthRouter, projectGitHubRouter } from '../modules/github/github.routes';
import intelligenceRoutes from '../modules/intelligence/intelligence.routes';
import {
  projectCollaborationRouter,
  collaborationGlobalRouter,
} from '../modules/collaboration/collaboration.routes';

const rootRouter = Router();

// Mount Health Check endpoint (/api/health)
rootRouter.use('/health', healthRoutes);

// Mount API v1 router (/api/v1/auth, /api/v1/users, /api/v1/projects, /api/v1/github)
const v1Router = Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/projects', projectRoutes);
v1Router.use('/projects', artifactRoutes);
v1Router.use('/projects', gitRoutes);
v1Router.use('/projects', projectGitHubRouter);
v1Router.use('/projects', intelligenceRoutes);
v1Router.use('/projects', projectCollaborationRouter);
v1Router.use(collaborationGlobalRouter);
v1Router.use('/github/oauth', githubOAuthRouter);
v1Router.use('/github', githubOAuthRouter);
rootRouter.use('/v1', v1Router);

// Alias routes directly to root router for convenience
rootRouter.use('/auth', authRoutes);
rootRouter.use('/users', userRoutes);
rootRouter.use('/projects', projectRoutes);
rootRouter.use('/projects', artifactRoutes);
rootRouter.use('/projects', gitRoutes);
rootRouter.use('/projects', projectGitHubRouter);
rootRouter.use('/projects', intelligenceRoutes);
rootRouter.use('/projects', projectCollaborationRouter);
rootRouter.use(collaborationGlobalRouter);
rootRouter.use('/github/oauth', githubOAuthRouter);
rootRouter.use('/github', githubOAuthRouter);

export default rootRouter;

