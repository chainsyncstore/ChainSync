/**
 * Standard Service Base Implementation
 *
 * This file defines the standardized base service class and related interfaces
 * that all services should extend for consistent implementation patterns.
 */

import { eq, and, sql, SQL } from 'drizzle-orm';
import { z } from 'zod';

import { ServiceConfig } from './service-factory';
import { ErrorCode, ErrorCategory } from '../../../shared/types/errors';
import { Logger } from '../../../src/logging'; // Use logger from src
import { safeToString, sqlIdentifier, sqlTemplate } from '../../db/sqlTemplateHelper';
import { DrizzleClient, Transaction } from '../../db/types';
import { ValidationHelpers } from '../../utils/zod-helpers';
import { CacheService } from '../cache/cache-service';
export type { ServiceConfig } from './service-factory';

// Drizzle ORM table type (import or define a fallback)
// If you have a Drizzle type, import it. Otherwise, define a minimal fallback:
type DrizzleTable = { name: string };

/**
 * Utility function to wrap database operations in a try/catch block
 * This helps standardize error handling across services
 */
export function withDbTryCatch<T>(
  operation: () => Promise<T>,
  errorHandler: (error: unknown) => never
): Promise<T> {
  return operation().catch(errorHandler);
}

/**
 * Standard service error class
 */
export class ServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly retryable: boolean = false,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Standard retry options
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  retryableErrors?: (string | ErrorCode)[];
}

/**
 * Standard pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Standard list response
 */
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ServiceConfig is now imported from service-factory.ts

/**
 * Standard service interface
 */
export interface IService<T, CreateDTO, UpdateDTO> {
  getById(id: string | number): Promise<T | null>;
  list(filters?: Record<string, unknown>, pagination?: PaginationOptions): Promise<ListResponse<T>>;
  create(data: CreateDTO): Promise<T>;
  update(id: string | number, data: UpdateDTO): Promise<T | null>;
  delete(id: string | number): Promise<boolean>;
}

/**
 * Base service class
 */
