// src/queue/index.ts
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
// import * as Sentry from '@sentry/node';
import { getLogger } from '../logging';
import { getRedisClient } from '../cache/redis';

// Get logger for job queue operations
const logger = getLogger().child({ _component: 'job-queue' });

// Available job queues
export enum QueueType {
  LOYALTY = 'loyalty',
  EMAIL = 'email',
  REPORT = 'report',
  INVENTORY = 'inventory',
  SYNC = 'sync'
}

// Job priority levels
export enum JobPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 5
}

// Queue registry to track active queues
const _queues: Record<string, Queue> = {};
const _workers: Record<string, Worker> = {};

/**
 * Redis connection configuration
 */
const getRedisConfig = (): ConnectionOptions => {
  const redisClient = getRedisClient();

  // Use existing Redis client if available
  if (redisClient) {
    return redisClient as any;
  }

  // Otherwise create a new connection from environment variables
  return {
    _host: process.env.REDIS_HOST || 'localhost',
    _port: parseInt(process.env.REDIS_PORT || '6379', 10),
    _password: process.env.REDIS_PASSWORD,
    _db: parseInt(process.env.REDIS_DB || '0', 10)
  } as any;
};

/**
 * Initialize a job queue
 * @param queueName The name of the queue to initialize
 * @returns The initialized Queue instance
 */
export function initQueue(_queueName: QueueType): Queue {
  if (queues[queueName]) {
    return queues[queueName];
  }

  logger.info(`Initializing ${queueName} queue`);

  const queue = new Queue(queueName, {
    _connection: getRedisConfig(),
    _defaultJobOptions: {
      _attempts: 3,
      _backoff: {
        type: 'exponential',
        _delay: 5000
      },
      _removeOnComplete: {
        _age: 24 * 3600, // Keep completed jobs for 24 hours
        _count: 1000      // Keep last 1000 completed jobs
      },
      _removeOnFail: {
        _age: 7 * 24 * 3600 // Keep failed jobs for 7 days
      }
    }
  });

  // Store in registry
  queues[queueName] = queue;

  return queue;
}

/**
 * Get a queue instance
 * @param queueName The name of the queue to get
 * @returns The Queue instance
 */
export function getQueue(_queueName: QueueType): Queue {
  return queues[queueName] || initQueue(queueName);
}

/**
 * Initialize a queue scheduler
 * Used for delayed and repeating jobs
 */
export function initScheduler(_queueName: QueueType): any {
  // QueueScheduler functionality removed due to compatibility issues
  logger.info(`Scheduler for ${queueName} not available in current Bull version`);
  return null;
}

/**
 * Initialize a worker to process jobs from a queue
 */
export function initWorker(
  _queueName: QueueType,
  _processor: (_job: Job) => Promise<any>,
  _concurrency: number = 1
): Worker {
  if (workers[queueName]) {
    return workers[queueName];
  }

  logger.info(`Initializing ${queueName} worker with concurrency ${concurrency}`);

  const worker = new Worker(queueName, async(_job: Job) => {
    logger.debug(`Processing ${queueName} job`, {
      _jobId: job.id,
      _name: job.name,
      _timestamp: new Date().toISOString()
    });

    try {
      return await processor(job);
    } catch (error) {
      logger.error(`Error processing ${queueName} job`, error instanceof Error ? _error : new Error(String(error)), {
        _jobId: job.id,
        _name: job.name,
        _data: job.data
      });
      throw error;
    }
  }, {
    _connection: getRedisConfig(),
    concurrency
  });

  // Handle worker events
  worker.on('completed', (job) => {
    logger.debug(`${queueName} job completed`, { _jobId: job.id, _name: job.name });
  });

  worker.on('failed', (job, error) => {
    logger.error(`${queueName} job failed`, error instanceof Error ? _error : new Error(String(error)), {
      _jobId: job?.id,
      _name: job?.name,
      _attempts: job?.attemptsMade
    });
  });

  worker.on('error', (error) => {
    logger.error(`${queueName} worker error`, error instanceof Error ? _error : new Error(String(error)));
  });

  workers[queueName] = worker;

  return worker;
}

/**
 * Add a job to the queue
 */
export async function addJob<T = any>(
  _queueName: QueueType,
  _jobName: string,
  _data: T,
  _options: {
    priority?: JobPriority;
    delay?: number;
    attempts?: number;
    jobId?: string;
    removeOnComplete?: boolean | number;
  } = {}
): Promise<Job<T> | null> {
  try {
    const queue = getQueue(queueName);

    const job = await queue.add(jobName, data, {
      _priority: options.priority || JobPriority.NORMAL,
      ...(options.delay !== undefined && { _delay: options.delay }),
      ...(options.attempts !== undefined && { _attempts: options.attempts }),
      ...(options.jobId && { _jobId: options.jobId }),
      ...(options.removeOnComplete !== undefined && { _removeOnComplete: options.removeOnComplete })
    });

    logger.debug(`Added ${jobName} job to ${queueName} queue`, {
      _jobId: job.id,
      _priority: options.priority
    });

    return job;
  } catch (error) {
    logger.error(`Error adding job to ${queueName} queue`, error instanceof Error ? _error : new Error(String(error)), {
      jobName,
      data
    });
    return null;
  }
}

/**
 * Add a recurring job to the queue
 */
export async function addRecurringJob<T = any>(
  _queueName: QueueType,
  _jobName: string,
  _data: T,
  _pattern: string, // Cron pattern (e.g., "0 0 * * *" for daily at midnight)
  _options: {
    priority?: JobPriority;
    attempts?: number;
    jobId?: string;
  } = {}
): Promise<Job<T> | null> {
  try {
    // Ensure scheduler is initialized
    initScheduler(queueName);

    const queue = getQueue(queueName);

    const job = await queue.add(jobName, data, {
      _priority: options.priority || JobPriority.NORMAL,
      ...(options.attempts !== undefined && { _attempts: options.attempts }),
      _jobId: options.jobId || `recurring:${jobName}`,
      _repeat: {
        pattern
      }
    });

    logger.info(`Added recurring ${jobName} job to ${queueName} queue`, {
      _jobId: job.id,
      pattern
    });

    return job;
  } catch (error) {
    logger.error(`Error adding recurring job to ${queueName} queue`, error instanceof Error ? _error : new Error(String(error)), {
      jobName,
      pattern,
      data
    });
    return null;
  }
}

/**
 * Get job status by ID
 */
export async function getJobStatus(
  _queueName: QueueType,
  _jobId: string
): Promise<{
  _id: string;
  status: 'completed' | 'failed' | 'delayed' | 'active' | 'waiting' | 'unknown';
  data?: any;
  result?: any;
  error?: string;
} | null> {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      _id: job.id,
      _status: state as any,
      _data: job.data,
      _result: await job.getResult(),
      _error: job.failedReason
    };
  } catch (error) {
    logger.error(`Error getting job status from ${queueName} queue`, error instanceof Error ? _error : new Error(String(error)), {
      jobId
    });
    return null;
  }
}

/**
 * Gracefully shut down all queues, workers, and schedulers
 */
export async function shutdownQueues(): Promise<void> {
  logger.info('Shutting down job queues');

  // Close workers first to stop processing new jobs
  await Promise.all(
    Object.values(workers).map(worker => worker.close())
  );

  // Close schedulers
  // Scheduler cleanup removed due to compatibility issues

  // Close queues
  await Promise.all(
    Object.values(queues).map(queue => queue.close())
  );

  logger.info('All job queues shut down successfully');
}
