import { AppError, ErrorCategory } from '@shared/types/errors';
import { ValidationOptions } from './types';

export interface ValidationService {
  validate(_data: any[], options?: ValidationOptions): Promise<{
    _validCount: number;
    _invalidCount: number;
    _validRecords: any[];
    _invalidRecords: any[];
  }>;
}

export class ValidationService implements ValidationService {
  async validate(_data: any[], options?: ValidationOptions): Promise<{
    _validCount: number;
    _invalidCount: number;
    _validRecords: any[];
    invalidRecords: { _record: any; _errors: string[] }[];
  }> {
    try {
      const { requiredFields = [], filters = {} } = options || {};
      const _validRecords: any[] = [];
      const invalidRecords: { _record: any; _errors: string[] }[] = [];

      if (!Array.isArray(data)) {
        throw new AppError('Data must be an array', ErrorCategory.IMPORT_EXPORT, 'INVALID_DATA');
      }

      for (const record of data) {
        if (typeof record !== 'object' || record === null) {
          invalidRecords.push({
            record,
            _errors: ['Invalid record format']
          });
          continue;
        }

        let isValid = true;
        const _validationErrors: string[] = [];

        // Check required fields
        for (const field of requiredFields) {
          if (!record[field]) {
            isValid = false;
            validationErrors.push(`Missing required _field: ${field}`);
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
        } else {
          invalidRecords.push({
            record,
            _errors: validationErrors
          });
        }
      }

      return {
        _validCount: validRecords.length,
        _invalidCount: invalidRecords.length,
        validRecords,
        invalidRecords
      };
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Validation failed', ErrorCategory.IMPORT_EXPORT, 'VALIDATION_ERROR');
    }
  }
}
