// src/queue/index.ts
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { getLogger } from '../logging';
import { getRedisClient } from '../cache/redis';

// Get logger for job queue operations
const logger = getLogger().child({ component: 'job-queue' });

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
const queues: Record<string, Queue> = {};
const workers: Record<string, Worker> = {};

/**
 * Redis connection configuration
 */
const getRedisConfig = (): ConnectionOptions => {
  const redisClient = getRedisClient();
  
  // Use existing Redis client if available
  if (redisClient) {
    return {
      connection: redisClient
    };
  }
  
  // Otherwise create a new connection from environment variables
  return {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10)
    }
  };
};

/**
 * Initialize a job queue
 * @param queueName The name of the queue to initialize
 * @returns The initialized Queue instance
 */
export function initQueue(queueName: QueueType): Queue {
  if (queues[queueName]) {
    return queues[queueName];
  }
  
  logger.info(`Initializing ${queueName} queue`);
  
  const queue = new Queue(queueName, {
    connection: getRedisConfig().connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000      // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600 // Keep failed jobs for 7 days
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
export function getQueue(queueName: QueueType): Queue {
  return queues[queueName] || initQueue(queueName);
}

/**
 * Initialize a queue scheduler
 * Used for delayed and repeating jobs
 */
export function initScheduler(queueName: QueueType): QueueScheduler {
  if (schedulers[queueName]) {
    return schedulers[queueName];
  }
  
  logger.info(`Initializing ${queueName} scheduler`);
  
  const scheduler = new QueueScheduler(queueName, {
    connection: getRedisConfig().connection
  });
  
  schedulers[queueName] = scheduler;
  
  return scheduler;
}

/**
 * Initialize a worker to process jobs from a queue
 */
export function initWorker(
  queueName: QueueType, 
  processor: (job: Job) => Promise<any>,
  concurrency: number = 1
): Worker {
  if (workers[queueName]) {
    return workers[queueName];
  }
  
  logger.info(`Initializing ${queueName} worker with concurrency ${concurrency}`);
  
  const worker = new Worker(queueName, async (job: Job) => {
    logger.debug(`Processing ${queueName} job`, { 
      jobId: job.id,
      name: job.name,
      timestamp: new Date().toISOString()
    });
    
    try {
      return await processor(job);
    } catch (error) {
      logger.error(`Error processing ${queueName} job`, error instanceof Error ? error : new Error(String(error)), {
        jobId: job.id,
        name: job.name,
        data: job.data
      });
      throw error;
    }
  }, {
    connection: getRedisConfig().connection,
    concurrency
  });
  
  // Handle worker events
  worker.on('completed', (job) => {
    logger.debug(`${queueName} job completed`, { jobId: job.id, name: job.name });
  });
  
  worker.on('failed', (job, error) => {
    logger.error(`${queueName} job failed`, error instanceof Error ? error : new Error(String(error)), { 
      jobId: job?.id, 
      name: job?.name,
      attempts: job?.attemptsMade
    });
  });
  
  worker.on('error', (error) => {
    logger.error(`${queueName} worker error`, error instanceof Error ? error : new Error(String(error)));
  });
  
  workers[queueName] = worker;
  
  return worker;
}

/**
 * Add a job to the queue
 */
export async function addJob<T = any>(
  queueName: QueueType,
  jobName: string,
  data: T,
  options: {
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
      priority: options.priority || JobPriority.NORMAL,
      delay: options.delay,
      attempts: options.attempts,
      jobId: options.jobId,
      removeOnComplete: options.removeOnComplete
    });
    
    logger.debug(`Added ${jobName} job to ${queueName} queue`, { 
      jobId: job.id, 
      priority: options.priority 
    });
    
    return job;
  } catch (error) {
    logger.error(`Error adding job to ${queueName} queue`, error instanceof Error ? error : new Error(String(error)), {
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
  queueName: QueueType,
  jobName: string,
  data: T,
  pattern: string, // Cron pattern (e.g., "0 0 * * *" for daily at midnight)
  options: {
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
      priority: options.priority || JobPriority.NORMAL,
      attempts: options.attempts,
      jobId: options.jobId || `recurring:${jobName}`,
      repeat: {
        pattern
      }
    });
    
    logger.info(`Added recurring ${jobName} job to ${queueName} queue`, { 
      jobId: job.id, 
      pattern 
    });
    
    return job;
  } catch (error) {
    logger.error(`Error adding recurring job to ${queueName} queue`, error instanceof Error ? error : new Error(String(error)), {
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
  queueName: QueueType,
  jobId: string
): Promise<{
  id: string;
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
      id: job.id,
      status: state as any,
      data: job.data,
      result: await job.getResult(),
      error: job.failedReason
    };
  } catch (error) {
    logger.error(`Error getting job status from ${queueName} queue`, error instanceof Error ? error : new Error(String(error)), {
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
  await Promise.all(
    Object.values(schedulers).map(scheduler => scheduler.close())
  );
  
  // Close queues
  await Promise.all(
    Object.values(queues).map(queue => queue.close())
  );
  
  logger.info('All job queues shut down successfully');
}
