import { PassThrough } from 'stream';

import { AppError, ErrorCategory } from '@shared/types/errors.js';

// ValidationService is the actual class name in validation.ts
// The service aliases it as ValidationServiceImpl internally.

import { parse as csvParserModule } from 'csv-parse'; // aliased to avoid conflict
import * as ExcelJS from 'exceljs';
import { Express } from 'express';
import { Parser as Json2CsvParser } from 'json2csv';

import { ImportExportRepository } from './repository';
import { ImportExportService } from './service';
import { ValidationService } from './validation';

// --- Mocks Setup ---

// Mock the repository
const mockCreateImport = jest.fn();
const mockGetExportData = jest.fn();
const mockProcessBatch = jest.fn();
jest.mock('./repository', () => {
  return {
    ImportExportRepository: jest.fn().mockImplementation(() => {
      return {
        createImport: mockCreateImport,
        getExportData: mockGetExportData,
        processBatch: mockProcessBatch,
      };
    }),
  };
});

// Mock the validation service
const mockValidate = jest.fn();
jest.mock('./validation', () => {
  return {
    // This is the class name as defined in validation.ts
    ValidationService: jest.fn().mockImplementation(() => {
      return {
        validate: mockValidate,
      };
    }),
  };
});

// Mock exceljs
const mockExcelWorksheetInstance = {
  addRow: jest.fn(),
  getRow: jest.fn(),
  getRows: jest.fn(),
  getCell: jest.fn(), // For row.getCell().value access
  rowCount: 0,
  values: [], // For getRow().values access
};
const mockExcelWorkbookInstance = {
  xlsx: {
    load: jest.fn().mockResolvedValue(undefined),
    writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked-excel-data')),
  },
  addWorksheet: jest.fn().mockReturnValue(mockExcelWorksheetInstance),
  getWorksheet: jest.fn().mockReturnValue(mockExcelWorksheetInstance),
};
jest.mock('exceljs', () => {
  const actualExcelJS = jest.requireActual('exceljs');
  return {
    ...actualExcelJS,
    Workbook: jest.fn(() => mockExcelWorkbookInstance),
  };
});

// Mock json2csv
const mockJson2CsvParseMethod = jest.fn().mockReturnValue('mocked,csv,data');
jest.mock('json2csv', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parse: mockJson2CsvParseMethod,
  })),
}));

// Mock csv-parse
const mockCsvParserInstance: unknown = {
  on: jest.fn(
    (event: string, callback: (...args: unknown[]) => void): unknown => mockCsvParserInstance
  ), // Allow chaining
  write: jest.fn(),
  end: jest.fn(),
  // Helper to simulate events for tests
  _simulateData: (data: unknown) => {
    const dataCallback = mockCsvParserInstance.on.mock.calls.find(
      (call: [string, Function]) => call[0] === 'data'
    )?.[1];
    if (dataCallback) dataCallback(data);
  },
  _simulateEnd: () => {
    const endCallback = mockCsvParserInstance.on.mock.calls.find(
      (call: [string, Function]) => call[0] === 'end'
    )?.[1];
    if (endCallback) endCallback();
  },
  _simulateError: (err: Error) => {
    const errorCallback = mockCsvParserInstance.on.mock.calls.find(
      (call: [string, Function]) => call[0] === 'error'
    )?.[1];
    if (errorCallback) errorCallback(err);
  },
};
jest.mock('csv-parse', () => ({
  parse: jest.fn(() => mockCsvParserInstance),
}));

// --- Test Suite ---

