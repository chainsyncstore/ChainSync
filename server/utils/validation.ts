import { z } from 'zod';
import { AppError, ErrorCode, ErrorCategory } from '../../shared/types/errors';

export const validateRequest = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw AppError.fromZodError(error);
    }
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      'Request validation failed',
      ErrorCategory.VALIDATION,
      undefined,
      undefined,
      { details: error }
    );
  }
};

export const validateParams = <T extends z.ZodTypeAny>(
  schema: T,
  params: Record<string, any>
): z.infer<T> => {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw AppError.fromZodError(error);
    }
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      'Route parameter validation failed',
      ErrorCategory.VALIDATION,
      undefined,
      undefined,
      { details: error }
    );
  }
};

export const validateQuery = <T extends z.ZodTypeAny>(
  schema: T,
  query: Record<string, any>
): z.infer<T> => {
  try {
    return schema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw AppError.fromZodError(error);
    }
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      'Query parameter validation failed',
      ErrorCategory.VALIDATION,
      undefined,
      undefined,
      { details: error }
    );
  }
};
