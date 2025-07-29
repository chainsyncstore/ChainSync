// server/routes/monitoring.ts
import express from 'express';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { getPool } from '../../db/pool';
import { getLogger } from '../../src/logging';
import os from 'os';

const router = express.Router();
const logger = getLogger().child({ component: 'monitoring-api' });

// Store alerts in memory for demonstration
// In production, these would be stored in a database
const activeAlerts: any[] = [];

/**
 * @swagger
 * tags:
 *   name: Monitoring
 *   description: Monitoring and alerting endpoints
 */

/**
 * @swagger
 * /api/v1/monitoring/health:
 *   get:
 *     summary: Get basic system health status
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: System health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 uptime:
 *                   type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (req, res) => {
  try {
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();
    
    // Determine status based on uptime
    // This is a simple example - in a real app, you'd check various system metrics
    const status = uptime < 300 ? 'starting' : 'healthy';
    
    res.json({
      status,
      uptime,
      timestamp
    });
  } catch (error) {
    logger.error('Error getting health status', error as Error);
    res.status(500).json({ error: 'Failed to retrieve health status' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/metrics:
 *   get:
 *     summary: Get detailed system metrics
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   value:
 *                     type: number
 *                   unit:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [normal, warning, critical]
 *                   threshold:
 *                     type: object
 *                     properties:
 *                       warning:
 *                         type: number
 *                       critical:
 *                         type: number
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/metrics', authenticateUser, authorizeRoles(['admin']), async (req, res) => {
  try {
    const dbPool = getPool();
    const timestamp = new Date().toISOString();
    const metrics = [];
    
    // System CPU metrics
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const cpuWarningThreshold = Number(process.env.CPU_WARNING_THRESHOLD || 70);
    const cpuCriticalThreshold = Number(process.env.CPU_CRITICAL_THRESHOLD || 90);
    
    let cpuStatus = 'normal';
    if (cpuUsage >= cpuCriticalThreshold) {
      cpuStatus = 'critical';
    } else if (cpuUsage >= cpuWarningThreshold) {
      cpuStatus = 'warning';
    }
    
    metrics.push({
      name: 'CPU Usage',
      value: parseFloat(cpuUsage.toFixed(2)),
      unit: '%',
      status: cpuStatus,
      threshold: {
        warning: cpuWarningThreshold,
        critical: cpuCriticalThreshold
      },
      timestamp
    });
    
    // Memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    const memoryWarningThreshold = Number(process.env.MEMORY_WARNING_THRESHOLD || 75);
    const memoryCriticalThreshold = Number(process.env.MEMORY_CRITICAL_THRESHOLD || 90);
    
    let memoryStatus = 'normal';
    if (memoryUsage >= memoryCriticalThreshold) {
      memoryStatus = 'critical';
    } else if (memoryUsage >= memoryWarningThreshold) {
      memoryStatus = 'warning';
    }
    
    metrics.push({
      name: 'Memory Usage',
      value: parseFloat(memoryUsage.toFixed(2)),
      unit: '%',
      status: memoryStatus,
      threshold: {
        warning: memoryWarningThreshold,
        critical: memoryCriticalThreshold
      },
      timestamp
    });
    
    // Database connection metrics
    if (dbPool) {
      const idleCount = dbPool.idleCount;
      const totalCount = dbPool.totalCount;
      const usedPercent = Math.round((totalCount - idleCount) / totalCount * 100);
      const dbConnWarningThreshold = Number(process.env.DB_CONN_WARNING_THRESHOLD || 70);
      const dbConnCriticalThreshold = Number(process.env.DB_CONN_CRITICAL_THRESHOLD || 90);
      
      let dbStatus = 'normal';
      if (usedPercent >= dbConnCriticalThreshold) {
        dbStatus = 'critical';
      } else if (usedPercent >= dbConnWarningThreshold) {
        dbStatus = 'warning';
      }
      
      metrics.push({
        name: 'DB Connections',
        value: usedPercent,
        unit: '%',
        status: dbStatus,
        threshold: {
          warning: dbConnWarningThreshold,
          critical: dbConnCriticalThreshold
        },
        timestamp
      });
    }
    
    // Add more metrics as needed
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting system metrics', error as Error);
    res.status(500).json({ error: 'Failed to retrieve system metrics' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts:
 *   get:
 *     summary: Get active alerts
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active system alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   key:
 *                     type: string
 *                   message:
 *                     type: string
 *                   level:
 *                     type: string
 *                     enum: [info, warning, error, critical]
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   acknowledged:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/alerts', authenticateUser, authorizeRoles(['admin']), (req, res) => {
  try {
    res.json(activeAlerts);
  } catch (error) {
    logger.error('Error getting alerts', error as Error);
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts/{id}/acknowledge:
 *   post:
 *     summary: Acknowledge an alert
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 id:
 *                   type: string
 *       404:
 *         description: Alert not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/alerts/:id/acknowledge', authenticateUser, authorizeRoles(['admin']), (req, res) => {
  try {
    const alertId = req.params.id;
    const alertIndex = activeAlerts.findIndex(alert => alert.id === alertId);
    
    if (alertIndex === -1) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    // Update the alert
    activeAlerts[alertIndex].acknowledged = true;
    
    // Log the acknowledgment
    logger.info(`Alert ${alertId} acknowledged by user ${(req as any).user?.id || 'unknown'}`);
    
    res.json({
      success: true,
      id: alertId
    });
  } catch (error) {
    logger.error('Error acknowledging alert', error as Error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/simulate-alert:
 *   post:
 *     summary: Simulate an alert (for testing)
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [info, warning, error, critical]
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Alert created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 alert:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/simulate-alert', authenticateUser, authorizeRoles(['admin']), (req, res) => {
  try {
    const { level, message } = req.body;
    
    if (!level || !message) {
      return res.status(400).json({ error: 'Level and message are required' });
    }
    
    // Create a new alert
    const newAlert = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      key: `simulated-${level}-${Date.now()}`,
      message,
      level,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    // Add to active alerts
    activeAlerts.push(newAlert);
    
    // Log the alert
    logger.info(`Simulated alert created: ${level} - ${message}`);
    
    res.json({
      success: true,
      alert: newAlert
    });
  } catch (error) {
    logger.error('Error creating simulated alert', error as Error);
    res.status(500).json({ error: 'Failed to create simulated alert' });
  }
});

export default router;
