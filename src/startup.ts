// src/startup.ts
import { AppError } from '@shared/types/errors';
import { Express } from 'express';
import { Pool } from 'pg';

import { initRedis } from './cache/redis';
import { getLogger } from './logging';
import { initQueue, QueueType, shutdownQueues } from './queue';
import { initLoyaltyWorker } from './queue/processors/loyalty';

// Get startup logger
const logger = getLogger().child({ component: 'startup' });

/**
 * Initialize all application components
 * This should be called when the application starts
 */
export async function initializeApp(app: Express, dbPool: Pool): Promise<void> {
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
  } catch (error: unknown) {
    logger.error(
      'Failed to initialize application components',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error instanceof AppError
      ? error
      : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
  }
}

/**
 * Set up graceful shutdown handlers
 * This ensures all resources are properly closed when the application exits
 */
function setupGracefulShutdown(app: Express): void {
  // Handle process termination signals
  const shutdownHandler = async (signal: string) => {
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
    } catch (error: unknown) {
      logger.error(
        'Error during graceful shutdown',
        error instanceof Error ? error : new Error(String(error))
      );
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', error => {
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
export function registerHealthChecks(dbPool: Pool): void {
  try {
    const healthRoutes = require('../server/routes/health');
    healthRoutes.setDbPool(dbPool);
    logger.info('Health checks registered successfully');
  } catch (error: unknown) {
    logger.error(
      'Failed to register health checks',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
