'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ValidationService = void 0;
const errors_1 = require('@shared/types/errors');
class ValidationService {
  async validate(data, options) {
    try {
      const { requiredFields = [], filters = {} } = options || {};
      const validRecords = [];
      const invalidRecords = [];
      if (!Array.isArray(data)) {
        throw new errors_1.AppError('Data must be an array', errors_1.ErrorCategory.IMPORT_EXPORT, 'INVALID_DATA');
      }
      for (const record of data) {
        if (typeof record !== 'object' || record === null) {
          invalidRecords.push({
            record,
            errors: ['Invalid record format']
          });
          continue;
        }
        let isValid = true;
        const validationErrors = [];
        // Check required fields
        for (const field of requiredFields) {
          if (!record[field]) {
            isValid = false;
            validationErrors.push(`Missing required field: ${field}`);
          }
        }
        // Apply filters
        for (const [field, value] of Object.entries(filters)) {
          if (record[field] !== value) {
            isValid = false;
            validationErrors.push(`Field ${field} does not match expected value`);
          }
        }
        if (isValid) {
          validRecords.push(record);
        }
        else {
          invalidRecords.push({
            record,
            errors: validationErrors
          });
        }
      }
      return {
        validCount: validRecords.length,
        invalidCount: invalidRecords.length,
        validRecords,
        invalidRecords
      };
    }
    catch (error) {
      throw new errors_1.AppError(error instanceof Error ? error.message : 'Validation failed', errors_1.ErrorCategory.IMPORT_EXPORT, 'VALIDATION_ERROR');
    }
  }
}
exports.ValidationService = ValidationService;
