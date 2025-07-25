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
    const schemaType = this.toSchemaType(type);
    return `${schemaType}-${JSON.stringify(data)}`;
  }

  private isCacheValid(key: string): boolean {
    const cacheEntry = this.cache.get(key);
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < this._cacheTTL;
  }

  private toSchemaType(type: 'products' | 'users' | 'transactions'): 'product' | 'order' | 'customer' {
    const typeMapping: { [key: string]: 'product' | 'order' | 'customer' } = {
      products: 'product',
      users: 'customer',
      transactions: 'order',
    };
    const schemaType = typeMapping[type];
    if (!schemaType) {
      throw new Error(`Invalid type: ${type}`);
    }
    return schemaType;
  }

  async validate(data: any, type: 'products' | 'users' | 'transactions'): Promise<any> {
    const schemaType = this.toSchemaType(type);
    const schema = schemas[schemaType];
    if (!schema) {
      throw new Error(`No validation schema found for type: ${type}`);
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
          `Validation failed: ${this.extractErrors(cachedResult.error).join(', ')}`,
          { errors: this.extractErrors(cachedResult.error) },
          400
        );
      }
    }

    try {
      const validatedData = await schema.parseAsync(data);
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        success: true,
        data: validatedData,
      });
      return validatedData;
    } catch (error) {
      const errorMessages = this.extractErrors(error);
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        success: false,
        error,
      });
      throw new AppError(
        ErrorCategory.IMPORT_EXPORT,
        ImportExportErrorCodes.INVALID_FORMAT,
        `Validation failed: ${errorMessages.join(', ')}`,
        { errors: errorMessages },
        400
      );
    }
  }

  async validateBatch(data: any[], type: 'products' | 'users' | 'transactions'): Promise<{
    valid: any[];
    invalid: { index: number; errors: string[] }[];
  }> {
    const schemaType = this.toSchemaType(type);
    const schema = schemas[schemaType];
    if (!schema) {
      throw new Error(`No validation schema found for type: ${type}`);
    }

    const results = {
      valid: [] as any[],
      invalid: [] as { index: number; errors: string[] }[]
    };

    for (let i = 0; i < data.length; i++) {
      const cacheKey = this.getCacheKey(data[i], type);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult && this.isCacheValid(cacheKey)) {
        if (cachedResult.success) {
          results.valid.push(cachedResult.data);
        } else {
          results.invalid.push({
            index: i,
            errors: this.extractErrors(cachedResult.error),
          });
        }
        continue;
      }

      try {
        const validated = await schema.parseAsync(data[i]);
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          success: true,
          data: validated,
        });
        results.valid.push(validated);
      } catch (error) {
        const errors = this.extractErrors(error);
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          success: false,
          error,
        });
        results.invalid.push({
          index: i,
          errors,
        });
        if (this.strictMode) {
          throw new AppError(
            ErrorCategory.IMPORT_EXPORT,
            ImportExportErrorCodes.INVALID_FORMAT,
            `Validation failed for item at index ${i}`,
            { index: i, errors },
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
