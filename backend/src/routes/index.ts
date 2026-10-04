import { Router } from 'express';
import healthRoutes from './health.routes';

const rootRouter = Router();

// Mount Health Check endpoint
rootRouter.use('/health', healthRoutes);

export default rootRouter;
