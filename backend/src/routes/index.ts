import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/users/user.routes';
import projectRoutes from '../modules/projects/project.routes';

const rootRouter = Router();

// Mount Health Check endpoint (/api/health)
rootRouter.use('/health', healthRoutes);

// Mount API v1 router (/api/v1/auth, /api/v1/users, /api/v1/projects)
const v1Router = Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/projects', projectRoutes);
rootRouter.use('/v1', v1Router);

// Alias /api/auth, /api/users, and /api/projects directly to their routers for convenience
rootRouter.use('/auth', authRoutes);
rootRouter.use('/users', userRoutes);
rootRouter.use('/projects', projectRoutes);

export default rootRouter;

