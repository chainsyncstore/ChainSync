'use strict';
import { z } from 'zod';
import { AppError, ErrorCategory, ErrorCode } from '@shared/types/errors';

const validateRequest = (schema, data) => {
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
      { _details: error },
      400
    );
  }
};

const validateParams = (schema, params) => {
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
      { _details: error },
      400
    );
  }
};

const validateQuery = (schema, query) => {
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
      { _details: error },
      400
    );
  }
};

export { validateRequest, validateParams, validateQuery };
