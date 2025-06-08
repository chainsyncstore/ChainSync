/**
 * Unit tests for the EnhancedBaseService
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedBaseService } from '@server/services/base/enhanced-service';
import { DatabaseConnection } from '@shared/types/common'; // Import DatabaseConnection
import { AppError } from '@shared/types/errors';
import { ErrorCode } from '@shared/types/errors';
import { ZodSchema, z } from 'zod';

// Mock dependencies
// Rely on global mock from setupFilesAfterEnv.ts for @server/database
// jest.mock('@server/database', () => ({
//   __esModule: true,
//   default: { // This mocks a default export
//     execute: jest.fn()
//   }
// }));

// jest.mock('drizzle-orm', ...) // This mock is now global in setup-test-env.ts

jest.mock('@shared/utils/sql-helpers', () => ({
  buildInsertQuery: jest.fn().mockImplementation((tableName, data) => ({
    query: `INSERT INTO ${tableName} MOCK_QUERY`,
    values: Object.values(data as any),
  })),
  buildUpdateQuery: jest.fn().mockImplementation((tableName, data, whereCondition) => ({
    query: `UPDATE ${tableName} MOCK_QUERY WHERE ${whereCondition}`,
    values: Object.values(data as any),
  })),
  buildRawInsertQuery: jest
    .fn()
    .mockImplementation(tableName => `INSERT INTO ${tableName} RAW_MOCK_QUERY`),
  buildRawUpdateQuery: jest
    .fn()
    .mockImplementation(
      (tableName, data, whereCondition) =>
        `UPDATE ${tableName} RAW_MOCK_QUERY WHERE ${whereCondition}`
    ),
  prepareSqlValues: jest.fn().mockImplementation(data =>
    Object.entries(data as any).reduce(
      (acc, [key, value]) => {
        acc[key] = `MOCK_${String(value)}`;
        return acc;
      },
      {} as Record<string, string>
    )
  ),
}));

// Import the server/database module as a namespace
import * as ServerDatabase from '@server/database';
// const { db } = ServerDatabase; // We will use ServerDatabase.db directly

// Test implementation of EnhancedBaseService
class TestService extends EnhancedBaseService {
  // Expose protected methods for testing
  public async testExecuteSqlWithFormatting<T>(
    query: string,
    params: any[] = [],
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.executeSqlWithFormatting(query, params, formatter);
  }

  public async testExecuteSqlWithMultipleResults<T>(
    query: string,
    params: any[] = [],
    formatter: (row: Record<string, any>) => T
  ): Promise<T[]> {
    return this.executeSqlWithMultipleResults(query, params, formatter);
  }

  public async testInsertWithFormatting<T>(
    tableName: string,
    data: Record<string, any>,
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.insertWithFormatting(tableName, data, formatter);
  }

  public async testUpdateWithFormatting<T>(
    tableName: string,
    data: Record<string, any>,
    whereCondition: string,
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.updateWithFormatting(tableName, data, whereCondition, formatter);
  }

  public async testRawInsertWithFormatting<T>(
    tableName: string,
    data: Record<string, any>,
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.rawInsertWithFormatting(tableName, data, formatter);
  }

  public async testRawUpdateWithFormatting<T>(
    tableName: string,
    data: Record<string, any>,
    whereCondition: string,
    formatter: (row: Record<string, any>) => T
  ): Promise<T | null> {
    return this.rawUpdateWithFormatting(tableName, data, whereCondition, formatter);
  }

  public testValidateAndPrepare<T, U>(
    data: T,
    validator: ZodSchema<U>,
    preparer: (data: U) => Record<string, any>
  ): Record<string, any> {
    return this.validateAndPrepare(data, validator, preparer);
  }

  public testHandleError(error: any, operation: string): never {
    return this.handleError(error, operation);
  }

  public testEnsureExists<T>(result: T | null | undefined, entityName: string): T {
    return this.ensureExists(result, entityName);
  }
}

describe('EnhancedBaseService', () => {
  let service: TestService;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks before each test

    // db is now the globally mocked instance
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    service = new TestService({
      db: ServerDatabase.db as unknown as DatabaseConnection, // Use ServerDatabase.db directly, cast to DatabaseConnection more permissively
      logger: mockLogger,
    });

    // Ensure ServerDatabase.db.execute is a Jest mock function for this test's context.
    // This is a workaround/diagnostic for the persistent TypeError.
    if (!jest.isMockFunction(ServerDatabase.db.execute)) {
      // If it's not a mock function (e.g., if the global mock isn't applying as expected here),
      // replace it with a Jest mock function for the scope of these tests.
      ServerDatabase.db.execute = jest.fn() as any; // Use 'as any' to assign to potentially readonly property
    }

    // The explicit db.execute.mockClear() is removed as jest.clearAllMocks() should handle it.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('executeSqlWithFormatting', () => {
    it('should execute SQL query and format the first result', async () => {
      const mockRow = { id: 1, name: 'Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const expectedResult = { ...mockRow, formatted: true };

      const executeMock = ServerDatabase.db.execute as jest.Mock<any>;
      executeMock.mockResolvedValueOnce({ rows: [mockRow] } as any);

      const result = await service.testExecuteSqlWithFormatting(
        'SELECT * FROM test',
        [],
        mockFormatter
      );

      console.log('ServerDatabase.db.execute calls:', executeMock.mock.calls); // Log calls

      expect(executeMock).toHaveBeenCalledWith(expect.any(Object));
      expect(result).toEqual(expectedResult);
    });

    it('should return null when no rows are returned', async () => {
      const mockFormatter = (row: any) => ({ ...row, formatted: true });

      (ServerDatabase.db.execute as jest.Mock<any>).mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.testExecuteSqlWithFormatting(
        'SELECT * FROM test',
        [],
        mockFormatter
      );

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockFormatter = (row: any) => ({ ...row, formatted: true });

      (ServerDatabase.db.execute as jest.Mock<any>).mockRejectedValueOnce(mockError);

      await expect(
        service.testExecuteSqlWithFormatting('SELECT * FROM test', [], mockFormatter)
      ).rejects.toThrow(AppError);
    });
  });

  describe('executeSqlWithMultipleResults', () => {
    it('should execute SQL query and format multiple results', async () => {
      const mockRows = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
      ];
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const expectedResults = mockRows.map(row => ({ ...row, formatted: true }));

      (ServerDatabase.db.execute as jest.Mock<any>).mockResolvedValueOnce({
        rows: mockRows,
      } as never);

      const results = await service.testExecuteSqlWithMultipleResults(
        'SELECT * FROM test',
        [],
        mockFormatter
      );

      expect(ServerDatabase.db.execute).toHaveBeenCalledWith(expect.any(Object));
      expect(results).toEqual(expectedResults);
    });

    it('should return empty array when no rows are returned', async () => {
      const mockFormatter = (row: any) => ({ ...row, formatted: true });

      (ServerDatabase.db.execute as jest.Mock<any>).mockResolvedValueOnce({ rows: [] } as any);

      const results = await service.testExecuteSqlWithMultipleResults(
        'SELECT * FROM test',
        [],
        mockFormatter
      );

      expect(results).toEqual([]);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockFormatter = (row: any) => ({ ...row, formatted: true });

      (ServerDatabase.db.execute as jest.Mock<any>).mockRejectedValueOnce(mockError);

      await expect(
        service.testExecuteSqlWithMultipleResults('SELECT * FROM test', [], mockFormatter)
      ).rejects.toThrow(AppError);
    });
  });

  describe('insertWithFormatting', () => {
    it('should build and execute an INSERT query', async () => {
      const mockData = { name: 'Test', active: true };
      const mockRow = { id: 1, ...mockData };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });

      (ServerDatabase.db.execute as jest.Mock<any>).mockResolvedValueOnce({
        rows: [mockRow],
      } as any);

      await service.testInsertWithFormatting('test_table', mockData, mockFormatter);

      // The sql-helpers mock returns { query: string, values: any[] }
      // If EnhancedBaseService uses this to call db.execute(sql.raw(query), values),
      // then the assertion needs to match that.
      // However, the runtime error showed db.execute gets a single SQL object.
      expect(ServerDatabase.db.execute).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockData = { name: 'Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });

      (ServerDatabase.db.execute as jest.Mock<any>).mockRejectedValueOnce(mockError);

      await expect(
        service.testInsertWithFormatting('test_table', mockData, mockFormatter)
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateWithFormatting', () => {
    it('should build and execute an UPDATE query', async () => {
      const mockData = { name: 'Updated Test' };
      const mockRow = { id: 1, ...mockData };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const whereCondition = 'id = 1';

      (ServerDatabase.db.execute as jest.Mock<any>).mockResolvedValueOnce({
        rows: [mockRow],
      } as any);

      await service.testUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter);

      expect(ServerDatabase.db.execute).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockData = { name: 'Updated Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const whereCondition = 'id = 1';

      (ServerDatabase.db.execute as jest.Mock<any>).mockRejectedValueOnce(mockError);

      await expect(
        service.testUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter)
      ).rejects.toThrow(AppError);
    });
  });

  describe('rawInsertWithFormatting', () => {
    it('should build and execute a raw INSERT query', async () => {
      const mockData = { name: 'Test', active: true };
      const mockRow = { id: 1, ...mockData };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });

      (ServerDatabase.db.execute as jest.Mock<any>).mockResolvedValueOnce({
        rows: [mockRow],
      } as any);

      await service.testRawInsertWithFormatting('test_table', mockData, mockFormatter);

      expect(ServerDatabase.db.execute).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockData = { name: 'Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });

      (ServerDatabase.db.execute as jest.Mock<any>).mockRejectedValueOnce(mockError);

      await expect(
        service.testRawInsertWithFormatting('test_table', mockData, mockFormatter)
      ).rejects.toThrow(AppError);
    });
  });

  describe('rawUpdateWithFormatting', () => {
    it('should build and execute a raw UPDATE query', async () => {
      const mockData = { name: 'Updated Test' };
      const mockRow = { id: 1, ...mockData };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const whereCondition = 'id = 1';

      (ServerDatabase.db.execute as jest.Mock<any>).mockResolvedValueOnce({
        rows: [mockRow],
      } as any);

      await service.testRawUpdateWithFormatting(
        'test_table',
        mockData,
        whereCondition,
        mockFormatter
      );

      expect(ServerDatabase.db.execute).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockData = { name: 'Updated Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const whereCondition = 'id = 1';

      (ServerDatabase.db.execute as jest.Mock<any>).mockRejectedValueOnce(mockError);

      await expect(
        service.testRawUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter)
      ).rejects.toThrow(AppError);
    });
  });

  describe('validateAndPrepare', () => {
    it('should validate and prepare data using Zod schema', () => {
      const mockData = { name: 'Test', age: 30 };
      const mockSchema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const mockPreparer = (data: any) => ({ ...data, prepared: true });

      const result = service.testValidateAndPrepare(mockData, mockSchema, mockPreparer);

      expect(result).toEqual({ ...mockData, prepared: true });
    });

    it('should throw AppError for validation errors', () => {
      const mockData = { name: 'Test', age: 'thirty' }; // age should be a number
      const mockSchema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const mockPreparer = (data: any) => ({ ...data, prepared: true });

      expect(() => service.testValidateAndPrepare(mockData, mockSchema, mockPreparer)).toThrow(
        AppError
      );
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
      const value = { id: 1, name: 'Test' };
      expect(service.testEnsureExists(value, 'Entity')).toBe(value);
    });

    it('should throw NOT_FOUND AppError if value is null', () => {
      try {
        service.testEnsureExists(null as any, 'Entity');
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
        service.testEnsureExists(undefined as any, 'Entity');
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
