/**
 * Service Helper Utilities
 *
 * Base classes and utilities to standardize service implementations across the application.
 * These helpers promote consistent patterns for result formatting, error handling, and
 * database operations.
 */
import { fromDatabaseFields } from './field-mapping';
import { ErrorCode } from '../types/errors';
import { AppError } from '../types/errors';
/**
 * Abstract base class for formatting database results into domain objects
 */
export class ResultFormatter {
    /**
     * Format multiple database result rows into domain objects
     *
     * @param dbResults Array of raw database result rows
     * @returns Array of properly formatted domain objects
     */
    formatResults(dbResults) {
        if (!dbResults || !Array.isArray(dbResults))
            return [];
        return dbResults.map(result => this.formatResult(result));
    }
    /**
     * Standard handler for metadata fields that are stored as JSON strings
     *
     * @param metadataStr The raw metadata string from the database
     * @returns Parsed metadata object or empty object if parsing fails
     */
    handleMetadata(metadataStr) {
        if (!metadataStr)
            return {};
        try {
            return JSON.parse(metadataStr);
        }
        catch (e) {
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
    baseFormat(dbResult) {
        if (!dbResult)
            return {};
        return fromDatabaseFields(dbResult);
    }
    /**
     * Format date fields from strings to Date objects
     *
     * @param obj The object containing date fields
     * @param dateFields Array of field names that should be converted to Date objects
     * @returns The same object with converted date fields
     */
    formatDates(obj, dateFields) {
        if (!obj)
            return {};
        dateFields.forEach(field => {
            if (obj[field] && typeof obj[field] === 'string') {
                const dateValue = new Date(obj[field]);
                if (isNaN(dateValue.getTime())) {
                    console.error(`Error parsing date field ${field}:`, new Error(`Invalid date: ${obj[field]}`));
                    // Leave the original string value as-is if invalid
                }
                else {
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
    static handleError(error, operation, defaultErrorCode = ErrorCode.INTERNAL_SERVER_ERROR) {
        console.error(`Error ${operation}:`, error);
        if (error instanceof AppError) {
            throw error;
        }
        let message;
        if (error && typeof error.message === 'string') {
            message = `Error ${operation}: ${error.message}`;
        }
        else {
            message = `Error ${operation}: Unknown error`;
        }
        // Use generic category for default errors
        throw new AppError(message, defaultErrorCode === ErrorCode.NOT_FOUND ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR', defaultErrorCode);
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
    static ensureExists(result, entityName, errorCode = ErrorCode.NOT_FOUND) {
        if (!result) {
            throw new AppError(`${entityName} not found`, 'NOT_FOUND', errorCode);
        }
        return result;
    }
}
//# sourceMappingURL=service-helpers.js.map