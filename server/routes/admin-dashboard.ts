// server/routes/admin-dashboard.ts
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

import express from 'express';
import type { Request, Response } from 'express';

import { getPool } from '../../db/pool';
import { getRedisClient } from '../../src/cache/redis';
import { getLogger } from '../../src/logging';
import { getQueue } from '../../src/queue';
import { authenticateUser, authorizeRoles } from '../middleware/auth';

const router = express.Router();
const logger = getLogger().child({ component: 'admin-dashboard' });

// In-memory health check history for dashboard
// In production, you would use a time-series database
interface HealthRecord {
  timestamp: string;
  status: string;
  components: {
    database: { status: string; responseTime: number };
    redis: { status: string; responseTime: number };
    queue: { status: string; messageCount: number };
  };
  responseTime?: number;
}

const healthHistory: HealthRecord[] = [];

// Store up to 100 health check records
const MAX_HISTORY = 100;

// Add a health check record
function addHealthRecord(record: HealthRecord) {
  healthHistory.unshift(record);
  if (healthHistory.length > MAX_HISTORY) {
    healthHistory.pop();
  }
}

/**
 * Database health check
 */
async function checkDatabase(): Promise<{ status: string; responseTime: number; error?: string }> {
  const dbPool = getPool();
  if (!dbPool) {
    return { status: 'DOWN', responseTime: 0, error: 'Database pool not initialized' };
  }

  const startTime = performance.now();

  try {
    // Simple query to check database connection
    const result = await dbPool.query('SELECT 1');
    const responseTime = Math.round(performance.now() - startTime);

    return {
      status: 'UP',
      responseTime,
    };
  } catch (error: unknown) {
    const responseTime = Math.round(performance.now() - startTime);
    logger.error('Database health check failed', error);

    return {
      status: 'DOWN',
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Redis health check
 */
async function checkRedis(): Promise<{ status: string; responseTime: number; error?: string }> {
  const redisClient = getRedisClient();

  if (!redisClient) {
    return { status: 'DISABLED', responseTime: 0 };
  }

  const startTime = performance.now();

  try {
    // Ping Redis to check connection
    await redisClient.ping();
    const responseTime = Math.round(performance.now() - startTime);

    return {
      status: 'UP',
      responseTime,
    };
  } catch (error: unknown) {
    const responseTime = Math.round(performance.now() - startTime);
    logger.error('Redis health check failed', error);

    return {
      status: 'DOWN',
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Queue health check
 */
async function checkQueueStatus(): Promise<{
  status: string;
  messageCount: number;
  error?: string;
}> {
  try {
    // Fixed: Added explicit empty object parameter to match expected function signature
    const queue = getQueue({});

    if (!queue) {
      return { status: 'DISABLED', messageCount: 0 };
    }

    // Get queue info (this will vary based on your queue implementation)
    const queueInfo = await queue.getJobCounts();
    const messageCount = queueInfo.waiting + queueInfo.active + queueInfo.delayed;

    return {
      status: 'UP',
      messageCount,
    };
  } catch (error: unknown) {
    logger.error('Queue health check failed', error);

    return {
      status: 'DOWN',
      messageCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Dashboard HTML route - requires admin role
router.get('/', authenticateUser, authorizeRoles(['admin']), (req: Request, res: Response) => {
  try {
    // Serve the dashboard HTML page
    const dashboardPath = path.join(__dirname, '../../src/views/admin-dashboard.html');

    if (fs.existsSync(dashboardPath)) {
      res.sendFile(dashboardPath);
    } else {
      // If file doesn't exist, render inline HTML
      // @ts-ignore - Ignore TypeScript errors in the template string
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ChainSync Health Dashboard</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
          <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
        </head>
        <body class="bg-gray-100">
          <div class="container mx-auto px-4 py-8">
            <h1 class="text-3xl font-bold mb-6 text-gray-800">ChainSync Health Dashboard</h1>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <!-- Database Status -->
              <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-semibold mb-4">Database</h2>
                <div id="dbStatus" class="text-2xl font-bold mb-2">Checking...</div>
                <div id="dbResponseTime" class="text-gray-600">Response time: --</div>
              </div>
              
              <!-- Redis Status -->
              <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-semibold mb-4">Redis</h2>
                <div id="redisStatus" class="text-2xl font-bold mb-2">Checking...</div>
                <div id="redisResponseTime" class="text-gray-600">Response time: --</div>
              </div>
              
              <!-- Queue Status -->
              <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-semibold mb-4">Message Queue</h2>
                <div id="queueStatus" class="text-2xl font-bold mb-2">Checking...</div>
                <div id="queueCount" class="text-gray-600">Messages: --</div>
              </div>
            </div>
            
            <!-- System Metrics -->
            <div class="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 class="text-xl font-semibold mb-4">System Metrics</h2>
              <canvas id="metricsChart" height="100"></canvas>
            </div>
            
            <!-- Health History -->
            <div class="bg-white p-6 rounded-lg shadow-md">
              <h2 class="text-xl font-semibold mb-4">Health Check History</h2>
              <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                  <thead class="bg-gray-100">
                    <tr>
                      <th class="py-3 px-4 text-left">Time</th>
                      <th class="py-3 px-4 text-left">Status</th>
                      <th class="py-3 px-4 text-left">Database</th>
                      <th class="py-3 px-4 text-left">Redis</th>
                      <th class="py-3 px-4 text-left">Queue</th>
                    </tr>
                  </thead>
                  <tbody id="healthHistory">
                    <tr>
                      <td class="py-3 px-4" colspan="5">Loading health history...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <script>
            // Fetch current health status
            async function fetchHealthStatus() {
              try {
                const response = await fetch('/api/v1/admin/dashboard/health');
                if (response.ok) {
                  const data = await response.json();
                  updateStatusDisplay(data);
                } else {
                  console.error('Failed to fetch health status:', response.statusText);
                }
              } catch (error: unknown) {
                console.error('Error fetching health status:', error);
              }
            }
            
            // Fetch health history
            async function fetchHealthHistory() {
              try {
                const response = await fetch('/api/v1/admin/dashboard/health/history');
                if (response.ok) {
                  const data = await response.json();
                  updateHistoryTable(data);
                } else {
                  console.error('Failed to fetch health history:', response.statusText);
                }
              } catch (error: unknown) {
                console.error('Error fetching health history:', error);
              }
            }
            
            // Fetch system metrics
            async function fetchMetrics() {
              try {
                const response = await fetch('/api/v1/monitoring/metrics');
                if (response.ok) {
                  const data = await response.json();
                  updateMetricsChart(data);
                } else {
                  console.error('Failed to fetch metrics:', response.statusText);
                }
              } catch (error: unknown) {
                console.error('Error fetching metrics:', error);
              }
            }
            
            // Update the status display with health check results
            function updateStatusDisplay(data) {
              const statusColors = {
                UP: 'text-green-600',
                DOWN: 'text-red-600',
                DEGRADED: 'text-yellow-600',
                DISABLED: 'text-gray-600'
              };
              
              // Database status
              const dbStatusEl = document.getElementById('dbStatus');
              const dbResponseTimeEl = document.getElementById('dbResponseTime');
              dbStatusEl.textContent = data.components.database.status;
              dbStatusEl.className = 'text-2xl font-bold mb-2 ' + statusColors[data.components.database.status];
              dbResponseTimeEl.textContent = \`Response time: \${data.components.database.responseTime}ms\`;
              
              // Redis status
              const redisStatusEl = document.getElementById('redisStatus');
              const redisResponseTimeEl = document.getElementById('redisResponseTime');
              redisStatusEl.textContent = data.components.redis.status;
              redisStatusEl.className = 'text-2xl font-bold mb-2 ' + statusColors[data.components.redis.status];
              redisResponseTimeEl.textContent = \`Response time: \${data.components.redis.responseTime}ms\`;
              
              // Queue status
              const queueStatusEl = document.getElementById('queueStatus');
              const queueCountEl = document.getElementById('queueCount');
              queueStatusEl.textContent = data.components.queue.status;
              queueStatusEl.className = 'text-2xl font-bold mb-2 ' + statusColors[data.components.queue.status];
              queueCountEl.textContent = \`Messages: \${data.components.queue.messageCount}\`;
            }
            
            // Update the health history table
            function updateHistoryTable(data) {
              const tableBody = document.getElementById('healthHistory');
              if (!data || data.length === 0) {
                tableBody.innerHTML = '<tr><td class="py-3 px-4" colspan="5">No health history available</td></tr>';
                return;
              }
              
              tableBody.innerHTML = '';
              data.forEach(record => {
                const date = new Date(record.timestamp);
                const formattedTime = date.toLocaleTimeString();
                
                const row = document.createElement('tr');
                row.innerHTML = \`
                  <td class="py-3 px-4 border-b">\${formattedTime}</td>
                  <td class="py-3 px-4 border-b">\${record.status}</td>
                  <td class="py-3 px-4 border-b">\${record.components.database.status} (\${record.components.database.responseTime}ms)</td>
                  <td class="py-3 px-4 border-b">\${record.components.redis.status} (\${record.components.redis.responseTime}ms)</td>
                  <td class="py-3 px-4 border-b">\${record.components.queue.status} (\${record.components.queue.messageCount})</td>
                \`;
                tableBody.appendChild(row);
              });
            }
            
            // Update the metrics chart
            let metricsChart;
            function updateMetricsChart(data) {
              const ctx = document.getElementById('metricsChart').getContext('2d');
              
              // Filter to the metrics we want to display
              const memoryMetric = data.find(m => m.name === 'memory_usage');
              const cpuMetric = data.find(m => m.name === 'cpu_usage');
              const dbResponseMetric = data.find(m => m.name === 'database_response_time');
              const httpRequestsMetric = data.find(m => m.name === 'http_requests_per_minute');
              
              const metrics = [
                memoryMetric?.value || 0,
                cpuMetric?.value || 0,
                dbResponseMetric?.value || 0,
                httpRequestsMetric?.value || 0
              ];
              
              const labels = [
                'Memory Usage (%)',
                'CPU Usage (%)',
                'DB Response Time (ms)',
                'HTTP Requests/min'
              ];
              
              if (metricsChart) {
                metricsChart.destroy();
              }
              
              metricsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                  labels,
                  datasets: [{
                    label: 'Current Value',
                    data: metrics,
                    backgroundColor: [
                      'rgba(54, 162, 235, 0.5)',
                      'rgba(255, 99, 132, 0.5)',
                      'rgba(255, 206, 86, 0.5)',
                      'rgba(75, 192, 192, 0.5)'
                    ],
                    borderColor: [
                      'rgba(54, 162, 235, 1)',
                      'rgba(255, 99, 132, 1)',
                      'rgba(255, 206, 86, 1)',
                      'rgba(75, 192, 192, 1)'
                    ],
                    borderWidth: 1
                  }]
                },
                options: {
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }
              });
            }
            
            // Initial fetch
            fetchHealthStatus();
            fetchHealthHistory();
            fetchMetrics();
            
            // Set up periodic refresh
            setInterval(fetchHealthStatus, 10000);
            setInterval(fetchHealthHistory, 30000);
            setInterval(fetchMetrics, 15000);
          </script>
        </body>
        </html>
      `;

      res.send(htmlContent);
    }
  } catch (error: unknown) {
    logger.error('Error serving dashboard', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Current health status API
router.get(
  '/health',
  authenticateUser,
  authorizeRoles(['admin']),
  async (req: Request, res: Response) => {
    try {
      const startTime = performance.now();

      // Run health checks in parallel
      const [dbStatus, redisStatus, queueStatus] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkQueueStatus(),
      ]);

      // Determine overall status
      let overallStatus = 'UP';
      if (dbStatus.status === 'DOWN') {
        overallStatus = 'DOWN'; // Database is critical
      } else if (redisStatus.status === 'DOWN' || queueStatus.status === 'DOWN') {
        overallStatus = 'DEGRADED'; // Can function but with reduced capability
      }

      const responseTime = Math.round(performance.now() - startTime);

      const healthResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        components: {
          database: dbStatus,
          redis: redisStatus,
          queue: queueStatus,
        },
        responseTime,
      };

      // Add to history
      addHealthRecord(healthResult);

      res.json(healthResult);
    } catch (error: unknown) {
      logger.error('Health check error', error);
      res.status(500).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// Health check history API
router.get(
  '/health/history',
  authenticateUser,
  authorizeRoles(['admin']),
  (req: Request, res: Response) => {
    try {
      res.json(healthHistory);
    } catch (error: unknown) {
      logger.error('Error fetching health history', error);
      res.status(500).json({ error: 'Failed to retrieve health history' });
    }
  }
);

export default router;
