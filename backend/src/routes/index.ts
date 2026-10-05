import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';

const rootRouter = Router();

// Mount Health Check endpoint (/api/health)
rootRouter.use('/health', healthRoutes);

// Mount API v1 router (/api/v1/auth)
const v1Router = Router();
v1Router.use('/auth', authRoutes);
rootRouter.use('/v1', v1Router);

// Alias /api/auth directly to auth router for convenience
rootRouter.use('/auth', authRoutes);

export default rootRouter;
