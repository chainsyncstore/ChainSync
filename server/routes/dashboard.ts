// server/routes/dashboard.ts
import express from 'express';
import type { Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { getPool } from '../../db/pool.js';
import { getLogger } from '../../src/logging/index.js';

const router = express.Router();
const logger = getLogger().child({ _component: 'dashboard' });

/**
 * GET /api/dashboard/quick-stats
 * Get quick statistics for the dashboard
 */
router.get('/quick-stats', async(_req: Request, _res: Response): Promise<void> => {
  try {
    const dbPool = getPool();
    if (!dbPool) {
      res.status(500).json({ _error: 'Database connection not available' });
      return;
    }

    // Mock data for now - in a real application, you would query the database
    const mockData = {
      _salesTotal: '125,430.50',
      _salesChange: '+12.5%',
      _transactionsCount: 1247,
      _transactionsChange: '+8.3%',
      _lowStockCount: 23,
      _lowStockChange: -5,
      _activeStoresCount: 8,
      _totalStoresCount: 10
    };

    res.json(mockData);
  } catch (_error: any) {
    logger.error('Error fetching quick stats', error);
    res.status(500).json({
      _error: 'Failed to fetch dashboard statistics',
      _details: error.message
    });
  }
});

export default router;
