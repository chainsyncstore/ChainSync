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
  default: {
    execute: jest.fn()
  }
}));

jest.mock('drizzle-orm', () => ({
  sql: {
    raw: (query: string) => query
  }
}));

jest.mock('@shared/utils/sql-helpers', () => ({
  buildInsertQuery: jest.fn().mockImplementation((tableName, data) => ({
    query: `INSERT INTO ${tableName} MOCK_QUERY`,
    values: Object.values(data)
  })),
  buildUpdateQuery: jest.fn().mockImplementation((tableName, data, whereCondition) => ({
    query: `UPDATE ${tableName} MOCK_QUERY WHERE ${whereCondition}`,
    values: Object.values(data)
  })),
  buildRawInsertQuery: jest.fn().mockImplementation((tableName) => `INSERT INTO ${tableName} RAW_MOCK_QUERY`),
  buildRawUpdateQuery: jest.fn().mockImplementation((tableName, data, whereCondition) => 
    `UPDATE ${tableName} RAW_MOCK_QUERY WHERE ${whereCondition}`
  ),
  prepareSqlValues: jest.fn().mockImplementation((data) => 
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
    service = new TestService();
    jest.clearAllMocks();
    
    // Mock console.error to prevent test output noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  describe('executeSqlWithFormatting', () => {
    it('should execute SQL query and format the first result', async () => {
      const mockRow = { id: 1, name: 'Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const expectedResult = { ...mockRow, formatted: true };
      
      (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] } as any);
      
      const result = await service.testExecuteSqlWithFormatting('SELECT * FROM test', [], mockFormatter);
      
      expect(db.execute).toHaveBeenCalledWith('SELECT * FROM test', []);
      expect(result).toEqual(expectedResult);
    });
    
    it('should return null when no rows are returned', async () => {
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      
      (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [] } as any);
      
      const result = await service.testExecuteSqlWithFormatting('SELECT * FROM test', [], mockFormatter);
      
      expect(result).toBeNull();
    });
    
    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      
      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);
      
      await expect(service.testExecuteSqlWithFormatting('SELECT * FROM test', [], mockFormatter))
        .rejects.toThrow(AppError);
    });
  });
  
  describe('executeSqlWithMultipleResults', () => {
    it('should execute SQL query and format multiple results', async () => {
      const mockRows = [{ id: 1, name: 'Test 1' }, { id: 2, name: 'Test 2' }];
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const expectedResults = mockRows.map(row => ({ ...row, formatted: true }));
      
      (db.execute as jest.Mock).mockResolvedValueOnce({ rows: mockRows } as any);
      
      const results = await service.testExecuteSqlWithMultipleResults('SELECT * FROM test', [], mockFormatter);
      
      expect(db.execute).toHaveBeenCalledWith('SELECT * FROM test', []);
      expect(results).toEqual(expectedResults);
    });
    
    it('should return empty array when no rows are returned', async () => {
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      
      (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [] } as any);
      
      const results = await service.testExecuteSqlWithMultipleResults('SELECT * FROM test', [], mockFormatter);
      
      expect(results).toEqual([]);
    });
    
    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      
      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);
      
      await expect(service.testExecuteSqlWithMultipleResults('SELECT * FROM test', [], mockFormatter))
        .rejects.toThrow(AppError);
    });
  });
  
  describe('insertWithFormatting', () => {
    it('should build and execute an INSERT query', async () => {
      const mockData = { name: 'Test', active: true };
      const mockRow = { id: 1, ...mockData };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      
      (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] } as any);
      
      await service.testInsertWithFormatting('test_table', mockData, mockFormatter);
      
      expect(db.execute).toHaveBeenCalledWith('INSERT INTO test_table MOCK_QUERY', ['Test', true]);
    });
    
    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockData = { name: 'Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      
      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);
      
      await expect(service.testInsertWithFormatting('test_table', mockData, mockFormatter))
        .rejects.toThrow(AppError);
    });
  });
  
  describe('updateWithFormatting', () => {
    it('should build and execute an UPDATE query', async () => {
      const mockData = { name: 'Updated Test' };
      const mockRow = { id: 1, ...mockData };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const whereCondition = 'id = 1';
      
      (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] } as any);
      
      await service.testUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter);
      
      expect(db.execute).toHaveBeenCalledWith('UPDATE test_table MOCK_QUERY WHERE id = 1', ['Updated Test']);
    });
    
    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockData = { name: 'Updated Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const whereCondition = 'id = 1';
      
      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);
      
      await expect(service.testUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter))
        .rejects.toThrow(AppError);
    });
  });
  
  describe('rawInsertWithFormatting', () => {
    it('should build and execute a raw INSERT query', async () => {
      const mockData = { name: 'Test', active: true };
      const mockRow = { id: 1, ...mockData };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      
      (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] } as any);
      
      await service.testRawInsertWithFormatting('test_table', mockData, mockFormatter);
      
      expect(db.execute).toHaveBeenCalledWith('INSERT INTO test_table RAW_MOCK_QUERY', []);
    });
    
    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockData = { name: 'Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      
      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);
      
      await expect(service.testRawInsertWithFormatting('test_table', mockData, mockFormatter))
        .rejects.toThrow(AppError);
    });
  });
  
  describe('rawUpdateWithFormatting', () => {
    it('should build and execute a raw UPDATE query', async () => {
      const mockData = { name: 'Updated Test' };
      const mockRow = { id: 1, ...mockData };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const whereCondition = 'id = 1';
      
      (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] } as any);
      
      await service.testRawUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter);
      
      expect(db.execute).toHaveBeenCalledWith('UPDATE test_table RAW_MOCK_QUERY WHERE id = 1', []);
    });
    
    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      const mockData = { name: 'Updated Test' };
      const mockFormatter = (row: any) => ({ ...row, formatted: true });
      const whereCondition = 'id = 1';
      
      (db.execute as jest.Mock).mockRejectedValueOnce(mockError);
      
      await expect(service.testRawUpdateWithFormatting('test_table', mockData, whereCondition, mockFormatter))
        .rejects.toThrow(AppError);
    });
  });
  
  describe('validateAndPrepare', () => {
    it('should validate and prepare data using Zod schema', () => {
      const mockData = { name: 'Test', age: 30 };
      const mockSchema = z.object({
        name: z.string(),
        age: z.number()
      });
      const mockPreparer = (data: any) => ({ ...data, prepared: true });
      
      const result = service.testValidateAndPrepare(mockData, mockSchema, mockPreparer);
      
      expect(result).toEqual({ ...mockData, prepared: true });
    });
    
    it('should throw AppError for validation errors', () => {
      const mockData = { name: 'Test', age: 'thirty' }; // age should be a number
      const mockSchema = z.object({
        name: z.string(),
        age: z.number()
      });
      const mockPreparer = (data: any) => ({ ...data, prepared: true });
      
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
      const value = { id: 1, name: 'Test' };
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
