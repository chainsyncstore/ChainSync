import { z } from 'zod';

import { AppError, ErrorCode, ErrorCategory } from '../../shared/types/errors.js';
import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ component: 'validation' });

export const validateRequest = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> => {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw AppError.fromZodError(error);
    }
    throw new AppError(
      'Request validation failed',
      ErrorCategory.VALIDATION,
      ErrorCode.VALIDATION_FAILED,
      { details: error },
      400
    );
  }
};

export const validateParams = <T extends z.ZodTypeAny>(
  schema: T,
  params: Record<string, any>
): z.infer<T> => {
  try {
    return schema.parse(params);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw AppError.fromZodError(error);
    }
    throw new AppError(
      'Route parameter validation failed',
      ErrorCategory.VALIDATION,
      ErrorCode.VALIDATION_FAILED,
      { details: error },
      400
    );
  }
};

export const validateQuery = <T extends z.ZodTypeAny>(
  schema: T,
  query: Record<string, any>
): z.infer<T> => {
  try {
    return schema.parse(query);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw AppError.fromZodError(error);
    }
    throw new AppError(
      'Query parameter validation failed',
      ErrorCategory.VALIDATION,
      ErrorCode.VALIDATION_FAILED,
      { details: error },
      400
    );
  }
};

/**
 * Validate database operation results
 *
 * Used to ensure type safety for database operations.
 * Provides robust runtime validation to prevent runtime type errors.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param context - Additional context for error reporting
 * @returns Validated data with proper typing
 */
export const validateDbResult = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: { operation: string; entity: string }
): z.infer<T> => {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      logger.error('Database result validation failed', {
        error: error.format(),
        context,
        data,
      });
      throw new AppError(
        `Database operation failed: ${context.operation} on ${context.entity}`,
        ErrorCategory.DATA_INTEGRITY,
        ErrorCode.DATABASE_VALIDATION_FAILED,
        { zodError: error.format() },
        500
      );
    }
    throw new AppError(
      'Database validation error',
      ErrorCategory.DATA_INTEGRITY,
      ErrorCode.DATABASE_VALIDATION_FAILED,
      { details: error },
      500
    );
  }
};

/**
 * Validate and log - useful for non-critical validations
 *
 * Instead of throwing on validation failure, this logs the error
 * and returns null. Useful for non-critical validations or
 * when you want to handle the error gracefully.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param context - Additional context for error reporting
 * @returns Validated data or null if validation fails
 */
export const validateAndLog = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: { operation: string; entity: string }
): z.infer<T> | null => {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      logger.warn('Data validation failed (non-critical)', {
        error: error.format(),
        context,
        data,
      });
      return null;
    }
    logger.error('Unexpected validation error', {
      error,
      context,
      data,
    });
    return null;
  }
};

/**
 * Safely validate an array of items
 *
 * Filters out invalid items rather than failing the entire array.
 * Useful for batch operations where some items might be invalid.
 *
 * @param schema - Zod schema for individual items
 * @param data - Array of items to validate
 * @param context - Additional context for error reporting
 * @returns Array of valid items with proper typing
 */
export const validateArray = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown[],
  context: { operation: string; entity: string }
): z.infer<T>[] => {
  if (!Array.isArray(data)) {
    logger.warn('Expected array for validation, got:', {
      type: typeof data,
      context,
    });
    return [];
  }

  const validItems: z.infer<T>[] = [];
  const invalidItems: { index: number; error: unknown; item: unknown }[] = [];

  data.forEach((item, index) => {
    try {
      validItems.push(schema.parse(item));
    } catch (error) {
      invalidItems.push({ index, error, item });
    }
  });

  if (invalidItems.length > 0) {
    logger.warn('Some items failed validation', {
      totalItems: data.length,
      validItems: validItems.length,
      invalidItems: invalidItems.length,
      firstInvalidItem: invalidItems[0],
      context,
    });
  }

  return validItems;
};

/**
 * Validate service input/output
 *
 * Used to ensure type safety for service operations.
 * Useful for validating inputs and outputs at service boundaries.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param context - Additional context for error reporting
 * @returns Validated data with proper typing
 */
export const validateServiceData = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: { service: string; method: string; type: 'input' | 'output' }
): z.infer<T> => {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      logger.error('Service data validation failed', {
        error: error.format(),
        context,
        data,
      });
      throw new AppError(
        `${context.service}.${context.method} ${context.type} validation failed`,
        ErrorCategory.VALIDATION,
        ErrorCode.SERVICE_VALIDATION_FAILED,
        { zodError: error.format() },
        400
      );
    }
    throw new AppError(
      'Service validation error',
      ErrorCategory.VALIDATION,
      ErrorCode.SERVICE_VALIDATION_FAILED,
      { details: error },
      400
    );
  }
};
