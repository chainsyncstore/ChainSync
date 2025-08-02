/**
 * Enhanced Base Service
 *
 * An extended base service class that provides consistent patterns for
 * database operations, error handling, and result formatting across services.
 */
import { BaseService } from './service';
import db from '@server/database';
import { sql } from 'drizzle-orm';
import { ZodSchema } from 'zod';
import { ErrorCode } from '@shared/types/errors';
import { ServiceErrorHandler } from '@shared/utils/service-helpers';
import {
  buildInsertQuery,
  buildUpdateQuery,
  buildRawInsertQuery,
  buildRawUpdateQuery,
  prepareSqlValues
} from '@shared/utils/sql-helpers';

export abstract class EnhancedBaseService extends BaseService {
  /**
   * Execute a SQL query and format the first result
   *
   * @param query The SQL query string
   * @param params Query parameters
   * @param formatter Function to format the result
   * @returns Formatted result or null
   */
  protected async executeSqlWithFormatting<T>(
    _query: string,
    _params: any[] = [],
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const result = await db.execute(sql.raw(query), params);
      const row = result.rows?.[0] || null;
      return row ? formatter(row) : null;
    } catch (error) {
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
    _query: string,
    _params: any[] = [],
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T[]> {
    try {
      const result = await db.execute(sql.raw(query), params);
      const rows = result.rows || [];
      return rows.map((_row: any) => formatter(row));
    } catch (error) {
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
    _tableName: string,
    _data: Record<string, any>,
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const { query, values } = buildInsertQuery(tableName, data);
      return await this.executeSqlWithFormatting(query, values, formatter);
    } catch (error) {
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
    _tableName: string,
    _data: Record<string, any>,
    _whereCondition: string,
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const { query, values } = buildUpdateQuery(tableName, data, whereCondition);
      return await this.executeSqlWithFormatting(query, values, formatter);
    } catch (error) {
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
    _tableName: string,
    _data: Record<string, any>,
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const preparedData = prepareSqlValues(data);
      const query = buildRawInsertQuery(tableName, preparedData);
      return await this.executeSqlWithFormatting(query, [], formatter);
    } catch (error) {
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
    _tableName: string,
    _data: Record<string, any>,
    _whereCondition: string,
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    try {
      const preparedData = prepareSqlValues(data);
      const query = buildRawUpdateQuery(tableName, preparedData, whereCondition);
      return await this.executeSqlWithFormatting(query, [], formatter);
    } catch (error) {
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
    _data: T,
    _validator: ZodSchema<U>,
    _preparer: (_data: U) => Record<string, any>
  ): Record<string, any> {
    try {
      const validatedData = validator.parse(data);
      return preparer(validatedData);
    } catch (error) {
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
  protected handleError(_error: any, _operation: string): never {
    throw ServiceErrorHandler.handleError(error, operation);
  }

  /**
   * Check if a result exists, throw a NOT_FOUND error if not
   *
   * @param result The result to check
   * @param entityName Name of the entity being checked
   * @returns The result if it exists
   */
  protected ensureExists<T>(_result: T | null | undefined, _entityName: string): T {
    return ServiceErrorHandler.ensureExists(result, entityName);
  }
}
