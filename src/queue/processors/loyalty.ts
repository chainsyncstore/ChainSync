// src/queue/processors/loyalty.ts
import { getLogger } from '@shared/logging'; // Using path alias
import { AppError } from '@shared/types/errors';
import { Job } from 'bullmq';
import { Logger as PinoLoggerType } from 'pino'; // Use a different alias to avoid conflict if Logger is used elsewhere

import { getRedisClient } from '../../cache/redis';
import { initWorker, QueueType, JobPriority, addJob } from '../index';

// Get logger for loyalty job processor
const logger = getLogger().child({ component: 'loyalty-processor' });

// Supported job types
export enum LoyaltyJobType {
  PROCESS_TRANSACTION = 'process-transaction',
  APPLY_POINTS = 'apply-points',
  REVERSE_POINTS = 'reverse-points',
  CALCULATE_REWARDS = 'calculate-rewards',
  SYNC_LOYALTY_STATUS = 'sync-loyalty-status',
}

/**
 * Process loyalty points for a transaction
 */
interface ProcessTransactionData {
  transactionId: string;
  customerId: string;
  amount: number;
  storeId: string;
  transactionDate: string;
  items?: Array<{
    id: string;
    quantity: number;
    price: number;
    categoryId?: string;
  }>;
}

/**
 * Apply loyalty points to customer account
 */
interface ApplyPointsData {
  customerId: string;
  points: number;
  reason: string;
  transactionId?: string;
  expirationDate?: string;
}

/**
 * Reverse/remove loyalty points from customer account
 */
interface ReversePointsData {
  customerId: string;
  points: number;
  reason: string;
  originalTransactionId?: string;
  reverseTransactionId?: string;
}

/**
 * Calculate rewards for a customer
 */
interface CalculateRewardsData {
  customerId: string;
  checkAvailable: boolean;
}

/**
 * Sync loyalty status with external systems
 */
interface SyncLoyaltyStatusData {
  customerId: string;
  forceSync?: boolean;
}

/**
 * Process loyalty jobs
 */
async function processLoyaltyJob(job: Job): Promise<any> {
  const { name, data } = job;

  // Add correlation ID for tracking this job across systems
  const correlationId = job.id;
  const jobLogger = logger.child({ correlationId, jobType: name });

  try {
    switch (name) {
      case LoyaltyJobType.PROCESS_TRANSACTION:
        return await processTransaction(data as ProcessTransactionData, jobLogger);

      case LoyaltyJobType.APPLY_POINTS:
        return await applyLoyaltyPoints(data as ApplyPointsData, jobLogger);

      case LoyaltyJobType.REVERSE_POINTS:
        return await reverseLoyaltyPoints(data as ReversePointsData, jobLogger);

      case LoyaltyJobType.CALCULATE_REWARDS:
        return await calculateRewards(data as CalculateRewardsData, jobLogger);

      case LoyaltyJobType.SYNC_LOYALTY_STATUS:
        return await syncLoyaltyStatus(data as SyncLoyaltyStatusData, jobLogger);

      default:
        throw new Error(`Unknown loyalty job type: ${name}`);
    }
  } catch (error: unknown) {
    jobLogger.error(
      `Failed to process loyalty job`,
      error instanceof Error ? error : new Error(String(error)),
      {
        jobName: name,
        data,
      }
    );

    // Rethrow to let BullMQ handle retries
    throw error instanceof AppError
      ? error
      : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
  }
}

/**
 * Process transaction and calculate loyalty points
 */
