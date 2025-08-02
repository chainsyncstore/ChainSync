// src/queue/processors/loyalty.ts
// import * as Sentry from '@sentry/node';
import { Job } from 'bullmq';
import { getLogger } from '../../logging';
import { initWorker, QueueType, JobPriority, addJob } from '../index';
import { getRedisClient } from '../../cache/redis';

// Get logger for loyalty job processor
const logger = getLogger().child({ _component: 'loyalty-processor' });

// Supported job types
export enum LoyaltyJobType {
  PROCESS_TRANSACTION = 'process-transaction',
  APPLY_POINTS = 'apply-points',
  REVERSE_POINTS = 'reverse-points',
  CALCULATE_REWARDS = 'calculate-rewards',
  SYNC_LOYALTY_STATUS = 'sync-loyalty-status'
}

/**
 * Process loyalty points for a transaction
 */
interface ProcessTransactionData {
  _transactionId: string;
  _customerId: string;
  _amount: number;
  _storeId: string;
  _transactionDate: string;
  items?: Array<{
    _id: string;
    _quantity: number;
    _price: number;
    categoryId?: string;
  }>;
}

/**
 * Apply loyalty points to customer account
 */
interface ApplyPointsData {
  _customerId: string;
  _points: number;
  _reason: string;
  transactionId?: string;
  expirationDate?: string;
}

/**
 * Reverse/remove loyalty points from customer account
 */
interface ReversePointsData {
  _customerId: string;
  _points: number;
  _reason: string;
  originalTransactionId?: string;
  reverseTransactionId?: string;
}

/**
 * Calculate rewards for a customer
 */
interface CalculateRewardsData {
  _customerId: string;
  _checkAvailable: boolean;
}

/**
 * Sync loyalty status with external systems
 */
interface SyncLoyaltyStatusData {
  _customerId: string;
  forceSync?: boolean;
}

/**
 * Process loyalty jobs
 */
async function processLoyaltyJob(_job: Job): Promise<any> {
  const { name, data } = job;

  // Add correlation ID for tracking this job across systems
  const correlationId = job.id;
  const jobLogger = logger.child({ correlationId, _jobType: name });

  try {
    switch (name) {
      case LoyaltyJobType._PROCESS_TRANSACTION:
        return await processTransaction(data as ProcessTransactionData, jobLogger);

      case LoyaltyJobType._APPLY_POINTS:
        return await applyLoyaltyPoints(data as ApplyPointsData, jobLogger);

      case LoyaltyJobType._REVERSE_POINTS:
        return await reverseLoyaltyPoints(data as ReversePointsData, jobLogger);

      case LoyaltyJobType._CALCULATE_REWARDS:
        return await calculateRewards(data as CalculateRewardsData, jobLogger);

      case LoyaltyJobType._SYNC_LOYALTY_STATUS:
        return await syncLoyaltyStatus(data as SyncLoyaltyStatusData, jobLogger);

      throw new Error(`Unknown loyalty job type: ${name}`);
    }
  } catch (error) {
    jobLogger.error('Failed to process loyalty job', error instanceof Error ? _error : new Error(String(error)), {
      _jobName: name,
      data
    });

    // Rethrow to let BullMQ handle retries
    throw error;
  }
}

/**
 * Process transaction and calculate loyalty points
 */
async function processTransaction(
  _data: ProcessTransactionData,
  _logger: any
): Promise<{ _pointsAwarded: number; _newTotal: number }> {
  logger.info('Processing transaction for loyalty points', {
    _transactionId: data.transactionId,
    _customerId: data.customerId,
    _amount: data.amount
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
      _transactionId: data.transactionId,
      _customerId: data.customerId,
      pointsAwarded,
      newTotal
    });

    // Check if customer is eligible for rewards after this transaction
    // Queue reward calculation job with low priority
    await addJob(
      QueueType.LOYALTY,
      LoyaltyJobType.CALCULATE_REWARDS,
      { _customerId: data.customerId, _checkAvailable: true },
      { _priority: JobPriority.LOW, _delay: 5000 }
    );

    return { pointsAwarded, newTotal };
  } catch (error) {
    logger.error('Error processing transaction for loyalty points', error instanceof Error ? _error : new Error(String(error)), {
      _transactionId: data.transactionId,
      _customerId: data.customerId
    });
    throw error;
  }
}

/**
 * Apply loyalty points to a customer account
 */
