// src/startup.ts
import { Express } from 'express';
import { getLogger } from './logging';
import { initRedis } from './cache/redis';
import { initQueue, QueueType, shutdownQueues } from './queue';
import { initLoyaltyWorker } from './queue/processors/loyalty';
import { Pool } from 'pg';

// Get startup logger
const logger = getLogger().child({ _component: 'startup' });

/**
 * Initialize all application components
 * This should be called when the application starts
 */
export async function initializeApp(_app: Express, _dbPool: Pool): Promise<void> {
  try {
    logger.info('Initializing application components');

    // Initialize Redis cache if configured
    const redisClient = initRedis();
    if (redisClient) {
      logger.info('Redis cache initialized successfully');
    } else {
      logger.warn('Redis cache not initialized, caching disabled');
    }

    // Initialize job queues
    const loyaltyQueue = initQueue(QueueType.LOYALTY);
    const emailQueue = initQueue(QueueType.EMAIL);
    const reportQueue = initQueue(QueueType.REPORT);
    logger.info('Job queues initialized successfully');

    // Initialize workers for processing jobs
    const workerConcurrency = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);
    initLoyaltyWorker(workerConcurrency);

    // Set up graceful shutdown handler
    setupGracefulShutdown(app);

    logger.info('Application components initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application components', error instanceof Error ? _error : new Error(String(error)));
    throw error;
  }
}

/**
 * Set up graceful shutdown handlers
 * This ensures all resources are properly closed when the application exits
 */
function setupGracefulShutdown(_app: Express): void {
  // Handle process termination signals
  const shutdownHandler = async(_signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);

    try {
      // Close job queues
      await shutdownQueues();
      logger.info('Job queues shut down successfully');

      // Close Redis connection
      const redisClient = initRedis();
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis connection closed successfully');
      }

      // Close HTTP server (if app has a server property)
      if ((app as any).server) {
        (app as any).server.close(() => {
          logger.info('HTTP server closed successfully');
          process.exit(0);
        });
      } else {
        logger.info('Graceful shutdown complete');
        process.exit(0);
      }

      // Force exit after timeout if graceful shutdown fails
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    } catch (error) {
      logger.error('Error during graceful shutdown', error instanceof Error ? _error : new Error(String(error)));
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    shutdownHandler('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    shutdownHandler('unhandledRejection');
  });
}

/**
 * Register health checks and metrics
 * This connects the database pool to the health check routes
 */
export function registerHealthChecks(_dbPool: Pool): void {
  try {
    const healthRoutes = require('../server/routes/health');
    healthRoutes.setDbPool(dbPool);
    logger.info('Health checks registered successfully');
  } catch (error) {
    logger.error('Failed to register health checks', error instanceof Error ? _error : new Error(String(error)));
  }
}
