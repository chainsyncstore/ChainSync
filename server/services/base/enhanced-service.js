'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.EnhancedBaseService = void 0;
/**
 * Enhanced Base Service
 *
 * An extended base service class that provides consistent patterns for
 * database operations, error handling, and result formatting across services.
 */
const service_1 = require('./service');
const database_1 = __importDefault(require('@server/database'));
const drizzle_orm_1 = require('drizzle-orm');
const errors_1 = require('@shared/types/errors');
const service_helpers_1 = require('@shared/utils/service-helpers');
const sql_helpers_1 = require('@shared/utils/sql-helpers');
class EnhancedBaseService extends service_1.BaseService {
  /**
     * Execute a SQL query and format the first result
     *
     * @param query The SQL query string
     * @param params Query parameters
     * @param formatter Function to format the result
     * @returns Formatted result or null
     */
  async executeSqlWithFormatting(query, params = [], formatter) {
    try {
      const result = await database_1.default.execute(drizzle_orm_1.sql.raw(query), params);
      const row = result.rows?.[0] || null;
      return row ? formatter(row) : null;
    }
    catch (error) {
      throw service_helpers_1.ServiceErrorHandler.handleError(error, 'executing SQL query');
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
  async executeSqlWithMultipleResults(query, params = [], formatter) {
    try {
      const result = await database_1.default.execute(drizzle_orm_1.sql.raw(query), params);
      const rows = result.rows || [];
      return rows.map((row) => formatter(row));
    }
    catch (error) {
      throw service_helpers_1.ServiceErrorHandler.handleError(error, 'executing SQL query with multiple results');
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
  async insertWithFormatting(tableName, data, formatter) {
    try {
      const { query, values } = (0, sql_helpers_1.buildInsertQuery)(tableName, data);
      return await this.executeSqlWithFormatting(query, values, formatter);
    }
    catch (error) {
      throw service_helpers_1.ServiceErrorHandler.handleError(error, `inserting into ${tableName}`);
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
  async updateWithFormatting(tableName, data, whereCondition, formatter) {
    try {
      const { query, values } = (0, sql_helpers_1.buildUpdateQuery)(tableName, data, whereCondition);
      return await this.executeSqlWithFormatting(query, values, formatter);
    }
    catch (error) {
      throw service_helpers_1.ServiceErrorHandler.handleError(error, `updating ${tableName}`);
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
  async rawInsertWithFormatting(tableName, data, formatter) {
    try {
      const preparedData = (0, sql_helpers_1.prepareSqlValues)(data);
      const query = (0, sql_helpers_1.buildRawInsertQuery)(tableName, preparedData);
      return await this.executeSqlWithFormatting(query, [], formatter);
    }
    catch (error) {
      throw service_helpers_1.ServiceErrorHandler.handleError(error, `inserting into ${tableName}`);
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
  async rawUpdateWithFormatting(tableName, data, whereCondition, formatter) {
    try {
      const preparedData = (0, sql_helpers_1.prepareSqlValues)(data);
      const query = (0, sql_helpers_1.buildRawUpdateQuery)(tableName, preparedData, whereCondition);
      return await this.executeSqlWithFormatting(query, [], formatter);
    }
    catch (error) {
      throw service_helpers_1.ServiceErrorHandler.handleError(error, `updating ${tableName}`);
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
  validateAndPrepare(data, validator, preparer) {
    try {
      const validatedData = validator.parse(data);
      return preparer(validatedData);
    }
    catch (error) {
      throw service_helpers_1.ServiceErrorHandler.handleError(error, 'validating data', errors_1.ErrorCode.VALIDATION_ERROR);
    }
  }
  /**
     * Standard error handler for service methods
     *
     * @param error The caught error
     * @param operation Description of the operation that failed
     * @returns Always throws, return type is for TypeScript compatibility
     */
  handleError(error, operation) {
    throw service_helpers_1.ServiceErrorHandler.handleError(error, operation);
  }
  /**
     * Check if a result exists, throw a NOT_FOUND error if not
     *
     * @param result The result to check
     * @param entityName Name of the entity being checked
     * @returns The result if it exists
     */
  ensureExists(result, entityName) {
    return service_helpers_1.ServiceErrorHandler.ensureExists(result, entityName);
  }
}
exports.EnhancedBaseService = EnhancedBaseService;
