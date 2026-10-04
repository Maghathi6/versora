import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Check system health status
 * @access  Public
 */
router.get('/', getHealth);

export default router;