async function applyLoyaltyPoints(
  _data: ApplyPointsData,
  _logger: any
): Promise<{ _success: boolean; _newTotal: number }> {
  logger.info('Applying loyalty points', {
    _customerId: data.customerId,
    _points: data.points,
    _reason: data.reason
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
      _customerId: data.customerId,
      _pointsApplied: data.points,
      newTotal,
      _reason: data.reason
    });

    return { _success: true, newTotal };
  } catch (error) {
    logger.error('Error applying loyalty points', error instanceof Error ? _error : new Error(String(error)), {
      _customerId: data.customerId,
      _points: data.points
    });
    throw error;
  }
}

/**
 * Reverse/remove loyalty points from a customer account
 */
async function reverseLoyaltyPoints(
  _data: ReversePointsData,
  _logger: any
): Promise<{ _success: boolean; _newTotal: number }> {
  logger.info('Reversing loyalty points', {
    _customerId: data.customerId,
    _points: data.points,
    _reason: data.reason
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
      _customerId: data.customerId,
      _pointsReversed: data.points,
      newTotal,
      _reason: data.reason
    });

    return { _success: true, newTotal };
  } catch (error) {
    logger.error('Error reversing loyalty points', error instanceof Error ? _error : new Error(String(error)), {
      _customerId: data.customerId,
      _points: data.points
    });
    throw error;
  }
}

/**
 * Calculate rewards for a customer
 */
async function calculateRewards(
  _data: CalculateRewardsData,
  _logger: any
): Promise<{ _availableRewards: number }> {
  logger.info('Calculating rewards for customer', {
    _customerId: data.customerId,
    _checkAvailable: data.checkAvailable
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
      _customerId: data.customerId,
      currentPoints,
      availableRewards
    });

    return { availableRewards };
  } catch (error) {
    logger.error('Error calculating rewards', error instanceof Error ? _error : new Error(String(error)), {
      _customerId: data.customerId
    });
    throw error;
  }
}

/**
 * Sync loyalty status with external systems
 */
async function syncLoyaltyStatus(
  _data: SyncLoyaltyStatusData,
  _logger: any
): Promise<{ _success: boolean }> {
  logger.info('Syncing loyalty status with external systems', {
    _customerId: data.customerId,
    _forceSync: data.forceSync
  });

  try {
    // Mock implementation - in production, this would call an actual service
    // const loyaltyService = getLoyaltyService();
    // const result = await loyaltyService.syncLoyaltyStatus(data);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    logger.info('Loyalty status synced successfully', {
      _customerId: data.customerId
    });

    return { _success: true };
  } catch (error) {
    logger.error('Error syncing loyalty status', error instanceof Error ? _error : new Error(String(error)), {
      _customerId: data.customerId
    });
    throw error;
  }
}

/**
 * Initialize the loyalty worker
 * This should be called when the application starts
 */
export function initLoyaltyWorker(_concurrency: number = 2): void {
  initWorker(QueueType.LOYALTY, processLoyaltyJob, concurrency);
  logger.info(`Loyalty worker initialized with concurrency ${concurrency}`);
}

/**
 * Queue a transaction for loyalty processing
 */
export async function queueTransactionForLoyalty(
  _data: ProcessTransactionData
): Promise<Job | null> {
  return addJob(
    QueueType.LOYALTY,
    LoyaltyJobType.PROCESS_TRANSACTION,
    data,
    { _priority: JobPriority.HIGH }
  );
}

/**
 * Queue loyalty points application
 */
export async function queueApplyLoyaltyPoints(
  _data: ApplyPointsData
): Promise<Job | null> {
  return addJob(
    QueueType.LOYALTY,
    LoyaltyJobType.APPLY_POINTS,
    data,
    { _priority: JobPriority.NORMAL }
  );
}

/**
 * Queue loyalty points reversal
 */
export async function queueReverseLoyaltyPoints(
  _data: ReversePointsData
): Promise<Job | null> {
  return addJob(
    QueueType.LOYALTY,
    LoyaltyJobType.REVERSE_POINTS,
    data,
    { _priority: JobPriority.HIGH }
  );
}

/**
 * Queue reward calculation
 */
export async function queueCalculateRewards(
  _data: CalculateRewardsData
): Promise<Job | null> {
  return addJob(
    QueueType.LOYALTY,
    LoyaltyJobType.CALCULATE_REWARDS,
    data,
    { _priority: JobPriority.LOW }
  );
}

/**
 * Queue loyalty status sync
 */
export async function queueSyncLoyaltyStatus(
  _data: SyncLoyaltyStatusData
): Promise<Job | null> {
  return addJob(
    QueueType.LOYALTY,
    LoyaltyJobType.SYNC_LOYALTY_STATUS,
    data,
    { _priority: JobPriority.LOW }
  );
}
