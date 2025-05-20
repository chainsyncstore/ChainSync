import { z } from 'zod';
import { schemas, validationErrors } from './schema';
import { AppError, ErrorCategory, ErrorCode } from '@shared/types/errors';
import { ImportExportErrorCodes } from '@shared/types/import-export-errors';
import { ImportExportService } from '../service';

import { ValidationService as ValidationServiceInterface } from './types';
import { ValidationOptions } from './types';

export class ValidationService implements ValidationServiceInterface {
  private cache: Map<string, any>;
  private _cacheTTL: number;
  private strictMode: boolean;
  private parent: ImportExportService;

  constructor(parent: ImportExportService) {
    this.parent = parent;
    this.cache = new Map();
    this._cacheTTL = 3600000; // 1 hour
    this.strictMode = true;
  }

  get cacheTTL(): number {
    return this._cacheTTL;
  }

  set cacheTTL(value: number) {
    this._cacheTTL = value;
  }

  private getCacheKey(data: any, type: 'products' | 'users' | 'transactions'): string {
    return `${type}-${JSON.stringify(data)}`;
  }

  private isCacheValid(key: string): boolean {
    const cacheEntry = this.cache.get(key);
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < this._cacheTTL;
  }

  async validate(data: any, type: 'products' | 'users' | 'transactions'): Promise<any> {
    const schema = schemas[type];
    if (!schema) {
      throw new Error(`No validation schema found for type: ${type}`);
    }

    const cacheKey = this.getCacheKey(data, type);
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).result;
    }

    const result = schema.safeParse(data);
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      result
    });

    if (!result.success) {
      const errorMessages = result.error.errors.map((error) => {
        const path = error.path.join('.');
        return `${path}: ${error.message || 'Invalid value'}`;
      });

      throw new AppError(
        ErrorCategory.IMPORT_EXPORT,
        ImportExportErrorCodes.INVALID_FORMAT,
        `Validation failed: ${errorMessages.join(', ')}`,
        { errors: errorMessages },
        400
      );
    }

    return result.data;
  }

  async validateBatch(data: any[], type: 'products' | 'users' | 'transactions'): Promise<{
    valid: any[];
    invalid: { index: number; errors: string[] }[];
  }> {
    const schema = schemas[type];
    if (!schema) {
      throw new Error(`No validation schema found for type: ${type}`);
    }

    const results = {
      valid: [] as any[],
      invalid: [] as { index: number; errors: string[] }[]
    };

    for (let i = 0; i < data.length; i++) {
      try {
        const validated = await schema.parseAsync(data[i]);
        results.valid.push(validated);
      } catch (error) {
        results.invalid.push({
          index: i,
          errors: this.extractErrors(error)
        });
        if (this.strictMode) {
          throw new AppError(
            ErrorCategory.IMPORT_EXPORT,
            ImportExportErrorCodes.INVALID_FORMAT,
            `Validation failed for item at index ${i}`,
            { index: i, errors: this.extractErrors(error) },
            400
          );
        }
      }
    }

    return results;
  }

  private extractErrors(error: unknown): string[] {
    if (error instanceof z.ZodError) {
      return error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
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

  clearCacheForData(data: any, type: 'products' | 'users' | 'transactions'): void {
    const cacheKey = this.getCacheKey(data, type);
    this.cache.delete(cacheKey);
  }
}
