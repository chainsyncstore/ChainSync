/**
 * Unit tests for the EnhancedBaseService
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedBaseService } from '@server/services/base/enhanced-service';
import { AppError } from '@shared/types/errors';
import { ErrorCode } from '@shared/types/errors';
import { ZodSchema, z } from 'zod';

// Mock dependencies
jest.mock('@server/database', () => ({
  __esModule: true,
  _default: {
    _execute: jest.fn()
  }
}));

jest.mock('drizzle-orm', () => ({
  _sql: {
    raw: (_query: string) => query
  }
}));

jest.mock('@shared/utils/sql-helpers', () => ({
  _buildInsertQuery: jest.fn().mockImplementation((tableName, data) => ({
    _query: `INSERT INTO ${tableName} MOCK_QUERY`,
    _values: Object.values(data)
  })),
  _buildUpdateQuery: jest.fn().mockImplementation((tableName, data, whereCondition) => ({
    _query: `UPDATE ${tableName} MOCK_QUERY WHERE ${whereCondition}`,
    _values: Object.values(data)
  })),
  _buildRawInsertQuery: jest.fn().mockImplementation((tableName) => `INSERT INTO ${tableName} RAW_MOCK_QUERY`),
  _buildRawUpdateQuery: jest.fn().mockImplementation((tableName, data, whereCondition) =>
    `UPDATE ${tableName} RAW_MOCK_QUERY WHERE ${whereCondition}`
  ),
  _prepareSqlValues: jest.fn().mockImplementation((data) =>
    Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = `MOCK_${String(value)}`;
      return acc;
    }, {} as Record<string, string>)
  )
}));

// Mock db
import db from '@server/database';

// Test implementation of EnhancedBaseService
class TestService extends EnhancedBaseService {
  // Expose protected methods for testing
  public async testExecuteSqlWithFormatting<T>(
    _query: string,
    _params: any[] = [],
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.executeSqlWithFormatting(query, params, formatter);
  }

  public async testExecuteSqlWithMultipleResults<T>(
    _query: string,
    _params: any[] = [],
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T[]> {
    return this.executeSqlWithMultipleResults(query, params, formatter);
  }

  public async testInsertWithFormatting<T>(
    _tableName: string,
    _data: Record<string, any>,
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.insertWithFormatting(tableName, data, formatter);
  }

  public async testUpdateWithFormatting<T>(
    _tableName: string,
    _data: Record<string, any>,
    _whereCondition: string,
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.updateWithFormatting(tableName, data, whereCondition, formatter);
  }

  public async testRawInsertWithFormatting<T>(
    _tableName: string,
    _data: Record<string, any>,
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.rawInsertWithFormatting(tableName, data, formatter);
  }

  public async testRawUpdateWithFormatting<T>(
    _tableName: string,
    _data: Record<string, any>,
    _whereCondition: string,
    _formatter: (_row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.rawUpdateWithFormatting(tableName, data, whereCondition, formatter);
  }

  public testValidateAndPrepare<T, U>(
    _data: T,
    _validator: ZodSchema<U>,
    _preparer: (_data: U) => Record<string, any>
  ): Record<string, any> {
    return this.validateAndPrepare(data, validator, preparer);
  }

  public testHandleError(_error: any, _operation: string): never {
    return this.handleError(error, operation);
  }

  public testEnsureExists<T>(_result: T | null | undefined, _entityName: string): T {
    return this.ensureExists(result, entityName);
  }
}

describe('EnhancedBaseService', () => {
  let _service: TestService;

  beforeEach(() => {
    service = new TestService();
    jest.clearAllMocks();

    // Mock console.error to prevent test output noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('executeSqlWithFormatting', () => {
    it('should execute SQL query and format the first result', async() => {
      const mockRow = { _id: 1, _name: 'Test' };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });
      const expectedResult = { ...mockRow, _formatted: true };

      (db.execute as jest.Mock).mockResolvedValueOnce({ _rows: [mockRow] } as any);

      const result = await service.testExecuteSqlWithFormatting('SELECT * FROM test', [], mockFormatter);

      expect(db.execute).toHaveBeenCalledWith('SELECT * FROM test', []);
      expect(result).toEqual(expectedResult);
    });

    it('should return null when no rows are returned', async() => {
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });

      (db.execute as jest.Mock).mockResolvedValueOnce({ _rows: [] } as any);

      const result = await service.testExecuteSqlWithFormatting('SELECT * FROM test', [], mockFormatter);

      expect(result).toBeNull();
    });

    it('should handle database errors', async() => {
      const mockError = new Error('Database error');
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });

      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.testExecuteSqlWithFormatting('SELECT * FROM test', [], mockFormatter))
        .rejects.toThrow(AppError);
    });
  });

  describe('executeSqlWithMultipleResults', () => {
    it('should execute SQL query and format multiple results', async() => {
      const mockRows = [{ _id: 1, _name: 'Test 1' }, { _id: 2, _name: 'Test 2' }];
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });
      const expectedResults = mockRows.map(row => ({ ...row, _formatted: true }));

      (db.execute as jest.Mock).mockResolvedValueOnce({ _rows: mockRows } as any);

      const results = await service.testExecuteSqlWithMultipleResults('SELECT * FROM test', [], mockFormatter);

      expect(db.execute).toHaveBeenCalledWith('SELECT * FROM test', []);
      expect(results).toEqual(expectedResults);
    });

    it('should return empty array when no rows are returned', async() => {
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });

      (db.execute as jest.Mock).mockResolvedValueOnce({ _rows: [] } as any);

      const results = await service.testExecuteSqlWithMultipleResults('SELECT * FROM test', [], mockFormatter);

      expect(results).toEqual([]);
    });

    it('should handle database errors', async() => {
      const mockError = new Error('Database error');
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });

      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.testExecuteSqlWithMultipleResults('SELECT * FROM test', [], mockFormatter))
        .rejects.toThrow(AppError);
    });
  });

  describe('insertWithFormatting', () => {
    it('should build and execute an INSERT query', async() => {
      const mockData = { _name: 'Test', _active: true };
      const mockRow = { _id: 1, ...mockData };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });

      (db.execute as jest.Mock).mockResolvedValueOnce({ _rows: [mockRow] } as any);

      await service.testInsertWithFormatting('test_table', mockData, mockFormatter);

      expect(db.execute).toHaveBeenCalledWith('INSERT INTO test_table MOCK_QUERY', ['Test', true]);
    });

    it('should handle database errors', async() => {
      const mockError = new Error('Database error');
      const mockData = { _name: 'Test' };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });

      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.testInsertWithFormatting('test_table', mockData, mockFormatter))
        .rejects.toThrow(AppError);
    });
  });

  describe('updateWithFormatting', () => {
    it('should build and execute an UPDATE query', async() => {
      const mockData = { _name: 'Updated Test' };
      const mockRow = { _id: 1, ...mockData };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });
      const whereCondition = 'id = 1';

      (db.execute as jest.Mock).mockResolvedValueOnce({ _rows: [mockRow] } as any);

      await service.testUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter);

      expect(db.execute).toHaveBeenCalledWith('UPDATE test_table MOCK_QUERY WHERE id
   =  1', ['Updated Test']);
    });

    it('should handle database errors', async() => {
      const mockError = new Error('Database error');
      const mockData = { _name: 'Updated Test' };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });
      const whereCondition = 'id = 1';

      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.testUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter))
        .rejects.toThrow(AppError);
    });
  });

  describe('rawInsertWithFormatting', () => {
    it('should build and execute a raw INSERT query', async() => {
      const mockData = { _name: 'Test', _active: true };
      const mockRow = { _id: 1, ...mockData };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });

      (db.execute as jest.Mock).mockResolvedValueOnce({ _rows: [mockRow] } as any);

      await service.testRawInsertWithFormatting('test_table', mockData, mockFormatter);

      expect(db.execute).toHaveBeenCalledWith('INSERT INTO test_table RAW_MOCK_QUERY', []);
    });

    it('should handle database errors', async() => {
      const mockError = new Error('Database error');
      const mockData = { _name: 'Test' };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });

      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.testRawInsertWithFormatting('test_table', mockData, mockFormatter))
        .rejects.toThrow(AppError);
    });
  });

  describe('rawUpdateWithFormatting', () => {
    it('should build and execute a raw UPDATE query', async() => {
      const mockData = { _name: 'Updated Test' };
      const mockRow = { _id: 1, ...mockData };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });
      const whereCondition = 'id = 1';

      (db.execute as jest.Mock).mockResolvedValueOnce({ _rows: [mockRow] } as any);

      await service.testRawUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter);

      expect(db.execute).toHaveBeenCalledWith('UPDATE test_table RAW_MOCK_QUERY WHERE id = 1', []);
    });

    it('should handle database errors', async() => {
      const mockError = new Error('Database error');
      const mockData = { _name: 'Updated Test' };
      const mockFormatter = (_row: any) => ({ ...row, _formatted: true });
      const whereCondition = 'id = 1';

      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.testRawUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter))
        .rejects.toThrow(AppError);
    });
  });

  describe('validateAndPrepare', () => {
    it('should validate and prepare data using Zod schema', () => {
      const mockData = { _name: 'Test', _age: 30 };
      const mockSchema = z.object({
        _name: z.string(),
        _age: z.number()
      });
      const mockPreparer = (_data: any) => ({ ...data, _prepared: true });

      const result = service.testValidateAndPrepare(mockData, mockSchema, mockPreparer);

      expect(result).toEqual({ ...mockData, _prepared: true });
    });

    it('should throw AppError for validation errors', () => {
      const mockData = { _name: 'Test', _age: 'thirty' }; // age should be a number
      const mockSchema = z.object({
        _name: z.string(),
        _age: z.number()
      });
      const mockPreparer = (_data: any) => ({ ...data, _prepared: true });

      expect(() => service.testValidateAndPrepare(mockData, mockSchema, mockPreparer))
        .toThrow(AppError);
    });
  });

  describe('handleError', () => {
    it('should wrap errors with AppError', () => {
      const originalError = new Error('Test error');

      try {
        service.testHandleError(originalError, 'test operation');
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
        expect((error as AppError).message).toContain('test operation');
      }
    });

    it('should pass through AppError instances', () => {
      const originalError = new AppError('Not found', 'NOT_FOUND', ErrorCode.NOT_FOUND);

      try {
        service.testHandleError(originalError, 'test operation');
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBe(originalError);
      }
    });
  });

  describe('ensureExists', () => {
    it('should return the value if it exists', () => {
      const value = { _id: 1, _name: 'Test' };
      expect(service.testEnsureExists(value, 'Entity')).toBe(value);
    });

    it('should throw NOT_FOUND AppError if value is null', () => {
      try {
        service.testEnsureExists(null, 'Entity');
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.NOT_FOUND);
        expect((error as AppError).message).toBe('Entity not found');
      }
    });

    it('should throw NOT_FOUND AppError if value is undefined', () => {
      try {
        service.testEnsureExists(undefined, 'Entity');
        // Should not reach this line
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.NOT_FOUND);
        expect((error as AppError).message).toBe('Entity not found');
      }
    });
  });
});
