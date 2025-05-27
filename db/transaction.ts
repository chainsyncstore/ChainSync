import { db } from './connection-manager';
import { getLogger } from '../src/logging';
import { retry, RetryOptions } from '../server/utils/retry';
import { sql } from 'drizzle-orm';

const logger = getLogger().child({ component: 'db-transaction' });

/**
 * Options for the transactional operation
 */
export interface TransactionOptions {
  /** Maximum number of retries for transient failures */
  maxRetries?: number;
  
  /** Initial delay between retries in milliseconds */
  initialDelayMs?: number;
  
  /** Transaction name for logging purposes */
  transactionName?: string;
  
  /** Custom retry options */
  retryOptions?: RetryOptions;
  
  /** Whether to use serializable isolation level for strong consistency */
  serializable?: boolean;
  
  /** Timeout for the transaction in milliseconds */
  timeoutMs?: number;
}

/**
 * Error indicating a transaction needs to be retried
 */
export class TransactionRetryError extends Error {
  constructor(message: string, public cause?: any) {
    super(message);
    this.name = 'TransactionRetryError';
  }
}

/**
 * Error codes that indicate transient errors that can be retried
 */
const RETRYABLE_ERROR_CODES = [
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '55P03', // lock_not_available
  '55006', // object_in_use
  '57P04', // database_dropped
  '57P05', // idle_session_timeout
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '53300', // too_many_connections
  '53400', // configuration_limit_exceeded
  '57014', // query_canceled
];

/**
 * Error messages that indicate transient errors that can be retried
 */
const RETRYABLE_ERROR_MESSAGES = [
  'deadlock detected',
  'connection reset',
  'connection timeout',
  'idle session timeout',
  'canceling statement due to statement timeout',
  'failed to acquire lock',
  'could not serialize access',
  'current transaction is aborted',
  'terminating connection due to administrator command',
];

/**
 * Check if an error is a transient error that can be retried
 */
function isTransientError(error: any): boolean {
  // Check for specific PostgreSQL error codes
  if (error.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
    return true;
  }
  
  // Check for specific error messages
  const errorMessage = error.message || String(error);
  return RETRYABLE_ERROR_MESSAGES.some(msg => 
    errorMessage.toLowerCase().includes(msg.toLowerCase())
  );
}

/**
 * Execute a function within a database transaction with automatic retries
 * for transient failures
 * 
 * @param fn The function to execute within a transaction
 * @param options Transaction options
 * @returns The result of the function
 */
export async function withTransaction<T>(
  fn: (tx: typeof db) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const transactionName = options.transactionName || 'unnamed-transaction';
  
  // Set up retry options
  const retryOptions: RetryOptions = options.retryOptions || {
    maxAttempts: options.maxRetries || 3,
    initialDelayMs: options.initialDelayMs || 100,
    backoffFactor: 2,
    maxDelayMs: 2000,
    useJitter: true,
    nonRetryableErrors: [],
    operationName: `transaction:${transactionName}`,
    isRetryable: (error) => isTransientError(error),
  };
  
  // Execute with retry logic
  const result = await retry(async () => {
    // Start a transaction
    return db.transaction(async (tx) => {
      // Set transaction timeout if specified
      if (options.timeoutMs) {
        await tx.execute(sql`SET LOCAL statement_timeout = ${options.timeoutMs}`);
      }
      
      // Set isolation level to serializable if requested
      if (options.serializable) {
        await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
      }
      
      try {
        // Execute the function within the transaction
        const result = await fn(tx);
        return result;
      } catch (error) {
        // Check if it's a transient error that should be retried
        if (isTransientError(error)) {
          logger.warn(`Transaction ${transactionName} encountered transient error, will retry`, {
            error: error instanceof Error ? error.message : String(error),
            errorCode: (error as any).code,
          });
          
          // Wrap in a TransactionRetryError to signal retry
          throw new TransactionRetryError('Transaction needs to be retried', error);
        }
        
        // Re-throw non-transient errors
        throw error;
      }
    });
  }, retryOptions);
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.result as T;
}

/**
 * Execute a function with retry logic for database operations
 * that don't require a transaction
 * 
 * @param fn The database function to execute
 * @param options Retry options
 * @returns The result of the function
 */
export async function withDatabaseRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const defaultOptions: RetryOptions = {
    maxAttempts: 3,
    initialDelayMs: 100,
    backoffFactor: 2,
    maxDelayMs: 2000,
    useJitter: true,
    operationName: options.operationName || 'db-operation',
    isRetryable: (error) => isTransientError(error),
  };
  
  const retryOptions = { ...defaultOptions, ...options };
  
  const result = await retry(fn, retryOptions);
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.result as T;
}
