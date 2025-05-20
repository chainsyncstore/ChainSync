import { z } from 'zod';
import { ImportExportErrorCode } from '../../../shared/types/import-export-errors';

export interface ValidationCache {
  [key: string]: {
    timestamp: number;
    result: z.SafeParseReturnType<any, any>;
  };
}

export interface ValidationBatchResult<T> {
  valid: T[];
  invalid: {
    index: number;
    errors: string[];
  }[];
}

export interface ValidationError {
  code: ImportExportErrorCode;
  message: string;
  path: string[];
}

export interface ValidationOptions {
  strict?: boolean;
  batchSize?: number;
  cache?: boolean;
  cacheTTL?: number;
}

export interface ValidationService {
  validate(data: any, type: 'products' | 'users' | 'transactions'): Promise<any>;
  validateBatch(data: any[], type: 'products' | 'users' | 'transactions'): Promise<{
    valid: any[];
    invalid: { index: number; errors: string[] }[];
  }>;
  clearCache(): void;
  clearCacheForData(data: any, type: 'products' | 'users' | 'transactions'): void;
}

export const validationErrors: Record<z.ZodErrorCodes, string> = {
  invalid_type: 'Invalid type',
  invalid_enum_value: 'Invalid enum value',
  invalid_date: 'Invalid date',
  invalid_string: 'Invalid string',
  invalid_number: 'Invalid number',
  invalid_array: 'Invalid array',
  invalid_object: 'Invalid object',
  invalid_union: 'Invalid union',
  invalid_intersection: 'Invalid intersection',
  invalid_tuple: 'Invalid tuple',
  invalid_record: 'Invalid record',
  invalid_function: 'Invalid function',
  invalid_lazy: 'Invalid lazy',
  invalid_promise: 'Invalid promise',
  invalid_custom: 'Invalid custom',
  invalid_async_custom: 'Invalid async custom'
};
