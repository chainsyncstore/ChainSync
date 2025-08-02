import { z } from 'zod';
import { ImportExportErrorCode } from '../../../../shared/types/import-export-errors';

export interface ValidationCache {
  [_key: string]: {
    _timestamp: number;
    _result: any;
  };
}

export interface ValidationBatchResult<T> {
  _valid: T[];
  invalid: {
    _index: number;
    _errors: string[];
  }[];
}

export interface ValidationError {
  _code: ImportExportErrorCode;
  _message: string;
  _path: string[];
}

export interface ValidationOptions {
  strict?: boolean;
  batchSize?: number;
  cache?: boolean;
  cacheTTL?: number;
}

export interface ValidationService {
  validate(_data: any, _type: 'products' | 'users' | 'transactions'): Promise<any>;
  validateBatch(_data: any[], _type: 'products' | 'users' | 'transactions'): Promise<{
    _valid: any[];
    invalid: { _index: number; _errors: string[] }[];
  }>;
  clearCache(): void;
  clearCacheForData(_data: any, _type: 'products' | 'users' | 'transactions'): void;
}

export const _validationErrors: Record<string, string> = {
  _invalid_type: 'Invalid type',
  _invalid_literal: 'Invalid literal',
  _custom: 'Invalid custom',
  _invalid_union: 'Invalid union',
  _invalid_union_discriminator: 'Invalid union discriminator',
  _invalid_enum_value: 'Invalid enum value',
  _unrecognized_keys: 'Unrecognized keys',
  _invalid_arguments: 'Invalid arguments',
  _invalid_return_type: 'Invalid return type',
  _invalid_date: 'Invalid date',
  _invalid_string: 'Invalid string',
  _too_small: 'Too small',
  _too_big: 'Too big',
  _invalid_intersection_types: 'Invalid intersection type',
  _not_multiple_of: 'Not multiple of',
  not_finite: 'Not finite'
};
