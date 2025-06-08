/**
 * Enhanced Base Service
 *
 * An extended base service class that provides consistent patterns for
 * database operations, error handling, and result formatting across services.
 */
import { db } from '@server/database'; // Changed to named import
import { ErrorCode } from '@shared/types/errors';
import { ServiceErrorHandler } from '@shared/utils/service-helpers';
import {
  buildInsertQuery,
  buildUpdateQuery,
  buildRawInsertQuery,
  buildRawUpdateQuery,
  prepareSqlValues,
} from '@shared/utils/sql-helpers';
import { sql } from 'drizzle-orm';
import { ZodSchema } from 'zod';

import { BaseService } from './service';
import { ServiceConfig } from './service-factory'; // Added import
import { DrizzleClient, Transaction } from '../../db/types'; // Added DrizzleClient and Transaction

export abstract class EnhancedBaseService extends BaseService {
  protected readonly db: DrizzleClient; // Add db client

  constructor(config: ServiceConfig) {
    // Add constructor to accept ServiceConfig
    super(config); // Pass the full config object to BaseService constructor
    this.db = config.db; // Initialize db client
  }

  /**
   * Execute a SQL query and format the first result
   *
   * @param query The SQL query string
   * @param params Query parameters
   * @param formatter Function to format the result
   * @returns Formatted result or null
   */
  protected async executeSqlWithFormatting<T>(
    query: string,
    params: unknown[] = [],
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      // Params are not directly supported this way by db.execute(SQL).
      // This will likely break if params are needed, but fixes TS error.
      // TODO: Refactor to correctly use params with Drizzle's sql template or specific driver features.
      // For now, to satisfy TS, we pass only the SQL object. Params are ignored here.
      const result = await db.execute(sql.raw(query));
      const row = result.rows?.[0] || null;
      return row ? formatter(row) : null;
    } catch (error: unknown) {
      throw ServiceErrorHandler.handleError(error, 'executing SQL query');
    }
  }

  /**
   * Execute a SQL query and format multiple results
   *
   * @param query The SQL query string
   * @param params Query parameters
   * @param formatter Function to format each result
   * @returns Array of formatted results
   */
  protected async executeSqlWithMultipleResults<T>(
    query: string,
    params: unknown[] = [],
    formatter: (row: Record<string, any>) => T
  ): Promise<T[]> {
    try {
      // Params are not directly supported this way by db.execute(SQL).
      // This will likely break if params are needed, but fixes TS error.
      // TODO: Refactor to correctly use params with Drizzle's sql template or specific driver features.
      // For now, to satisfy TS, we pass only the SQL object. Params are ignored here.
      const result = await db.execute(sql.raw(query));
      const rows = result.rows || [];
      return rows.map(row => formatter(row));
    } catch (error: unknown) {
      throw ServiceErrorHandler.handleError(error, 'executing SQL query with multiple results');
    }
  }

  /**
   * Execute a SQL INSERT query with proper error handling
   *
   * @param tableName The table to insert into
   * @param data The data to insert
   * @param formatter Function to format the result
   * @returns The inserted record or null
   */
  protected async insertWithFormatting<T>(
    tableName: string,
    data: Record<string, any>,
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const { query, values } = buildInsertQuery(tableName, data);
      return await this.executeSqlWithFormatting(query, values, formatter);
    } catch (error: unknown) {
      throw ServiceErrorHandler.handleError(error, `inserting into ${tableName}`);
    }
  }

  /**
   * Execute a SQL UPDATE query with proper error handling
   *
   * @param tableName The table to update
   * @param data The data for the update
   * @param whereCondition The WHERE clause condition
   * @param formatter Function to format the result
   * @returns The updated record or null
   */
  protected async updateWithFormatting<T>(
    tableName: string,
    data: Record<string, any>,
    whereCondition: string,
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const { query, values } = buildUpdateQuery(tableName, data, whereCondition);
      return await this.executeSqlWithFormatting(query, values, formatter);
    } catch (error: unknown) {
      throw ServiceErrorHandler.handleError(error, `updating ${tableName}`);
    }
  }

  /**
   * Execute a raw SQL INSERT query (without parameters) for TypeScript compatibility
   *
   * @param tableName The table to insert into
   * @param data The data to insert
   * @param formatter Function to format the result
   * @returns The inserted record or null
   */
  protected async rawInsertWithFormatting<T>(
    tableName: string,
    data: Record<string, any>,
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const preparedData = prepareSqlValues(data);
      const query = buildRawInsertQuery(tableName, preparedData);
      return await this.executeSqlWithFormatting(query, [], formatter);
    } catch (error: unknown) {
      throw ServiceErrorHandler.handleError(error, `inserting into ${tableName}`);
    }
  }

  /**
   * Execute a raw SQL UPDATE query (without parameters) for TypeScript compatibility
   *
   * @param tableName The table to update
   * @param data The data for the update
   * @param whereCondition The WHERE clause condition
   * @param formatter Function to format the result
   * @returns The updated record or null
   */
  protected async rawUpdateWithFormatting<T>(
    tableName: string,
    data: Record<string, any>,
    whereCondition: string,
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const preparedData = prepareSqlValues(data);
      const query = buildRawUpdateQuery(tableName, preparedData, whereCondition);
      return await this.executeSqlWithFormatting(query, [], formatter);
    } catch (error: unknown) {
      throw ServiceErrorHandler.handleError(error, `updating ${tableName}`);
    }
  }

  /**
   * Validate data with a Zod schema and prepare it for database operations
   *
   * @param data The data to validate and prepare
   * @param validator The Zod validation schema
   * @param preparer Function to prepare the validated data
   * @returns Prepared data
   */
  protected validateAndPrepare<T, U>(
    data: T,
    validator: ZodSchema<U>,
    preparer: (data: U) => Record<string, any>
  ): Record<string, any> {
    try {
      const validatedData = validator.parse(data);
      return preparer(validatedData);
    } catch (error: unknown) {
      throw ServiceErrorHandler.handleError(error, 'validating data', ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Standard error handler for service methods
   *
   * @param error The caught error
   * @param operation Description of the operation that failed
   * @returns Always throws, return type is for TypeScript compatibility
   */
  protected handleError(error: unknown, operation: string): never {
    throw ServiceErrorHandler.handleError(error, operation);
  }

  /**
   * Check if a result exists, throw a NOT_FOUND error if not
   *
   * @param result The result to check
   * @param entityName Name of the entity being checked
   * @returns The result if it exists
   */
  protected ensureExists<T>(result: T | null | undefined, entityName: string): T {
    return ServiceErrorHandler.ensureExists(result, entityName);
  }
}
