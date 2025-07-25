import { AppError, ErrorCategory } from '@shared/types/errors';
import { ValidationOptions } from './types';

export interface ValidationService {
  validate(data: any[], options?: ValidationOptions): Promise<{
    validCount: number;
    invalidCount: number;
    validRecords: any[];
    invalidRecords: any[];
  }>;
}

export class ValidationService implements ValidationService {
  async validate(data: any[], options?: ValidationOptions): Promise<{
    validCount: number;
    invalidCount: number;
    validRecords: any[];
    invalidRecords: { record: any; errors: string[] }[];
  }> {
    try {
      const { requiredFields = [], filters = {} } = options || {};
      const validRecords: any[] = [];
      const invalidRecords: { record: any; errors: string[] }[] = [];

      if (!Array.isArray(data)) {
        throw new AppError('Data must be an array', ErrorCategory.IMPORT_EXPORT, 'INVALID_DATA');
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
        const validationErrors: string[] = [];

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
        } else {
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
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Validation failed', ErrorCategory.IMPORT_EXPORT, 'VALIDATION_ERROR');
    }
  }
}
