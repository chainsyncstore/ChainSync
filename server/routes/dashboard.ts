// server/routes/dashboard.ts
import express from 'express';
import type { Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { getPool } from '../../db/pool.js';
import { getLogger } from '../../src/logging/index.js';

const router = express.Router();
const logger = getLogger().child({ component: 'dashboard' });

/**
 * GET /api/dashboard/quick-stats
 * Get quick statistics for the dashboard
 */
router.get('/quick-stats', async (req: Request, res: Response) => {
  try {
    const dbPool = getPool();
    if (!dbPool) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    // Mock data for now - in a real application, you would query the database
    const mockData = {
      salesTotal: '125,430.50',
      salesChange: '+12.5%',
      transactionsCount: 1247,
      transactionsChange: '+8.3%',
      lowStockCount: 23,
      lowStockChange: -5,
      activeStoresCount: 8,
      totalStoresCount: 10
    };

    res.json(mockData);
  } catch (error: any) {
    logger.error('Error fetching quick stats', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      details: error.message 
    });
  }
});

export default router; 