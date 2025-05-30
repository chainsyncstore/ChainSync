import { Pool, QueryResult, PoolClient, QueryResultRow } from 'pg';
import { getLogger } from '../../src/logging';
import { AppError } from '../middleware/utils/app-error';
import { ErrorCategory, ErrorCode } from '../middleware/types/error';

// Type definitions to improve type safety
type PostgresError = {
  code: string;
  message: string;
  detail?: string;
  hint?: string;
  position?: string;
  internalPosition?: string;
  internalQuery?: string;
  where?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
};

// Define better client type handling
// Custom type that makes the PoolClient methods more explicit
interface TransactionClient extends PoolClient {
  release: (err?: Error) => void;
}

type DatabaseClient = Pool | TransactionClient;

const logger = getLogger().child({ component: 'secure-db' });

/**
 * SecureDB - A wrapper around the PostgreSQL client that enforces secure database practices
 * 
 * Features:
 * 1. Always uses parameterized queries to prevent SQL injection
 * 2. Validates inputs before executing queries
 * 3. Provides comprehensive logging for debugging and security monitoring
 * 4. Implements robust error handling with informative error messages
 */
export class SecureDB {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Execute a parameterized query safely
   * 
   * @param text SQL query with placeholders
   * @param params Parameters to bind to the query
   * @returns Query result
   */
  async query<T extends QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    try {
      // Validate query before execution
      this.validateQuery(text);
      
      // Log query for debugging (sanitized)
      this.logQuery(text, params);
      
      // Execute the query with parameters
      const result = await this.pool.query<T>(text, params);
      
      return result;
    } catch (error: unknown) {
      // Enhanced error handling with proper context
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Database query error', { 
        error: errorMessage,
        query: this.sanitizeQuery(text),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Translate database errors to application errors
      throw this.handleDatabaseError(error, text);
    }
  }

  /**
   * Execute a single-row query, returning the first row or null if no rows found
   * 
   * @param text SQL query with placeholders
   * @param params Parameters to bind to the query
   * @returns First row or null
   */
  async queryOne<T extends QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Validate the query for security concerns
   * 
   * @param query SQL query to validate
   */
  private validateQuery(query: string): void {
    // Check for common SQL injection patterns
    const dangerousPatterns = [
      /;\s*DROP\s+TABLE/i,
      /;\s*DELETE\s+FROM/i,
      /;\s*UPDATE\s+.*\s*SET/i,
      /EXECUTE\s+IMMEDIATE/i,
      /EXEC\s+\(/i,
      /xp_cmdshell/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        logger.warn('Potentially dangerous SQL pattern detected', { 
          pattern: pattern.toString(),
          query: this.sanitizeQuery(query)
        });
        
        throw new AppError(
          'Invalid SQL query detected',
          ErrorCode.BAD_REQUEST,
          ErrorCategory.VALIDATION,
          { reason: 'Security policy violation' }
        );
      }
    }
    
    // Ensure queries don't contain concatenated parameters 
    // (which could indicate a failure to use parameterized queries)
    if (/'\s*\+\s*|"\s*\+\s*/.test(query)) {
      logger.warn('String concatenation in SQL query detected', { 
        query: this.sanitizeQuery(query)
      });
      
      throw new AppError(
        'Invalid SQL query structure',
        ErrorCode.BAD_REQUEST,
        ErrorCategory.VALIDATION,
        { reason: 'String concatenation not allowed' }
      );
    }
  }

  /**
   * Handle database errors and translate them to application errors
   * 
   * @param error Original database error
   * @param query The SQL query that caused the error
   * @returns Application error
   */
  private handleDatabaseError(error: unknown, query: string): AppError {
    // Type guard for PostgreSQL errors
    const isPostgresError = (err: unknown): err is PostgresError => {
      return err !== null && typeof err === 'object' && 'code' in err;
    };
    
    // Apply the type guard to the error
    if (!isPostgresError(error)) {
      return new AppError(
        'Database error occurred',
        ErrorCode.DATABASE_ERROR,
        ErrorCategory.DATABASE,
        { query: this.sanitizeQuery(query) }
      );
    }
    // Unique constraint violation
    if (error.code === '23505') {
      return new AppError(
        'Resource already exists',
        ErrorCode.DUPLICATE_RECORD,
        ErrorCategory.VALIDATION,
        { detail: error.detail }
      );
    }
    
    // Foreign key constraint violation
    if (error.code === '23503') {
      return new AppError(
        'Referenced resource does not exist',
        ErrorCode.FOREIGN_KEY_VIOLATION,
        ErrorCategory.VALIDATION,
        { detail: error.detail }
      );
    }
    
    // Not null constraint violation
    if (error.code === '23502') {
      return new AppError(
        'Required field missing',
        ErrorCode.NOT_NULL_VIOLATION,
        ErrorCategory.VALIDATION,
        { detail: error.detail }
      );
    }
    
    // Connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new AppError(
        'Database connection error',
        ErrorCode.INTERNAL_ERROR,
        ErrorCategory.SYSTEM,
        { reason: 'Could not connect to database' }
      );
    }
    
    // Default database error
    return new AppError(
      error.message || 'Database error occurred',
      ErrorCode.DATABASE_ERROR,
      ErrorCategory.DATABASE,
      { query: this.sanitizeQuery(query) }
    );
  }
  
  /**
   * Sanitize a query for logging (removes sensitive data)
   * 
   * @param query SQL query to sanitize
   * @returns Sanitized query
   */
  private sanitizeQuery(query: string): string {
    // Simple sanitization - mask potentially sensitive data
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/password\s*=\s*"[^"]*"/gi, 'password="***"')
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/token\s*=\s*"[^"]*"/gi, 'token="***"')
      .replace(/secret\s*=\s*'[^']*'/gi, "secret='***'")
      .replace(/secret\s*=\s*"[^"]*"/gi, 'secret="***"');
  }

  /**
   * Log a query with sanitized parameters
   * 
   * @param query SQL query
   * @param params Query parameters
   */
  private logQuery(query: string, params: unknown[]): void {
    // Only log in development or when debug is enabled
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_SQL === 'true') {
      logger.debug('Executing SQL query', {
        query: this.sanitizeQuery(query),
        paramCount: params.length
      });
    }
  }

  /**
   * Begin a database transaction
   * 
   * @returns Transaction object
   */
  async beginTransaction(): Promise<SecureTransaction> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return new SecureTransaction(client);
  }

  /**
   * Sanitize parameters for safe serialization and logging
   * 
   * @param params Query parameters
   * @returns Sanitized parameters
   */
  private sanitizeParams(params: unknown[]): unknown[] {
    // Clone and sanitize sensitive data
    return params.map(param => {
      if (typeof param === 'string' && 
          (param.length > 100 || 
           /password|token|secret|key/i.test(param))) {
        return '***';
      }
      return param;
    });
  }
}

