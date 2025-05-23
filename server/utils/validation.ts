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
  } catch (error) {
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
  } catch (error) {
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
