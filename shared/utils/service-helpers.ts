/**
 * Service Helper Utilities
 *
 * Base classes and utilities to standardize service implementations across the application.
 * These helpers promote consistent patterns for result formatting, error handling, and
 * database operations.
 */
import { fromDatabaseFields } from './field-mapping';
import { ErrorCode, ErrorCategory, AppError } from '../types/errors';

/**
 * Abstract base class for formatting database results into domain objects
 */
export abstract class ResultFormatter<T> {
  /**
   * Format a single database result row into a domain object
   *
   * @param dbResult The raw database result row
   * @returns A properly formatted domain object
   */
  abstract formatResult(dbResult: Record<string, unknown>): T;

  /**
   * Format multiple database result rows into domain objects
   *
   * @param dbResults Array of raw database result rows
   * @returns Array of properly formatted domain objects
   */
  formatResults(dbResults: Record<string, unknown>[]): T[] {
    if (!dbResults || !Array.isArray(dbResults)) return [];
    return dbResults.map(result => this.formatResult(result));
  }

  /**
   * Standard handler for metadata fields that are stored as JSON strings
   *
   * @param metadataStr The raw metadata string from the database
   * @returns Parsed metadata object or empty object if parsing fails
   */
  protected handleMetadata(metadataStr: string | null): Record<string, unknown> {
    if (!metadataStr) return {};
    try {
      return JSON.parse(metadataStr);
    } catch (e: unknown) {
      console.error('Error parsing metadata:', e);
      return {};
    }
  }

  /**
   * Standard base formatter that converts snake_case to camelCase
   *
   * @param dbResult The raw database result row
   * @returns An object with camelCase keys
   */
  protected baseFormat(dbResult: Record<string, unknown>): Record<string, unknown> {
    if (!dbResult) return {};
    return fromDatabaseFields(dbResult);
  }

  /**
   * Format date fields from strings to Date objects
   *
   * @param obj The object containing date fields
   * @param dateFields Array of field names that should be converted to Date objects
   * @returns The same object with converted date fields
   */
  protected formatDates(obj: Record<string, unknown>, dateFields: string[]): Record<string, unknown> {
    if (!obj) return {};

    dateFields.forEach(field => {
      if (obj[field] && typeof obj[field] === 'string') {
        const dateValue = new Date(obj[field]);
        if (isNaN(dateValue.getTime())) {
          console.error(
            `Error parsing date field ${field}:`,
            new Error(`Invalid date: ${obj[field]}`)
          );
          // Leave the original string value as-is if invalid
        } else {
          obj[field] = dateValue;
        }
      }
    });

    return obj;
  }
}

/**
 * Error handler utility for standardized error handling in services
 */
export class ServiceErrorHandler {
  /**
   * Standard error handler for service methods
   *
   * @param error The caught error
   * @param operation Description of the operation that failed
   * @param defaultErrorCode Error code to use if not an AppError
   * @throws Always throws an AppError with consistent formatting
   */
  static handleError(
    error: unknown,
    operation: string,
    defaultErrorCode: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR
  ): never {
    console.error(`Error ${operation}:`, error);

    if (error instanceof AppError) {
      // If it's already an AppError, re-throw it directly.
      throw error;
    }

    let detailMessage = 'Unknown error';
    if (error instanceof Error) {
      detailMessage = error.message;
    } else if (typeof error === 'string') {
      detailMessage = error;
    }

    const message = `Error ${operation}: ${detailMessage}`;

    // Use generic category for default errors
    throw new AppError(
      message,
      defaultErrorCode === ErrorCode.NOT_FOUND ? ErrorCategory.RESOURCE : ErrorCategory.SYSTEM,
      defaultErrorCode,
      { cause: error }
    );
  }

  /**
   * Check if a result exists, throw a NOT_FOUND error if not
   *
   * @param result The result to check
   * @param entityName Name of the entity being checked
   * @param errorCode Error code to use
   * @returns The result if it exists
   * @throws AppError if result doesn't exist
   */
  static ensureExists<T>(
    result: T | null | undefined,
    entityName: string,
    errorCode: ErrorCode = ErrorCode.NOT_FOUND
  ): T {
    if (!result) {
      throw new AppError(`${entityName} not found`, ErrorCategory.RESOURCE, errorCode);
    }
    return result;
  }
}