async function processTransaction(
  data: ProcessTransactionData,
  logger: PinoLoggerType // Use the imported Pino Logger type
): Promise<{ pointsAwarded: number; newTotal: number }> {
  logger.info('Processing transaction for loyalty points', {
    transactionId: data.transactionId,
    customerId: data.customerId,
    amount: data.amount,
  });

  try {
    // Mock implementation - in production, this would call an actual service
    // const loyaltyService = getLoyaltyService();
    // const result = await loyaltyService.processTransaction(data);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate points calculation (1 point per $1 spent)
    const pointsAwarded = Math.floor(data.amount);

    // Get current points from cache or database
    const redisClient = getRedisClient();
    let currentPoints = 0;

    if (redisClient) {
      const cachedPoints = await redisClient.get(`customer:${data.customerId}:points`);
      if (cachedPoints) {
        currentPoints = parseInt(cachedPoints, 10);
      }
    }

    // Calculate new total
    const newTotal = currentPoints + pointsAwarded;

    // Update cache
    if (redisClient) {
      await redisClient.set(`customer:${data.customerId}:points`, newTotal.toString());
      // Set a short expiration to ensure DB is the source of truth
      await redisClient.expire(`customer:${data.customerId}:points`, 3600); // 1 hour TTL
    }

    logger.info('Loyalty points processed successfully', {
      transactionId: data.transactionId,
      customerId: data.customerId,
      pointsAwarded,
      newTotal,
    });

    // Check if customer is eligible for rewards after this transaction
    // Queue reward calculation job with low priority
    await addJob(
      QueueType.LOYALTY,
      LoyaltyJobType.CALCULATE_REWARDS,
      { customerId: data.customerId, checkAvailable: true },
      { priority: JobPriority.LOW, delay: 5000 }
    );

    return { pointsAwarded, newTotal };
  } catch (error: unknown) {
    logger.error(
      'Error processing transaction for loyalty points',
      error instanceof Error ? error : new Error(String(error)),
      {
        transactionId: data.transactionId,
        customerId: data.customerId,
      }
    );
    throw error instanceof AppError
      ? error
      : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
  }
}

/**
 * Apply loyalty points to a customer account
 */
async function applyLoyaltyPoints(
  data: ApplyPointsData,
  logger: PinoLoggerType // Use the imported Pino Logger type
): Promise<{ success: boolean; newTotal: number }> {
  logger.info('Applying loyalty points', {
    customerId: data.customerId,
    points: data.points,
    reason: data.reason,
  });

  try {
    // Mock implementation - in production, this would call an actual service
    // const loyaltyService = getLoyaltyService();
    // const result = await loyaltyService.applyPoints(data);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 150));

    // Get current points from cache or database
    const redisClient = getRedisClient();
    let currentPoints = 0;

    if (redisClient) {
      const cachedPoints = await redisClient.get(`customer:${data.customerId}:points`);
      if (cachedPoints) {
        currentPoints = parseInt(cachedPoints, 10);
      }
    }

    // Calculate new total
    const newTotal = currentPoints + data.points;

    // Update cache
    if (redisClient) {
      await redisClient.set(`customer:${data.customerId}:points`, newTotal.toString());
      await redisClient.expire(`customer:${data.customerId}:points`, 3600); // 1 hour TTL
    }

    logger.info('Loyalty points applied successfully', {
      customerId: data.customerId,
      pointsApplied: data.points,
      newTotal,
      reason: data.reason,
    });

    return { success: true, newTotal };
  } catch (error: unknown) {
    logger.error(
      'Error applying loyalty points',
      error instanceof Error ? error : new Error(String(error)),
      {
        customerId: data.customerId,
        points: data.points,
      }
    );
    throw error instanceof AppError
      ? error
      : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
  }
}

/**
 * Reverse/remove loyalty points from a customer account
 */
async function reverseLoyaltyPoints(
  data: ReversePointsData,
  logger: PinoLoggerType // Use the imported Pino Logger type
): Promise<{ success: boolean; newTotal: number }> {
  logger.info('Reversing loyalty points', {
    customerId: data.customerId,
    points: data.points,
    reason: data.reason,
  });

  try {
    // Mock implementation - in production, this would call an actual service
    // const loyaltyService = getLoyaltyService();
    // const result = await loyaltyService.reversePoints(data);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 150));

    // Get current points from cache or database
    const redisClient = getRedisClient();
    let currentPoints = 0;

    if (redisClient) {
      const cachedPoints = await redisClient.get(`customer:${data.customerId}:points`);
      if (cachedPoints) {
        currentPoints = parseInt(cachedPoints, 10);
      }
    }

    // Calculate new total, ensure it doesn't go below 0
    const newTotal = Math.max(0, currentPoints - data.points);

    // Update cache
    if (redisClient) {
      await redisClient.set(`customer:${data.customerId}:points`, newTotal.toString());
      await redisClient.expire(`customer:${data.customerId}:points`, 3600); // 1 hour TTL
    }

    logger.info('Loyalty points reversed successfully', {
      customerId: data.customerId,
      pointsReversed: data.points,
      newTotal,
      reason: data.reason,
    });

    return { success: true, newTotal };
  } catch (error: unknown) {
    logger.error(
      'Error reversing loyalty points',
      error instanceof Error ? error : new Error(String(error)),
      {
        customerId: data.customerId,
        points: data.points,
      }
    );
    throw error instanceof AppError
      ? error
      : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
  }
}

