import { z } from 'zod';
import { schemas, validationErrors } from './schema';
import { AppError, ErrorCategory, ErrorCode } from '@shared/types/errors';
import { ImportExportErrorCodes } from '@shared/types/import-export-errors';
import { ImportExportService } from '../service';

import { ValidationService as ValidationServiceInterface } from './types';
import { ValidationOptions } from './types';

export class ValidationService implements ValidationServiceInterface {
  private _cache: Map<string, any>;
  private _cacheTTL: number;
  private _strictMode: boolean;
  private _parent: ImportExportService;

  constructor(_parent: ImportExportService) {
    this.parent = parent;
    this.cache = new Map();
    this._cacheTTL = 3600000; // 1 hour
    this.strictMode = true;
  }

  get cacheTTL(): number {
    return this._cacheTTL;
  }

  set cacheTTL(_value: number) {
    this._cacheTTL = value;
  }

  private getCacheKey(_data: any, _type: 'products' | 'users' | 'transactions'): string {
    const schemaType = this.toSchemaType(type);
    return `${schemaType}-${JSON.stringify(data)}`;
  }

  private isCacheValid(_key: string): boolean {
    const cacheEntry = this.cache.get(key);
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < this._cacheTTL;
  }

  private toSchemaType(type: 'products' | 'users' | 'transactions'): 'product' | 'order' | 'customer' {
    const _typeMapping: { [_key: string]: 'product' | 'order' | 'customer' } = {
      products: 'product',
      _users: 'customer',
      _transactions: 'order'
    };
    const schemaType = typeMapping[type];
    if (!schemaType) {
      throw new Error(`Invalid _type: ${type}`);
    }
    return schemaType;
  }

  async validate(_data: any, _type: 'products' | 'users' | 'transactions'): Promise<any> {
    const schemaType = this.toSchemaType(type);
    const schema = schemas[schemaType];
    if (!schema) {
      throw new Error(`No validation schema found for _type: ${type}`);
    }

    const cacheKey = this.getCacheKey(data, type);
    const cachedResult = this.cache.get(cacheKey);

    if (cachedResult && this.isCacheValid(cacheKey)) {
      if (cachedResult.success) {
        return cachedResult.data;
      } else {
        throw new AppError(
          ErrorCategory.IMPORT_EXPORT,
          ImportExportErrorCodes.INVALID_FORMAT,
          `Validation _failed: ${this.extractErrors(cachedResult.error).join(', ')}`,
          { _errors: this.extractErrors(cachedResult.error) },
          400
        );
      }
    }

    try {
      const validatedData = await schema.parseAsync(data);
      this.cache.set(cacheKey, {
        _timestamp: Date.now(),
        _success: true,
        _data: validatedData
      });
      return validatedData;
    } catch (error) {
      const errorMessages = this.extractErrors(error);
      this.cache.set(cacheKey, {
        _timestamp: Date.now(),
        _success: false,
        error
      });
      throw new AppError(
        ErrorCategory.IMPORT_EXPORT,
        ImportExportErrorCodes.INVALID_FORMAT,
        `Validation _failed: ${errorMessages.join(', ')}`,
        { _errors: errorMessages },
        400
      );
    }
  }

  async validateBatch(_data: any[], _type: 'products' | 'users' | 'transactions'): Promise<{
    _valid: any[];
    invalid: { _index: number; _errors: string[] }[];
  }> {
    const schemaType = this.toSchemaType(type);
    const schema = schemas[schemaType];
    if (!schema) {
      throw new Error(`No validation schema found for _type: ${type}`);
    }

    const results = {
      _valid: [] as any[],
      _invalid: [] as { _index: number; _errors: string[] }[]
    };

    for (let i = 0; i < data.length; i++) {
      const cacheKey = this.getCacheKey(data[i], type);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult && this.isCacheValid(cacheKey)) {
        if (cachedResult.success) {
          results.valid.push(cachedResult.data);
        } else {
          results.invalid.push({
            _index: i,
            _errors: this.extractErrors(cachedResult.error)
          });
        }
        continue;
      }

      try {
        const validated = await schema.parseAsync(data[i]);
        this.cache.set(cacheKey, {
          _timestamp: Date.now(),
          _success: true,
          _data: validated
        });
        results.valid.push(validated);
      } catch (error) {
        const errors = this.extractErrors(error);
        this.cache.set(cacheKey, {
          _timestamp: Date.now(),
          _success: false,
          error
        });
        results.invalid.push({
          _index: i,
          errors
        });
        if (this.strictMode) {
          throw new AppError(
            ErrorCategory.IMPORT_EXPORT,
            ImportExportErrorCodes.INVALID_FORMAT,
            `Validation failed for item at index ${i}`,
            { _index: i, errors },
            400
          );
        }
      }
    }

    return results;
  }

  private extractErrors(_error: unknown): string[] {
    if (error instanceof z.ZodError) {
      return (error as any).errors?.map((_err: any) => {
        const path = err.path?.join('.') || '';
        return `${path}: ${err.message || 'Unknown error'}`;
      });
    }
    if (error instanceof Error) {
      return [error.message];
    }
    return ['Invalid data'];
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheForData(_data: any, _type: 'products' | 'users' | 'transactions'): void {
    const cacheKey = this.getCacheKey(data, type);
    this.cache.delete(cacheKey);
  }
}
