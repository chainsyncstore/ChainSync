/**
 * Unit tests for service helper utilities
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AppError, ErrorCode } from '@shared/types/errors';
import { ResultFormatter, ServiceErrorHandler } from '@shared/utils/service-helpers';

// Test implementation of ResultFormatter
class TestFormatter extends ResultFormatter<{
  id: number;
  name: string;
  createdAt: Date;
  metadata: Record<string, any>;
}> {
  formatResult(dbResult: Record<string, any>) {
    const base = this.baseFormat(dbResult);
    return {
      id: Number(base.id),
      name: String(base.name),
      createdAt: new Date(base.createdAt),
      metadata: this.handleMetadata(base.metadata),
    };
  }
}

// Mock fromDatabaseFields
jest.mock('@shared/utils/field-mapping', () => ({
  fromDatabaseFields: (data: Record<string, any>) => {
    if (!data) return {};

    return Object.entries(data).reduce(
      (acc, [key, value]) => {
        const codeKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[codeKey] = value;
        return acc;
      },
      {} as Record<string, any>
    );
  },
}));

describe('Service Helper Utilities', () => {
  describe('ResultFormatter', () => {
    let formatter: TestFormatter;

    beforeEach(() => {
      formatter = new TestFormatter();

      // Mock console.error to prevent test output noise
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should format a single result correctly', () => {
      const dbResult = {
        id: 1,
        name: 'Test',
        created_at: '2023-01-01T12:00:00Z',
        metadata: '{"key":"value"}',
      };

      const expected = {
        id: 1,
        name: 'Test',
        createdAt: new Date('2023-01-01T12:00:00Z'),
        metadata: { key: 'value' },
      };

      expect(formatter.formatResult(dbResult)).toEqual(expected);
    });

    it('should format multiple results correctly', () => {
      const dbResults = [
        {
          id: 1,
          name: 'Test 1',
          created_at: '2023-01-01T12:00:00Z',
          metadata: '{"key":"value1"}',
        },
        {
          id: 2,
          name: 'Test 2',
          created_at: '2023-01-02T12:00:00Z',
          metadata: '{"key":"value2"}',
        },
      ];

      const expected = [
        {
          id: 1,
          name: 'Test 1',
          createdAt: new Date('2023-01-01T12:00:00Z'),
          metadata: { key: 'value1' },
        },
        {
          id: 2,
          name: 'Test 2',
          createdAt: new Date('2023-01-02T12:00:00Z'),
          metadata: { key: 'value2' },
        },
      ];

      expect(formatter.formatResults(dbResults)).toEqual(expected);
    });

    it('should handle null/undefined input for formatResults', () => {
      expect(formatter.formatResults(null as any)).toEqual([]);
      expect(formatter.formatResults(undefined as any)).toEqual([]);
    });

    it('should handle invalid metadata strings', () => {
      const dbResult = {
        id: 1,
        name: 'Test',
        created_at: '2023-01-01T12:00:00Z',
        metadata: 'invalid-json',
      };

      const formatted = formatter.formatResult(dbResult);
      expect(formatted.metadata).toEqual({});
      expect(console.error).toHaveBeenCalledWith('Error parsing metadata:', expect.any(Error));
    });

    it('should handle null metadata', () => {
      const dbResult = {
        id: 1,
        name: 'Test',
        created_at: '2023-01-01T12:00:00Z',
        metadata: null,
      };

      const formatted = formatter.formatResult(dbResult);
      expect(formatted.metadata).toEqual({});
    });

    it('should convert date strings to Date objects', () => {
      const obj = {
        date1: '2023-01-01T12:00:00Z',
        date2: '2023-01-02T12:00:00Z',
        otherField: 'test',
      };

      const dateFields = ['date1', 'date2'];
      const formatted = formatter['formatDates'](obj, dateFields);

      expect(formatted.date1).toBeInstanceOf(Date);
      expect(formatted.date2).toBeInstanceOf(Date);
      expect(formatted.otherField).toBe('test');
    });

    it('should handle invalid date strings', () => {
      const obj = {
        date: 'invalid-date',
        otherField: 'test',
      };

      const dateFields = ['date'];
      const formatted = formatter['formatDates'](obj, dateFields);

      expect(formatted.date).toBe('invalid-date');
      expect(console.error).toHaveBeenCalledWith(
        'Error parsing date field date:',
        expect.any(Error)
      );
    });
  });

  describe('ServiceErrorHandler', () => {
    beforeEach(() => {
      // Mock console.error to prevent test output noise
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should rethrow AppError instances as-is', () => {
      const originalError = new AppError('Not found', 'NOT_FOUND', ErrorCode.NOT_FOUND);

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
        expect((error as AppError).message).toBe('Error connecting to database: Database error');
      }
    });

    it('should use provided error code for wrapped errors', () => {
      const originalError = new Error('Invalid data');

      try {
        ServiceErrorHandler.handleError(
          originalError,
          'validating input',
          ErrorCode.VALIDATION_ERROR
        );
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
        expect((error as AppError).message).toBe('Error processing request: Unknown error');
      }
    });

    it('should log the error to console', () => {
      const originalError = new Error('Test error');

      try {
        ServiceErrorHandler.handleError(originalError, 'test operation');
      } catch (error) {
        // Expected to throw
      }

      expect(console.error).toHaveBeenCalledWith('Error test operation:', originalError);
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
      const result = { id: 1, name: 'Test' };
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