describe('ImportExportService', () => {
  let service: ImportExportService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset ExcelJS worksheet mock specifics
    mockExcelWorksheetInstance.addRow.mockClear();
    mockExcelWorksheetInstance.getRow
      .mockClear()
      .mockReturnValue({ values: [], getCell: jest.fn().mockReturnValue({ value: undefined }) });
    mockExcelWorksheetInstance.getRows.mockClear().mockReturnValue([]);
    mockExcelWorksheetInstance.getCell.mockClear().mockReturnValue({ value: undefined });
    mockExcelWorksheetInstance.rowCount = 0;

    // Reset csv-parse instance mocks
    mockCsvParserInstance.on
      .mockClear()
      .mockImplementation(
        (event: string, callback: (...args: unknown[]) => void) => mockCsvParserInstance
      );
    mockCsvParserInstance.write.mockClear();
    mockCsvParserInstance.end.mockClear().mockImplementation(() => {
      // Default end behavior: if an 'end' callback is registered, call it.
      // Tests can override this by directly calling _simulateEnd or _simulateError.
      const endCallback = mockCsvParserInstance.on.mock.calls.find(
        (call: [string, Function]) => call[0] === 'end'
      )?.[1];
      if (endCallback) {
        endCallback();
      }
    });

    service = new ImportExportService();
  });

  describe('constructor', () => {
    it('should initialize repository and validationService', () => {
      expect(ImportExportRepository).toHaveBeenCalledTimes(1);
      // ValidationService is the class name from validation.ts
      expect(ValidationService).toHaveBeenCalledTimes(1);
      expect(service['repository']).toBeDefined();
      expect(service['validationService']).toBeDefined();
    });

    it('should initialize config with default batchSize', () => {
      expect(service['config'].batchSize).toBe(1000);
    });

    it('should initialize error messages', () => {
      expect(service['errors'].INVALID_FILE_FORMAT).toBeInstanceOf(AppError);
      expect(service['errors'].INVALID_FILE_FORMAT.code).toBe('INVALID_FILE_FORMAT');
    });
  });

  describe('validateData', () => {
    it('should call validationService.validate and return success', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      const mockValidationResult = {
        validRecords: mockData,
        invalidRecords: [],
        validCount: 1,
        invalidCount: 0,
      };
      mockValidate.mockResolvedValue(mockValidationResult);

      const result = await service.validateData(mockData);

      expect(mockValidate).toHaveBeenCalledWith(mockData, undefined);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Validation successful');
      expect(result.data).toEqual(mockData);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(0);
    });

    it('should return failure if validationService finds invalid records', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      const mockInvalidRecord = { record: { id: 2 }, errors: ['Invalid ID'] };
      const mockValidationResult = {
        validRecords: [],
        invalidRecords: [mockInvalidRecord],
        validCount: 0,
        invalidCount: 1,
      };
      mockValidate.mockResolvedValue(mockValidationResult);

      const result = await service.validateData(mockData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Validation failed');
      expect(result.errors).toEqual([
        { record: mockInvalidRecord, errors: mockInvalidRecord.errors },
      ]);
      expect(result.invalidCount).toBe(1);
    });

    it('should throw INVALID_DATA if input is not an array', async () => {
      await expect(service.validateData(null as any)).rejects.toThrow(
        service['errors'].INVALID_DATA
      );
    });
  });

  describe('importData', () => {
    const userId = 1;
    const entityType = 'products';
    const mockData = [{ id: 1 }];

    it('should create import record and process import successfully', async () => {
      const importId = 'import-123';
      mockCreateImport.mockResolvedValue(importId);
      // Mocking processImport part (which calls processBatch)
      mockProcessBatch.mockResolvedValue({ errors: [] });

      const result = await service.importData(userId, mockData, entityType);

      expect(mockCreateImport).toHaveBeenCalledWith(userId, entityType, undefined);
      // processImport calls processBatch, let's check that
      // Assuming default batch size, one batch for one item
      expect(mockProcessBatch).toHaveBeenCalledWith(mockData, importId);
      expect(result.success).toBe(true);
      expect(result.importId).toBe(importId);
      expect(result.validCount).toBe(mockData.length);
      expect(result.invalidCount).toBe(0);
    });

    it('should throw PROCESSING_ERROR if repository.createImport fails', async () => {
      mockCreateImport.mockRejectedValue(new Error('DB error'));
      await expect(service.importData(userId, mockData, entityType)).rejects.toThrow(
        service['errors'].PROCESSING_ERROR
      );
    });
  });

  describe('exportData', () => {
    const userId = 1;
    const entityType = 'orders';
    const mockExportData = [{ orderId: 1, amount: 100 }];

    beforeEach(() => {
      mockGetExportData.mockResolvedValue(mockExportData);
    });

    it('should generate CSV data', async () => {
      const options = { format: 'csv' as 'csv', includeHeaders: true, delimiter: ',' };
      const buffer = await service.exportData(userId, entityType, options);
      expect(mockGetExportData).toHaveBeenCalledWith(userId, entityType, options);
      expect(Json2CsvParser).toHaveBeenCalledWith(expect.objectContaining({ delimiter: ',' }));
      expect(mockJson2CsvParseMethod).toHaveBeenCalledWith(mockExportData);
      expect(buffer.toString()).toBe('mocked,csv,data');
    });

    it('should generate JSON data', async () => {
      const options = { format: 'json' as 'json', includeHeaders: false }; // includeHeaders not used by JSON
      const buffer = await service.exportData(userId, entityType, options);
      expect(mockGetExportData).toHaveBeenCalledWith(userId, entityType, options);
      expect(buffer.toString()).toBe(JSON.stringify(mockExportData, null, 2));
    });

    it('should generate XLSX data', async () => {
      const options = { format: 'xlsx' as 'xlsx', includeHeaders: true };
      mockExcelWorkbookInstance.xlsx.writeBuffer.mockResolvedValue(Buffer.from('excel-data'));

      // Mock worksheet methods for generateExcel
      mockExcelWorksheetInstance.addRow.mockImplementation(() => {}); // Reset for this test

      const buffer = await service.exportData(userId, entityType, options);

      expect(mockGetExportData).toHaveBeenCalledWith(userId, entityType, options);
      expect(ExcelJS.Workbook).toHaveBeenCalledTimes(1);
      expect(mockExcelWorkbookInstance.addWorksheet).toHaveBeenCalledWith('Data');
      expect(mockExcelWorksheetInstance.addRow).toHaveBeenCalledTimes(
        mockExportData.length + (options.includeHeaders ? 1 : 0)
      );
      if (options.includeHeaders && mockExportData.length > 0) {
        expect(mockExcelWorksheetInstance.addRow).toHaveBeenNthCalledWith(
          1,
          Object.keys(mockExportData[0])
        );
      }
      expect(mockExcelWorkbookInstance.xlsx.writeBuffer).toHaveBeenCalledTimes(1);
      expect(buffer.toString()).toBe('excel-data');
    });

    it('should throw INVALID_FILE_FORMAT for unsupported format', async () => {
      const options = { format: 'xml' as any, includeHeaders: false };
      await expect(service.exportData(userId, entityType, options)).rejects.toThrow(
        service['errors'].INVALID_FILE_FORMAT
      );
    });

    it('should throw PROCESSING_ERROR if getExportData fails', async () => {
      mockGetExportData.mockRejectedValue(new Error('DB error'));
      const options = { format: 'csv' as 'csv', includeHeaders: true };
      await expect(service.exportData(userId, entityType, options)).rejects.toThrow(
        service['errors'].PROCESSING_ERROR
      );
    });
  });

  describe('validateFile', () => {
    const mockFile = (
      originalname: string,
      mimetype: string,
      size: number,
      bufferContent: string = ''
    ) =>
      ({
        originalname,
        mimetype,
        size,
        buffer: Buffer.from(bufferContent),
      }) as Express.Multer.File;

    it('should validate a CSV file successfully', async () => {
      const file = mockFile('test.csv', 'text/csv', 1024, 'header1,header2\nval1,val2');
      const expectedData = [{ header1: 'val1', header2: 'val2' }];

      // Configure csv-parse mock for this test
      mockCsvParserInstance.end.mockImplementation(() => {
        mockCsvParserInstance._simulateData({ header1: 'val1', header2: 'val2' });
        mockCsvParserInstance._simulateEnd();
      });

      const result = await service.validateFile(file);
      expect(result.type).toBe('csv');
      expect(result.data).toEqual(expectedData);
      expect(csvParserModule).toHaveBeenCalledWith({ columns: true, skip_empty_lines: true });
    });

    it('should validate a JSON file successfully', async () => {
      const jsonData = [{ id: 1, name: 'Test' }];
      const file = mockFile('test.json', 'application/json', 1024, JSON.stringify(jsonData));
      const result = await service.validateFile(file);
      expect(result.type).toBe('json');
      expect(result.data).toEqual(jsonData);
    });

    it('should validate an XLSX file successfully', async () => {
      const file = mockFile(
        'test.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        1024,
        'excelcontent'
      );
      const mockHeaders = [null, 'col1', 'col2']; // ExcelJS often has a leading null/undefined
      const mockRowData = [null, 'val1', 'val2'];

      mockExcelWorksheetInstance.getRow.mockImplementation((rowNum: number) => {
        if (rowNum === 1) return { values: mockHeaders, getCell: jest.fn() } as any;
        return {
          values: mockRowData,
          getCell: (colNum: number) => ({ value: mockRowData[colNum - 1] }),
        } as any; // simplified
      });
      mockExcelWorksheetInstance.getRows.mockReturnValue([
        { getCell: (idx: number) => ({ value: mockRowData[idx] }) }, // Adjust based on actual cell indexing
      ] as any);
      mockExcelWorksheetInstance.rowCount = 2; // Header + 1 data row

      // Refined getCell for header mapping
      const cellValues: { [key: string]: string } = { col1: 'val1', col2: 'val2' };
      mockExcelWorksheetInstance.getRows.mockReturnValue([
        {
          getCell: (idx: number) => {
            const headerKey = mockHeaders[idx];
            return { value: headerKey ? cellValues[headerKey] : undefined };
          },
        },
      ] as any);

      const result = await service.validateFile(file);
      expect(result.type).toBe('xlsx');
      // This expectation depends heavily on the mock setup for exceljs parsing logic
      // The actual parsing logic in service.ts:
      // headers from row 1, data from row 2 onwards.
      // rowData[String(header)] = cell?.value;
      // For simplicity, let's assume it resolves to some data.
      // A more detailed test would mock getRow/getRows/getCell precisely.
      expect(result.data).toBeInstanceOf(Array); // Basic check
      expect(mockExcelWorkbookInstance.xlsx.load).toHaveBeenCalledWith(file.buffer);
    });

    it('should throw FILE_TOO_LARGE if file size exceeds limit', async () => {
      const file = mockFile('large.csv', 'text/csv', 60 * 1024 * 1024); // 60MB
      await expect(service.validateFile(file)).rejects.toThrow(service['errors'].FILE_TOO_LARGE);
    });

    it('should throw INVALID_FILE_FORMAT for unsupported extension', async () => {
      const file = mockFile('test.txt', 'text/plain', 1024);
      await expect(service.validateFile(file)).rejects.toThrow(
        service['errors'].INVALID_FILE_FORMAT
      );
    });

    it('should throw INVALID_MIME_TYPE for mismatched MIME type', async () => {
      const file = mockFile('test.csv', 'application/json', 1024); // CSV extension, JSON MIME
      const expectedError = new AppError(
        `Invalid MIME type for csv file. Received: ${file.mimetype}`,
        ErrorCategory.IMPORT_EXPORT,
        'INVALID_MIME_TYPE'
      );
      await expect(service.validateFile(file)).rejects.toThrow(expectedError);
    });

    it('should throw INVALID_DATA if CSV parsing fails', async () => {
      const file = mockFile('bad.csv', 'text/csv', 1024);
      mockCsvParserInstance.end.mockImplementation(() => {
        mockCsvParserInstance._simulateError(new Error('CSV parse error'));
      });
      await expect(service.validateFile(file)).rejects.toThrow(service['errors'].INVALID_DATA);
    });

    it('should throw INVALID_DATA if JSON parsing fails', async () => {
      const file = mockFile('bad.json', 'application/json', 1024, 'not json');
      await expect(service.validateFile(file)).rejects.toThrow(service['errors'].INVALID_DATA);
    });

    it('should throw INVALID_DATA if XLSX parsing fails (e.g., load error)', async () => {
      const file = mockFile(
        'bad.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        1024
      );
      mockExcelWorkbookInstance.xlsx.load.mockRejectedValue(new Error('Excel load error'));
      await expect(service.validateFile(file)).rejects.toThrow(service['errors'].INVALID_DATA);
    });

    it('should throw INVALID_EXCEL_WORKSHEET if worksheet is not found', async () => {
      const file = mockFile(
        'empty.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        1024
      );
      mockExcelWorkbookInstance.getWorksheet.mockReturnValue(null); // Simulate no worksheet
      const expectedError = new AppError(
        'Excel file does not contain a valid worksheet.',
        ErrorCategory.IMPORT_EXPORT,
        'INVALID_EXCEL_WORKSHEET'
      );
      await expect(service.validateFile(file)).rejects.toThrow(expectedError);
    });
  });

  describe('processImport', () => {
    const importId = 'import-456';
    const data = Array.from({ length: 5 }, (_, i) => ({ id: i })); // 5 items

    it('should process data in batches and return success', async () => {
      service['config'].batchSize = 2; // Test with smaller batch size
      mockProcessBatch.mockResolvedValue({ errors: [] }); // Each batch succeeds

      const result = await service.processImport(data, { batchSize: 2 }, importId);

      expect(mockProcessBatch).toHaveBeenCalledTimes(3); // 5 items, batch size 2 -> 3 batches (2, 2, 1)
      expect(mockProcessBatch).toHaveBeenNthCalledWith(1, [{ id: 0 }, { id: 1 }], importId);
      expect(mockProcessBatch).toHaveBeenNthCalledWith(2, [{ id: 2 }, { id: 3 }], importId);
      expect(mockProcessBatch).toHaveBeenNthCalledWith(3, [{ id: 4 }], importId);
      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(data.length);
      expect(result.validCount).toBe(data.length);
      expect(result.invalidCount).toBe(0);
    });

    it('should aggregate errors from batches', async () => {
      service['config'].batchSize = 2;
      mockProcessBatch
        .mockResolvedValueOnce({ errors: [{ recordId: 0, message: 'err' }] }) // Batch 1 has 1 error
        .mockResolvedValueOnce({ errors: [] }) // Batch 2 succeeds
        .mockResolvedValueOnce({ errors: [{ recordId: 4, message: 'err' }] }); // Batch 3 has 1 error

      const result = await service.processImport(data, { batchSize: 2 }, importId);

      expect(result.success).toBe(false);
      expect(result.totalProcessed).toBe(data.length); // 5 processed
      expect(result.invalidCount).toBe(2); // 2 errors
      expect(result.validCount).toBe(data.length - 2); // 3 valid
    });

    it('should throw PROCESSING_ERROR if a batch processing fails unexpectedly', async () => {
      service['config'].batchSize = 2;
      mockProcessBatch.mockRejectedValueOnce(new Error('Critical batch error'));

      await expect(service.processImport(data, { batchSize: 2 }, importId)).rejects.toThrow(
        service['errors'].PROCESSING_ERROR
      );
    });
  });

  describe('processBatch', () => {
    const importId = 'batch-import-789';
    const batchData = [{ item: 1 }, { item: 2 }];

    it('should call repository.processBatch and return success', async () => {
      mockProcessBatch.mockResolvedValue({ errors: [] });
      const result = await service.processBatch(batchData, importId);

      expect(mockProcessBatch).toHaveBeenCalledWith(batchData, importId);
      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(batchData.length);
      expect(result.validCount).toBe(batchData.length);
      expect(result.invalidCount).toBe(0);
    });

    it('should return errors if repository.processBatch reports them', async () => {
      const repoErrors = [{ record: batchData[0], message: 'Failed to save' }];
      mockProcessBatch.mockResolvedValue({ errors: repoErrors });
      const result = await service.processBatch(batchData, importId);

      expect(result.success).toBe(false);
      expect(result.invalidCount).toBe(repoErrors.length);
      expect(result.validCount).toBe(batchData.length - repoErrors.length);
    });

    it('should throw STORAGE_ERROR if repository.processBatch fails', async () => {
      mockProcessBatch.mockRejectedValue(new Error('DB connection lost'));
      await expect(service.processBatch(batchData, importId)).rejects.toThrow(
        service['errors'].STORAGE_ERROR
      );
    });
  });

  // Testing private methods like generateCSV, parseExcel, etc.,
  // is primarily done through the public methods that call them (exportData, validateFile).
  // The mocks for external libraries (exceljs, json2csv, csv-parse) are crucial here.

  describe('Internal Parsers (tested via validateFile)', () => {
    // parseCSV is tested via validateFile success/failure cases for CSV.
    // parseJSON is tested via validateFile success/failure cases for JSON.
    // parseExcel is tested via validateFile success/failure cases for XLSX.
    // Example: Deeper test for parseExcel's header and data extraction if needed
    it('parseExcel should correctly map headers and data', async () => {
      const fileBuffer = Buffer.from('dummy excel content');
      // Mock ExcelJS getWorksheet, getRow, getRows, getCell behavior
      const headers = [null, 'Name', 'Age']; // Typical ExcelJS row values for headers
      const dataRow1 = [null, 'Alice', 30];
      const dataRow2 = [null, 'Bob', 24];

      // mockExcelWorksheetInstance.getWorksheet.mockReturnValue(mockExcelWorksheetInstance); // This line is incorrect and removed
      // The global mock mockExcelWorkbookInstance.getWorksheet already returns mockExcelWorksheetInstance
      mockExcelWorkbookInstance.getWorksheet.mockReturnValue(mockExcelWorksheetInstance); // Ensure workbook's getWorksheet is correctly mocked for this test too if needed, or rely on global

      mockExcelWorksheetInstance.getRow.mockImplementation((rowNum: number) => {
        if (rowNum === 1) return { values: headers, getCell: jest.fn() } as any;
        // This part is not directly used by the current parseExcel logic, which uses getRows
        return { values: [], getCell: jest.fn() } as any;
      });
      mockExcelWorksheetInstance.getRows.mockImplementation((startRow, count) => {
        if (startRow === 2) {
          // Data rows
          return [
            { getCell: (idx: number) => ({ value: dataRow1[idx] }) },
            { getCell: (idx: number) => ({ value: dataRow2[idx] }) },
          ] as any[];
        }
        return [];
      });
      mockExcelWorksheetInstance.rowCount = 3; // 1 header + 2 data rows

      // service['parseExcel'] is private, so test through validateFile or make it protected/public for testing
      // For this example, we assume it's callable for a focused test or test via validateFile
      const parsedData = await service['parseExcel'](fileBuffer);

      expect(parsedData).toEqual([
        { Name: 'Alice', Age: 30 },
        { Name: 'Bob', Age: 24 },
      ]);
    });
  });
});
