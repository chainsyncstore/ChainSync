'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ValidationService = void 0;
const zod_1 = require('zod');
const schema_1 = require('./schema');
const errors_1 = require('@shared/types/errors');
const import_export_errors_1 = require('@shared/types/import-export-errors');
class ValidationService {
  constructor(parent) {
    this.parent = parent;
    this.cache = new Map();
    this._cacheTTL = 3600000; // 1 hour
    this.strictMode = true;
  }
  get cacheTTL() {
    return this._cacheTTL;
  }
  set cacheTTL(value) {
    this._cacheTTL = value;
  }
  getCacheKey(data, type) {
    const schemaType = this.toSchemaType(type);
    return `${schemaType}-${JSON.stringify(data)}`;
  }
  isCacheValid(key) {
    const cacheEntry = this.cache.get(key);
    if (!cacheEntry)
      return false;
    return Date.now() - cacheEntry.timestamp < this._cacheTTL;
  }
  toSchemaType(type) {
    const typeMapping = {
      products: 'product',
      users: 'customer',
      transactions: 'order'
    };
    const schemaType = typeMapping[type];
    if (!schemaType) {
      throw new Error(`Invalid type: ${type}`);
    }
    return schemaType;
  }
  async validate(data, type) {
    const schemaType = this.toSchemaType(type);
    const schema = schema_1.schemas[schemaType];
    if (!schema) {
      throw new Error(`No validation schema found for type: ${type}`);
    }
    const cacheKey = this.getCacheKey(data, type);
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult && this.isCacheValid(cacheKey)) {
      if (cachedResult.success) {
        return cachedResult.data;
      }
      else {
        throw new errors_1.AppError(errors_1.ErrorCategory.IMPORT_EXPORT, import_export_errors_1.ImportExportErrorCodes.INVALID_FORMAT, `Validation failed: ${this.extractErrors(cachedResult.error).join(', ')}`, { errors: this.extractErrors(cachedResult.error) }, 400);
      }
    }
    try {
      const validatedData = await schema.parseAsync(data);
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        success: true,
        data: validatedData
      });
      return validatedData;
    }
    catch (error) {
      const errorMessages = this.extractErrors(error);
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        success: false,
        error
      });
      throw new errors_1.AppError(errors_1.ErrorCategory.IMPORT_EXPORT, import_export_errors_1.ImportExportErrorCodes.INVALID_FORMAT, `Validation failed: ${errorMessages.join(', ')}`, { errors: errorMessages }, 400);
    }
  }
  async validateBatch(data, type) {
    const schemaType = this.toSchemaType(type);
    const schema = schema_1.schemas[schemaType];
    if (!schema) {
      throw new Error(`No validation schema found for type: ${type}`);
    }
    const results = {
      valid: [],
      invalid: []
    };
    for (let i = 0; i < data.length; i++) {
      const cacheKey = this.getCacheKey(data[i], type);
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult && this.isCacheValid(cacheKey)) {
        if (cachedResult.success) {
          results.valid.push(cachedResult.data);
        }
        else {
          results.invalid.push({
            index: i,
            errors: this.extractErrors(cachedResult.error)
          });
        }
        continue;
      }
      try {
        const validated = await schema.parseAsync(data[i]);
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          success: true,
          data: validated
        });
        results.valid.push(validated);
      }
      catch (error) {
        const errors = this.extractErrors(error);
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          success: false,
          error
        });
        results.invalid.push({
          index: i,
          errors
        });
        if (this.strictMode) {
          throw new errors_1.AppError(errors_1.ErrorCategory.IMPORT_EXPORT, import_export_errors_1.ImportExportErrorCodes.INVALID_FORMAT, `Validation failed for item at index ${i}`, { index: i, errors }, 400);
        }
      }
    }
    return results;
  }
  extractErrors(error) {
    if (error instanceof zod_1.z.ZodError) {
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
  clearCache() {
    this.cache.clear();
  }
  clearCacheForData(data, type) {
    const cacheKey = this.getCacheKey(data, type);
    this.cache.delete(cacheKey);
  }
}
exports.ValidationService = ValidationService;
