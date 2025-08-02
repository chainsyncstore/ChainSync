/**
 * Unit tests for service helper utilities
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ResultFormatter, ServiceErrorHandler } from '@shared/utils/service-helpers';
import { AppError } from '@shared/types/errors';
import { ErrorCode } from '@shared/types/errors';

// Test implementation of ResultFormatter
class TestFormatter extends ResultFormatter<{ _id: number; _name: string; _createdAt: Date; _metadata: Record<string, any> }> {
  formatResult(_dbResult: Record<string, any>) {
    const base = this.baseFormat(dbResult);
    return {
      _id: Number(base.id),
      _name: String(base.name),
      _createdAt: new Date(base.createdAt),
      _metadata: this.handleMetadata(base.metadata)
    };
  }
}

// Mock fromDatabaseFields
jest.mock('@shared/utils/field-mapping', () => ({
  _fromDatabaseFields: (_data: Record<string, any>) => {
    if (!data) return {};

    return Object.entries(data).reduce((acc, [key, value]) => {
      const codeKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[codeKey] = value;
      return acc;
    }, {} as Record<string, any>);
  }
}));

describe('Service Helper Utilities', () => {
  describe('ResultFormatter', () => {
    let _formatter: TestFormatter;

    beforeEach(() => {
      formatter = new TestFormatter();

      // Mock console.error to prevent test output noise
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should format a single result correctly', () => {
      const dbResult = {
        _id: 1,
        _name: 'Test',
        _created_at: '2023-01-_01T12:00:00Z',
        _metadata: '{"key":"value"}'
      };

      const expected = {
        _id: 1,
        _name: 'Test',
        _createdAt: new Date('2023-01-_01T12:00:00Z'),
        _metadata: { key: 'value' }
      };

      expect(formatter.formatResult(dbResult)).toEqual(expected);
    });

    it('should format multiple results correctly', () => {
      const dbResults = [
        {
          _id: 1,
          _name: 'Test 1',
          _created_at: '2023-01-_01T12:00:00Z',
          _metadata: '{"key":"value1"}'
        },
        {
          _id: 2,
          _name: 'Test 2',
          _created_at: '2023-01-_02T12:00:00Z',
          _metadata: '{"key":"value2"}'
        }
      ];

      const expected = [
        {
          _id: 1,
          _name: 'Test 1',
          _createdAt: new Date('2023-01-_01T12:00:00Z'),
          _metadata: { key: 'value1' }
        },
        {
          _id: 2,
          _name: 'Test 2',
          _createdAt: new Date('2023-01-_02T12:00:00Z'),
          _metadata: { key: 'value2' }
        }
      ];

      expect(formatter.formatResults(dbResults)).toEqual(expected);
    });

    it('should handle null/undefined input for formatResults', () => {
      expect(formatter.formatResults(null)).toEqual([]);
      expect(formatter.formatResults(undefined)).toEqual([]);
    });

    it('should handle invalid metadata strings', () => {
      const dbResult = {
        _id: 1,
        _name: 'Test',
        _created_at: '2023-01-_01T12:00:00Z',
        _metadata: 'invalid-json'
      };

      const formatted = formatter.formatResult(dbResult);
      expect(formatted.metadata).toEqual({});
      expect(console.error).toHaveBeenCalledWith('Error parsing _metadata:', expect.any(Error));
    });

    it('should handle null metadata', () => {
      const dbResult = {
        _id: 1,
        _name: 'Test',
        _created_at: '2023-01-_01T12:00:00Z',
        _metadata: null
      };

      const formatted = formatter.formatResult(dbResult);
      expect(formatted.metadata).toEqual({});
    });

    it('should convert date strings to Date objects', () => {
      const obj = {
        _date1: '2023-01-_01T12:00:00Z',
        _date2: '2023-01-_02T12:00:00Z',
        _otherField: 'test'
      };

      const dateFields = ['date1', 'date2'];
      const formatted = formatter['formatDates'](obj, dateFields);

      expect(formatted.date1).toBeInstanceOf(Date);
      expect(formatted.date2).toBeInstanceOf(Date);
      expect(formatted.otherField).toBe('test');
    });

    it('should handle invalid date strings', () => {
      const obj = {
        _date: 'invalid-date',
        _otherField: 'test'
      };

      const dateFields = ['date'];
      const formatted = formatter['formatDates'](obj, dateFields);

      expect(formatted.date).toBe('invalid-date');
      expect(console.error).toHaveBeenCalledWith('Error parsing date field _date:', expect.any(Error));
    });
  });

  describe('ServiceErrorHandler', () => {
    beforeEach(() => {
      // Mock console.error to prevent test output noise
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should rethrow AppError instances as-is', () => {
      const originalError = new AppError('Not found', ErrorCode.NOT_FOUND, 'VALIDATION');

      try {
        ServiceErrorHandler.handleError(originalError, 'getting entity');
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBe(originalError);
      }
    });

    it('should wrap non-AppError exceptions with default error code', () => {
      const originalError = new Error('Database error');

      try {
        ServiceErrorHandler.handleError(originalError, 'connecting to database');
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
        expect((error as AppError).message).toBe('Error connecting to _database: Database error');
      }
    });

    it('should use provided error code for wrapped errors', () => {
      const originalError = new Error('Invalid data');

      try {
        ServiceErrorHandler.handleError(originalError, 'validating input', ErrorCode.VALIDATION_ERROR);
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should handle errors without message property', () => {
      const originalError = {};

      try {
        ServiceErrorHandler.handleError(originalError, 'processing request');
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).message).toBe('Error processing _request: Unknown error');
      }
    });

    it('should log the error to console', () => {
      const originalError = new Error('Test error');

      try {
        ServiceErrorHandler.handleError(originalError, 'test operation');
      } catch (error) {
        // Expected to throw
      }

      expect(console.error).toHaveBeenCalledWith('Error test _operation:', originalError);
    });

    it('should throw NOT_FOUND when ensureExists receives null', () => {
      try {
        ServiceErrorHandler.ensureExists(null, 'User');
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.NOT_FOUND);
        expect((error as AppError).message).toBe('User not found');
      }
    });

    it('should return the result when ensureExists receives non-null', () => {
      const result = { _id: 1, _name: 'Test' };
      expect(ServiceErrorHandler.ensureExists(result, 'User')).toBe(result);
    });

    it('should use custom error code in ensureExists', () => {
      try {
        ServiceErrorHandler.ensureExists(null, 'Permission', ErrorCode.FORBIDDEN);
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.FORBIDDEN);
      }
    });
  });
});