export abstract class BaseService<T, CreateDTO, UpdateDTO>
  implements IService<T, CreateDTO, UpdateDTO>
{
  protected readonly logger: Logger;
  protected readonly db: DrizzleClient;
  protected readonly cache?: CacheService;

  // Abstract properties that concrete services must implement
  protected abstract readonly entityName: string;
  protected abstract readonly tableName: string | DrizzleTable;
  protected abstract readonly primaryKeyField: string;
  protected abstract readonly createSchema: z.ZodType<CreateDTO>;
  protected abstract readonly updateSchema: z.ZodType<UpdateDTO>;

  /**
   * Constructor with standardized dependency injection
   */
  constructor(config: ServiceConfig) {
    this.logger = config.logger.child({ service: this.constructor.name });
    this.db = config.db;
    this.cache = config.cache;

    this.logger.info(`${this.constructor.name} initialized`);
  }

  /**
   * Get entity by ID
   */
  async getById(id: string | number): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(id);

      // Try to get from cache first if available
      if (cacheKey && this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${this.entityName}:${id}`);
          return cached as T;
        }
      }

      // Fetch from database if not in cache
      const result = await this.executeQuery(async db => {
        const tableNameStr =
          typeof this.tableName === 'string' ? this.tableName : this.tableName.name;
        // Use the safe SQL template pattern with proper type handling
        return db.execute(sql`
            SELECT * FROM ${sqlIdentifier(tableNameStr)}
            WHERE ${sqlIdentifier(this.primaryKeyField)} = ${id}
            LIMIT 1
          `);
      }, `${this.entityName}.getById`);

      // Handle QueryResult properly by treating it as Record<string, any>[] when it's an array
      const entity = Array.isArray(result) && result.length > 0 ? (result[0] as T) : null;

      // Cache the result if we have a cache service
      if (entity && cacheKey && this.cache) {
        await this.cache.set(cacheKey, entity);
      }

      return entity;
    } catch (error) {
      return this.handleError(error, `Error fetching ${this.entityName} by ID: ${id}`);
    }
  }

  /**
   * List entities with filtering and pagination
   */
  async list(
    filters: Record<string, unknown> = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<ListResponse<T>> {
    try {
      const { page, limit, sortBy, sortDirection } = pagination;
      const offset = (page - 1) * limit;

      // Build where conditions from filters
      const whereConditions = Object.entries(filters).map(([key, value]) => {
        return sql`${sql.identifier(key)} = ${this.safeToString(value)}`;
      });

      // Get total count
      const countResult = await this.executeQuery(async db => {
        // Use direct SQL execution with proper template handling
        const whereClause =
          whereConditions.length > 0 ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}` : sql``;
        const tableNameStr =
          typeof this.tableName === 'string' ? this.tableName : this.tableName.name;

        return db.execute(sql`
            SELECT COUNT(*) as count FROM ${sqlIdentifier(tableNameStr)}
            ${whereClause}
          `);
      }, `${this.entityName}.count`);

      // Extract count value from query result
      const total = Number(countResult?.rows?.[0]?.count || 0);

      // Get paginated results
      const items = await this.executeQuery(async db => {
        // Use direct SQL execution with proper template handling
        const whereClause =
          whereConditions.length > 0 ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}` : sql``;

        const orderClause = sortBy
          ? sql`ORDER BY ${sqlIdentifier(sortBy)} ${sortDirection === 'desc' ? sql`DESC` : sql`ASC`}`
          : sql``;
        const tableNameStr =
          typeof this.tableName === 'string' ? this.tableName : this.tableName.name;

        return db.execute(sql`
            SELECT * FROM ${sqlIdentifier(tableNameStr)}
            ${whereClause}
            ${orderClause}
            LIMIT ${limit} OFFSET ${offset}
          `);
      }, `${this.entityName}.list`);

      // Convert query result to proper array type
      const itemsArray = Array.isArray(items) ? items : (items as any).rows || [];

      return {
        items: itemsArray as T[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      return this.handleError(error, `Error listing ${this.entityName}`);
    }
  }

  /**
   * Create new entity
   */
  async create(data: CreateDTO): Promise<T> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, this.createSchema);

      // Insert into database
      const result = await this.executeQuery(async db => {
        const tableNameStr =
          typeof this.tableName === 'string' ? this.tableName : this.tableName.name;
        // Use direct SQL for insert
        return db.execute(sqlTemplate`
            INSERT INTO ${sqlIdentifier(tableNameStr)}
            (${sql.join(
              Object.keys(validatedData as Record<string, unknown>).map(key => sql`${key}`),
              sql`, `
            )})
            VALUES (${sql.join(
              Object.values(validatedData as Record<string, unknown>).map(val => sql`${val}`),
              sql`, `
            )})
            RETURNING *
          `);
      }, `${this.entityName}.create`);

      // Access the first row from the result, which might be nested under a 'rows' property
      // Also, ensure that result itself is not null/undefined before trying to access rows
      const entity =
        result && (result as any).rows && (result as any).rows.length > 0
          ? ((result as any).rows[0] as T)
          : Array.isArray(result) && result.length > 0
            ? (result[0] as T)
            : null;

      if (!entity) {
        throw new ServiceError(ErrorCode.DATABASE_ERROR, `Failed to create ${this.entityName}`, {
          data,
        });
      }

      // Invalidate cache for list queries
      await this.invalidateListCache();

      return entity;
    } catch (error) {
      return this.handleError(error, `Error creating ${this.entityName}`);
    }
  }

  /**
   * Update entity
   */
  async update(id: string | number, data: UpdateDTO): Promise<T | null> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, this.updateSchema);

      // Update in database
      const result = await this.executeQuery(async db => {
        // Build SET clause for update
        const setValues = Object.entries(validatedData as Record<string, unknown>).map(
          ([key, value]) => sql`${sqlIdentifier(String(key))} = ${value}`
        );
        const tableNameStr =
          typeof this.tableName === 'string' ? this.tableName : this.tableName.name;

        return db.execute(sqlTemplate`
            UPDATE ${sqlIdentifier(tableNameStr)}
            SET ${sql.join(setValues, sql`, `)}
            WHERE ${sqlIdentifier(this.primaryKeyField)} = ${id}
            RETURNING *
          `);
      }, `${this.entityName}.update`);

      // Handle QueryResult properly by treating it as Record<string, any>[] when it's an array
      const entity = Array.isArray(result) && result.length > 0 ? (result[0] as T) : null;

      if (entity) {
        // Invalidate cache for this entity
        const cacheKey = this.getCacheKey(id);
        if (cacheKey && this.cache) {
          await this.cache.del(cacheKey);
        }

        // Invalidate cache for list queries
        await this.invalidateListCache();
      }

      return entity;
    } catch (error) {
      return this.handleError(error, `Error updating ${this.entityName} with ID: ${id}`);
    }
  }

  /**
   * Delete entity
   */
  async delete(id: string | number): Promise<boolean> {
    try {
      // Delete from database
      const deleteResult = await this.executeQuery(async db => {
        const tableNameStr =
          typeof this.tableName === 'string' ? this.tableName : this.tableName.name;
        return db.execute(sql`
            DELETE FROM ${sqlIdentifier(tableNameStr)}
            WHERE ${sqlIdentifier(this.primaryKeyField)} = ${id}
            RETURNING *
          `);
      }, `${this.entityName}.delete`);

      const success = deleteResult?.rows?.length > 0;

      if (success) {
        // Invalidate cache for this entity
        const cacheKey = this.getCacheKey(id);
        if (cacheKey && this.cache) {
          await this.cache.del(cacheKey);
        }

        // Invalidate cache for list queries
        await this.invalidateListCache();
      }

      return success;
    } catch (error) {
      return this.handleError(error, `Error deleting ${this.entityName} with ID: ${id}`);
    }
  }

  /**
   * Execute a database query with error handling and tracing
   */
  protected async executeQuery<R>(
    queryFn: (db: DrizzleClient) => Promise<R>,
    queryName: string
  ): Promise<R> {
    try {
      const startTime = performance.now();
      const result = await queryFn(this.db);
      const duration = performance.now() - startTime;

      // Log slow queries
      if (duration > 1000) {
        this.logger.warn(`Slow query detected: ${queryName}`, { durationMs: duration });
      }

      return result;
    } catch (error) {
      return this.handleError(error, `Error executing query: ${queryName}`);
    }
  }

  /**
   * Create a safe SQL identifier - guards against SQL injection for dynamic table/column names
   */
  protected safeIdentifier(identifier: string): SQL<unknown> {
    // Convert to SQL template using the SQL tag to ensure proper type
    return sql`${sql.identifier(identifier)}`;
  }

  /**
   * Convert any value to a safely escaped string for SQL operations
   */
  protected safeToString(value: unknown): string {
    // Use our standardized helper
    return safeToString(value);
  }

  /**
   * Handle errors in a standardized way
   */
  protected handleError<R>(error: unknown, message: string): R {
    // Log the error
    this.logger.error(message, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Throw standardized service error
    if (error instanceof ServiceError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      throw new ServiceError(ErrorCode.VALIDATION_ERROR, `Validation error: ${message}`, {
        validationErrors: error.errors,
      });
    }

    throw new ServiceError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      message,
      error instanceof Error ? { originalError: error.message } : { originalError: String(error) }
    );
  }

  /**
   * Execute operations within a transaction
   */
  protected async withTransaction<R>(callback: (trx: Transaction) => Promise<R>): Promise<R> {
    return this.db.transaction(async trx => {
      return await callback(trx);
    });
  }

  /**
   * Execute operations with automatic retries for transient failures
   */
  protected async withRetry<R>(
    operation: () => Promise<R>,
    options: RetryOptions = {}
  ): Promise<R> {
    const { maxRetries = 3, baseDelayMs = 1000, retryableErrors = [] } = options;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        const isRetryable = this.isRetryableError(error, retryableErrors);

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        const delay = baseDelayMs * Math.pow(2, attempt);
        this.logger.info(`Retrying operation (attempt ${attempt + 1}/${maxRetries})`, { delay });
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }

    throw new ServiceError(
      ErrorCode.TEMPORARY_UNAVAILABLE,
      `Max retries (${maxRetries}) exceeded`,
      {}
    );
  }

  /**
   * Validate input data using Zod schema
   */
  protected validateInput<S>(data: unknown, schema: z.ZodType<S>): S {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ServiceError(ErrorCode.VALIDATION_ERROR, 'Validation error', {
          validationErrors: error.errors,
        });
      }
      throw error;
    }
  }

  /**
   * Check if an error is retryable
   */
  protected isRetryableError(error: unknown, retryableErrors: (string | ErrorCode)[]): boolean {
    if (error instanceof ServiceError) {
      return error.retryable || retryableErrors.includes(error.code);
    }

    // Default transient errors that can be retried
    return (
      error instanceof Error &&
      (error.message.includes('connection') ||
        error.message.includes('timeout') ||
        error.message.includes('deadlock') ||
        error.message.includes('temporarily unavailable'))
    );
  }

  /**
   * Get cache key for an entity
   */
  protected getCacheKey(id: string | number): string | null {
    if (!this.cache) return null;
    return `${this.entityName}:${id}`;
  }

  /**
   * Invalidate list cache
   */
  protected async invalidateListCache(): Promise<void> {
    if (!this.cache) return;
    await this.cache.invalidatePattern(`${this.entityName}:list:*`);
  }
}
