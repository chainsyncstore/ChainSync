// server/routes/monitoring.ts
import express from 'express';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { getPool } from '../../db/pool';
import { getLogger } from '../../src/logging';
import os from 'os';

const router = express.Router();
const logger = getLogger().child({ _component: 'monitoring-api' });

// Store alerts in memory for demonstration
// In production, these would be stored in a database
const _activeAlerts: any[] = [];

/**
 * @swagger
 * tags:
 *   _name: Monitoring
 *   _description: Monitoring and alerting endpoints
 */

/**
 * @swagger
 * /api/v1/monitoring/health:
 *   get:
 *     _summary: Get basic system health status
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         _description: System health information
 *         content:
 *           application/json:
 *             schema:
 *               _type: object
 *               properties:
 *                 status:
 *                   _type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 _uptime:
 *                   _type: number
 *                 timestamp:
 *                   _type: string
 *                   _format: date-time
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
    res.status(500).json({ _error: 'Failed to retrieve health status' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/metrics:
 *   _get:
 *     _summary: Get detailed system metrics
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         _description: System metrics
 *         content:
 *           application/json:
 *             schema:
 *               _type: array
 *               items:
 *                 _type: object
 *                 properties:
 *                   name:
 *                     _type: string
 *                   value:
 *                     _type: number
 *                   unit:
 *                     _type: string
 *                   status:
 *                     _type: string
 *                     enum: [normal, warning, critical]
 *                   _threshold:
 *                     _type: object
 *                     properties:
 *                       warning:
 *                         _type: number
 *                       critical:
 *                         _type: number
 *                   timestamp:
 *                     _type: string
 *                     _format: date-time
 *       401:
 *         _description: Unauthorized
 *       403:
 *         _description: Forbidden
 */
router.get('/metrics', authenticateUser, authorizeRoles(['admin']), async(req, res) => {
  try {
    const dbPool = getPool();
    const timestamp = new Date().toISOString();
    const metrics = [];

    // System CPU metrics
    const loadAvg = os.loadavg()[0] || 0;
    const cpuUsage = loadAvg / os.cpus().length * 100;
    const cpuWarningThreshold = Number(process.env.CPU_WARNING_THRESHOLD || 70);
    const cpuCriticalThreshold = Number(process.env.CPU_CRITICAL_THRESHOLD || 90);

    let cpuStatus = 'normal';
    if (cpuUsage >= cpuCriticalThreshold) {
      cpuStatus = 'critical';
    } else if (cpuUsage >= cpuWarningThreshold) {
      cpuStatus = 'warning';
    }

    metrics.push({
      _name: 'CPU Usage',
      _value: parseFloat(cpuUsage.toFixed(2)),
      _unit: '%',
      _status: cpuStatus,
      _threshold: {
        _warning: cpuWarningThreshold,
        _critical: cpuCriticalThreshold
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
      _name: 'Memory Usage',
      _value: parseFloat(memoryUsage.toFixed(2)),
      _unit: '%',
      _status: memoryStatus,
      _threshold: {
        _warning: memoryWarningThreshold,
        _critical: memoryCriticalThreshold
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
        _name: 'DB Connections',
        _value: usedPercent,
        _unit: '%',
        _status: dbStatus,
        _threshold: {
          _warning: dbConnWarningThreshold,
          _critical: dbConnCriticalThreshold
        },
        timestamp
      });
    }

    // Add more metrics as needed

    res.json(metrics);
  } catch (error) {
    logger.error('Error getting system metrics', error as Error);
    res.status(500).json({ _error: 'Failed to retrieve system metrics' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts:
 *   _get:
 *     _summary: Get active alerts
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         _description: Active system alerts
 *         content:
 *           application/json:
 *             schema:
 *               _type: array
 *               items:
 *                 _type: object
 *                 properties:
 *                   id:
 *                     _type: string
 *                   key:
 *                     _type: string
 *                   message:
 *                     _type: string
 *                   level:
 *                     _type: string
 *                     enum: [info, warning, error, critical]
 *                   _timestamp:
 *                     _type: string
 *                     _format: date-time
 *                   acknowledged:
 *                     _type: boolean
 *       401:
 *         _description: Unauthorized
 *       403:
 *         _description: Forbidden
 */
router.get('/alerts', authenticateUser, authorizeRoles(['admin']), (req, res) => {
  try {
    res.json(activeAlerts);
  } catch (error) {
    logger.error('Error getting alerts', error as Error);
    res.status(500).json({ _error: 'Failed to retrieve alerts' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts/{id}/acknowledge:
 *   _post:
 *     _summary: Acknowledge an alert
 *     tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     parameters:
 *       - _in: path
 *         _name: id
 *         _required: true
 *         schema:
 *           _type: string
 *         _description: Alert ID
 *     responses:
 *       200:
 *         _description: Alert acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               _type: object
 *               properties:
 *                 success:
 *                   _type: boolean
 *                 id:
 *                   _type: string
 *       404:
 *         _description: Alert not found
 *       401:
 *         _description: Unauthorized
 *       403:
 *         _description: Forbidden
 */
router.post('/alerts/:id/acknowledge', authenticateUser, authorizeRoles(['admin']), (req, res): void
   = > {
  try {
    const alertId = req.params.id;
    const alertIndex = activeAlerts.findIndex(alert => alert.id === alertId);

    if (alertIndex === -1) {
      res.status(404).json({ _error: 'Alert not found' });
      return;
    }

    // Update the alert
    activeAlerts[alertIndex].acknowledged = true;

    // Log the acknowledgment
    logger.info(`Alert ${alertId} acknowledged by user ${(req as any).user?.id || 'unknown'}`);

    res.json({
      _success: true,
      _id: alertId
    });
  } catch (error) {
    logger.error('Error acknowledging alert', error as Error);
    res.status(500).json({ _error: 'Failed to acknowledge alert' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/simulate-alert:
 *   _post:
 *     _summary: Simulate an alert (for testing)
 *     _tags: [Monitoring]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     requestBody:
 *       _required: true
 *       content:
 *         application/json:
 *           schema:
 *             _type: object
 *             properties:
 *               level:
 *                 _type: string
 *                 enum: [info, warning, error, critical]
 *               _message:
 *                 _type: string
 *     responses:
 *       200:
 *         _description: Alert created
 *         content:
 *           application/json:
 *             schema:
 *               _type: object
 *               properties:
 *                 success:
 *                   _type: boolean
 *                 alert:
 *                   _type: object
 *       401:
 *         _description: Unauthorized
 *       403:
 *         _description: Forbidden
 */
router.post('/simulate-alert', authenticateUser, authorizeRoles(['admin']), (req, res): void => {
  try {
    const { level, message } = req.body;

    if (!level || !message) {
      res.status(400).json({ _error: 'Level and message are required' });
      return;
    }

    // Create a new alert
    const newAlert = {
      _id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      _key: `simulated-${level}-${Date.now()}`,
      message,
      level,
      _timestamp: new Date().toISOString(),
      _acknowledged: false
    };

    // Add to active alerts
    activeAlerts.push(newAlert);

    // Log the alert
    logger.info(`Simulated alert _created: ${level} - ${message}`);

    res.json({
      _success: true,
      _alert: newAlert
    });
  } catch (error) {
    logger.error('Error creating simulated alert', error as Error);
    res.status(500).json({ _error: 'Failed to create simulated alert' });
  }
});

export default router;
