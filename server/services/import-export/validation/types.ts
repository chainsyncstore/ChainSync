import { z } from 'zod';
import { ImportExportErrorCode } from '../../../../shared/types/import-export-errors';

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

export const validationErrors: Record<z.ZodIssueCode, string> = {
  invalid_type: 'Invalid type',
  invalid_literal: 'Invalid literal',
  custom: 'Invalid custom',
  invalid_union: 'Invalid union',
  invalid_union_discriminator: 'Invalid union discriminator',
  invalid_enum_value: 'Invalid enum value',
  unrecognized_keys: 'Unrecognized keys',
  invalid_arguments: 'Invalid arguments',
  invalid_return_type: 'Invalid return type',
  invalid_date: 'Invalid date',
  invalid_string: 'Invalid string',
  too_small: 'Too small',
  too_big: 'Too big',
  invalid_intersection_types: 'Invalid intersection type',
  not_multiple_of: 'Not multiple of',
  not_finite: 'Not finite',
};
