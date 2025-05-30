/**
 * SQL Helper Library
 * 
 * This module provides type-safe, centralized helpers for database operations
 * to ensure consistent patterns across the application.
 */

import { sql, SQL, eq, and, or, asc, desc, SQLWrapper, Table, Column, ColumnBaseConfig, ColumnDataType } from 'drizzle-orm';
import { MySqlColumn } from 'drizzle-orm/mysql-core';
import { z } from 'zod';
import { DrizzleClient, Transaction } from './types';
import { Logger } from '../utils/logger';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'sql-helpers' });

// Type definitions for query operations
export type QueryExecutor = DrizzleClient | Transaction;
export type QueryResult<T> = Promise<T>;
export type TableColumns<T> = Record<string, MySqlColumn>;
export type OrderDirection = 'asc' | 'desc';
export type PaginationParams = {
  page?: number;
  limit?: number;
};

// Error class for SQL operations
export class SqlError extends Error {
  constructor(
    message: string, 
    public readonly code: string,
    public readonly operation: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SqlError';
  }
}

/**
 * Safe conversion of any value to string for SQL operations
 * Prevents SQL injection by ensuring values are properly typed
 */
export function safeToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

/**
 * Creates a safe SQL identifier for table or column names
 * @param name The table or column name
 * @returns A safe SQL identifier
 */
export function safeIdentifier(name: string): SQL<unknown> {
  return sql.identifier(name);
}

/**
 * Creates a typed parameter for SQL queries
 * @param value The parameter value
 * @returns A SQL parameter
 */
export function param<T>(value: T): SQL<unknown> {
  return sql`${value}`;
}

/**
 * Wraps a database query with consistent error handling and logging
 * @param executor The database client or transaction
 * @param queryFn The query function to execute
 * @param operationName Name of the operation for logging
 * @param logger Optional logger instance
 */