/**
 * Calculate rewards for a customer
 */
async function calculateRewards(
  data: CalculateRewardsData,
  logger: PinoLoggerType // Use the imported Pino Logger type
): Promise<{ availableRewards: number }> {
  logger.info('Calculating rewards for customer', {
    customerId: data.customerId,
    checkAvailable: data.checkAvailable,
  });

  try {
    // Mock implementation - in production, this would call an actual service
    // const loyaltyService = getLoyaltyService();
    // const result = await loyaltyService.calculateRewards(data);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Get current points from cache or database
    const redisClient = getRedisClient();
    let currentPoints = 0;

    if (redisClient) {
      const cachedPoints = await redisClient.get(`customer:${data.customerId}:points`);
      if (cachedPoints) {
        currentPoints = parseInt(cachedPoints, 10);
      }
    }

    // Calculate available rewards (e.g., 1 reward per 100 points)
    const availableRewards = Math.floor(currentPoints / 100);

    logger.info('Rewards calculated successfully', {
      customerId: data.customerId,
      currentPoints,
      availableRewards,
    });

    return { availableRewards };
  } catch (error: unknown) {
    logger.error(
      'Error calculating rewards',
      error instanceof Error ? error : new Error(String(error)),
      {
        customerId: data.customerId,
      }
    );
    throw error instanceof AppError
      ? error
      : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
  }
}

/**
 * Sync loyalty status with external systems
 */
async function syncLoyaltyStatus(
  data: SyncLoyaltyStatusData,
  logger: PinoLoggerType // Use the imported Pino Logger type
): Promise<{ success: boolean }> {
  logger.info('Syncing loyalty status with external systems', {
    customerId: data.customerId,
    forceSync: data.forceSync,
  });

  try {
    // Mock implementation - in production, this would call an actual service
    // const loyaltyService = getLoyaltyService();
    // const result = await loyaltyService.syncLoyaltyStatus(data);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    logger.info('Loyalty status synced successfully', {
      customerId: data.customerId,
    });

    return { success: true };
  } catch (error: unknown) {
    logger.error(
      'Error syncing loyalty status',
      error instanceof Error ? error : new Error(String(error)),
      {
        customerId: data.customerId,
      }
    );
    throw error instanceof AppError
      ? error
      : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
  }
}

/**
 * Initialize the loyalty worker
 * This should be called when the application starts
 */
export function initLoyaltyWorker(concurrency: number = 2): void {
  initWorker(QueueType.LOYALTY, processLoyaltyJob, concurrency);
  logger.info(`Loyalty worker initialized with concurrency ${concurrency}`);
}

/**
 * Queue a transaction for loyalty processing
 */
export async function queueTransactionForLoyalty(
  data: ProcessTransactionData
): Promise<Job | null> {
  return addJob(QueueType.LOYALTY, LoyaltyJobType.PROCESS_TRANSACTION, data, {
    priority: JobPriority.HIGH,
  });
}

/**
 * Queue loyalty points application
 */
export async function queueApplyLoyaltyPoints(data: ApplyPointsData): Promise<Job | null> {
  return addJob(QueueType.LOYALTY, LoyaltyJobType.APPLY_POINTS, data, {
    priority: JobPriority.NORMAL,
  });
}

/**
 * Queue loyalty points reversal
 */
export async function queueReverseLoyaltyPoints(data: ReversePointsData): Promise<Job | null> {
  return addJob(QueueType.LOYALTY, LoyaltyJobType.REVERSE_POINTS, data, {
    priority: JobPriority.HIGH,
  });
}

/**
 * Queue reward calculation
 */
export async function queueCalculateRewards(data: CalculateRewardsData): Promise<Job | null> {
  return addJob(QueueType.LOYALTY, LoyaltyJobType.CALCULATE_REWARDS, data, {
    priority: JobPriority.LOW,
  });
}

/**
 * Queue loyalty status sync
 */
export async function queueSyncLoyaltyStatus(data: SyncLoyaltyStatusData): Promise<Job | null> {
  return addJob(QueueType.LOYALTY, LoyaltyJobType.SYNC_LOYALTY_STATUS, data, {
    priority: JobPriority.LOW,
  });
}