/**
 * SecureTransaction - Handles database transactions securely
 */
export class SecureTransaction {
  private client: DatabaseClient;
  private committed: boolean = false;
  private rolledBack: boolean = false;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  /**
   * Execute a parameterized query within the transaction
   * 
   * @param text SQL query with placeholders
   * @param params Parameters to bind to the query
   * @returns Query result
   */
  async query<T extends QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    if (this.committed || this.rolledBack) {
      throw new AppError(
        'Transaction already completed',
        ErrorCode.INTERNAL_ERROR,
        ErrorCategory.SYSTEM,
        { committed: this.committed, rolledBack: this.rolledBack }
      );
    }
    
    try {
      return await this.client.query<T>(text, params);
    } catch (error: unknown) {
      // Auto rollback on error
      await this.rollback();
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Commit the transaction
   */
  async commit(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new AppError(
        'Transaction already completed',
        ErrorCode.INTERNAL_ERROR,
        ErrorCategory.SYSTEM,
        { committed: this.committed, rolledBack: this.rolledBack }
      );
    }
    
    try {
      await this.client.query('COMMIT');
      this.committed = true;
    } finally {
      // Use type guard to check if client has release method
      if ('release' in this.client && typeof this.client.release === 'function') {
        this.client.release();
      }
    }
  }

  /**
   * Rollback the transaction
   */
  async rollback(): Promise<void> {
    if (this.committed || this.rolledBack) {
      return;
    }
    
    try {
      await this.client.query('ROLLBACK');
      this.rolledBack = true;
    } finally {
      // Use type guard to check if client has release method
      if ('release' in this.client && typeof this.client.release === 'function') {
        this.client.release();
      }
    }
  }
}

// Create a singleton instance with the default database pool
let secureDbInstance: SecureDB | null = null;

/**
 * Get the SecureDB instance
 * 
 * @param pool Optional database pool to use
 * @returns SecureDB instance
 */
export function getSecureDb(pool?: Pool): SecureDB {
  if (!secureDbInstance || pool) {
    secureDbInstance = new SecureDB(pool || new Pool());
  }
  return secureDbInstance;
}