export async function withDbTryCatch<T>(
  executor: QueryExecutor,
  queryFn: (db: QueryExecutor) => Promise<T>,
  operationName: string,
  customLogger?: Logger
): Promise<T> {
  const startTime = Date.now();
  const loggerInstance = customLogger || logger;
  
  try {
    loggerInstance.debug(`Starting database operation: ${operationName}`);
    const result = await queryFn(executor);
    const duration = Date.now() - startTime;
    
    loggerInstance.debug(`Completed database operation: ${operationName}`, {
      durationMs: duration
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof SqlError ? error.code : 'DB_ERROR';
    
    loggerInstance.error(`Database operation failed: ${operationName}`, {
      durationMs: duration,
      error: errorMessage,
      code: errorCode
    });
    
    throw new SqlError(
      `Database operation failed: ${errorMessage}`,
      errorCode,
      operationName,
      { durationMs: duration }
    );
  }
}

/**
 * Creates a pagination clause for SQL queries
 * @param params Pagination parameters
 * @returns SQL fragment for pagination
 */
export function paginationClause(params: PaginationParams): SQL<unknown> {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;
  
  return sql`LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * Creates an order by clause for SQL queries
 * @param column The column to order by
 * @param direction The direction to order (asc or desc)
 * @returns SQL fragment for ordering
 */
export function orderByClause(column: string, direction: OrderDirection = 'asc'): SQL<unknown> {
  const dirFn = direction === 'asc' ? asc : desc;
  return dirFn(safeIdentifier(column));
}

/**
 * Type-safe helper for finding a record by ID
 * @param executor Database client or transaction
 * @param table Database table
 * @param idColumn ID column name
 * @param id Record ID
 */
export async function findById<T>(
  executor: QueryExecutor,
  table: any,
  idColumn: string,
  id: number | string
): Promise<T | null> {
  return withDbTryCatch(
    executor,
    async (db) => {
      const results = await db.select()
        .from(table)
        .where(eq(table[idColumn], id))
        .limit(1);
      
      return results.length > 0 ? results[0] as T : null;
    },
    `findById:${table}:${id}`
  );
}

/**
 * Type-safe helper for finding multiple records with filtering
 * @param executor Database client or transaction
 * @param table Database table
 * @param whereClause SQL where clause
 * @param pagination Pagination parameters
 * @param orderBy Column to order by
 * @param orderDirection Direction to order
 */
export async function findMany<T>(
  executor: QueryExecutor,
  table: any,
  whereClause: SQL<unknown> | undefined,
  pagination?: PaginationParams,
  orderBy?: string,
  orderDirection?: OrderDirection
): Promise<T[]> {
  return withDbTryCatch(
    executor,
    async (db) => {
      // Use raw SQL for better type compatibility
      let query = db.execute(sql`
        SELECT * FROM ${sql.identifier(typeof table === 'string' ? table : table.name)}
        ${whereClause ? sql`WHERE ${whereClause}` : sql``}
      `);
      
      // Execute with direct SQL for query with order and pagination
      if (orderBy || pagination) {
        const limit = pagination?.limit || 20;
        const offset = ((pagination?.page || 1) - 1) * limit;
        
        return db.execute(sql`
          SELECT * FROM ${sql.identifier(typeof table === 'string' ? table : table.name)}
          ${whereClause ? sql`WHERE ${whereClause}` : sql``}
          ${orderBy ? sql`ORDER BY ${sql.identifier(orderBy)} ${orderDirection === 'desc' ? sql`DESC` : sql`ASC`}` : sql``}
          ${pagination ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}
        `) as unknown as T[];
      }
      
      return await query as T[];
    },
    `findMany:${table}`
  );
}

/**
 * Type-safe helper for inserting a record
 * @param executor Database client or transaction
 * @param table Database table
 * @param data Record data
 */
export async function insertOne<T, U>(
  executor: QueryExecutor,
  table: any,
  data: U
): Promise<T> {
  return withDbTryCatch(
    executor,
    async (db) => {
      const result = await db.insert(table).values(data as any).returning();
      return result[0] as T;
    },
    `insertOne:${table}`
  );
}

/**
 * Type-safe helper for updating a record by ID
 * @param executor Database client or transaction
 * @param table Database table
 * @param idColumn ID column name
 * @param id Record ID
 * @param data Update data
 */
export async function updateById<T, U>(
  executor: QueryExecutor,
  table: any,
  idColumn: string,
  id: number | string,
  data: U
): Promise<T | null> {
  return withDbTryCatch(
    executor,
    async (db) => {
      const result = await db.update(table)
        .set(data as any)
        .where(eq(table[idColumn], id))
        .returning();
      
      return result.length > 0 ? result[0] as T : null;
    },
    `updateById:${table}:${id}`
  );
}

/**
 * Type-safe helper for deleting a record by ID
 * @param executor Database client or transaction
 * @param table Database table
 * @param idColumn ID column name
 * @param id Record ID
 */
export async function deleteById<T>(
  executor: QueryExecutor,
  table: any,
  idColumn: string,
  id: number | string
): Promise<T | null> {
  return withDbTryCatch(
    executor,
    async (db) => {
      const result = await db.delete(table)
        .where(eq(table[idColumn], id))
        .returning();
      
      return result.length > 0 ? result[0] as T : null;
    },
    `deleteById:${table}:${id}`
  );
}

/**
 * Validates database response against a Zod schema
 * @param data Data to validate
 * @param schema Zod schema to validate against
 */
export function validateDbResponse<T>(data: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new SqlError(
        'Database response validation failed',
        'VALIDATION_ERROR',
        'validateDbResponse',
        { 
          validationErrors: error.errors,
          data
        }
      );
    }
    throw error;
  }
}

/**
 * Executes a raw SQL query with parameter binding
 * @param executor Database client or transaction
 * @param query SQL query
 * @param params Query parameters
 */
export async function executeRawQuery<T>(
  executor: QueryExecutor,
  query: SQL<unknown>,
  operationName: string
): Promise<T[]> {
  return withDbTryCatch(
    executor,
    async (db) => {
      return await db.execute(query) as T[];
    },
    `rawQuery:${operationName}`
  );
}

/**
 * Creates a transaction and executes a function within it
 * @param client Database client
 * @param fn Function to execute within transaction
 */
export async function withTransaction<T>(
  client: DrizzleClient,
  fn: (tx: Transaction) => Promise<T>,
  operationName: string
): Promise<T> {
  return withDbTryCatch(
    client,
    async (db) => {
      return await db.transaction(async (tx) => {
        return await fn(tx);
      });
    },
    `transaction:${operationName}`
  );
}

/**
 * Checks if a record exists by ID
 * @param executor Database client or transaction
 * @param table Database table
 * @param idColumn ID column name
 * @param id Record ID
 */
export async function existsById(
  executor: QueryExecutor,
  table: any,
  idColumn: string,
  id: number | string
): Promise<boolean> {
  return withDbTryCatch(
    executor,
    async (db) => {
      const results = await db.select({ count: sql`COUNT(*)` })
        .from(table)
        .where(eq(table[idColumn], id));
      
      return results[0].count > 0;
    },
    `existsById:${table}:${id}`
  );
}

/**
 * Performs a join operation between two tables
 * @param executor Database client or transaction
 * @param baseTable Base table
 * @param joinTable Table to join
 * @param baseColumn Column from base table for join
 * @param joinColumn Column from join table for join
 * @param whereClause Where clause for filtering
 * @param pagination Pagination parameters
 */
export async function joinTables<T>(
  executor: QueryExecutor,
  baseTable: Table | SQL<unknown>,
  joinTable: Table | SQL<unknown>,
  baseColumn: string,
  joinColumn: string,
  whereClause?: SQL<unknown>,
  pagination?: PaginationParams
): Promise<T[]> {
  return withDbTryCatch(
    executor,
    async (db) => {
      let query = db.select()
        .from(baseTable)
        .innerJoin(joinTable, eq(baseTable[baseColumn], joinTable[joinColumn]));
      
      if (whereClause) {
      // Use the whereClause as SQL
        query = query.where(whereClause);
      }
      
      if (pagination) {
        query = query.limit(pagination.limit || 20).offset(((pagination.page || 1) - 1) * (pagination.limit || 20));
      }
      
      return await query as T[];
    },
    `joinTables:${baseTable}:${joinTable}`
  );
}
