import { Request, Express } from 'express';
import * as multer from 'multer';
import { AppError, ErrorCategory } from '@shared/types/errors';
import { ImportExportConfig, ImportExportServiceErrors, ImportExportProgress, ImportExportResult, ImportExportOptions, ExportOptions, ValidationOptions } from './types';
import { ValidationService as ValidationServiceImpl } from './validation';
import { ImportExportRepository } from './repository';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Parser } from 'json2csv';
import { parse } from 'csv-parse';
import * as ExcelJS from 'exceljs';
// Import secure xlsx wrapper instead of direct xlsx import
import { SecureXlsx } from '../../utils/secure-xlsx';

// Helper function to chunk arrays
type Chunk<T> = T[][];

function chunkArray<T>(array: T[], size: number): Chunk<T> {
  if (!Array.isArray(array)) {
    throw new Error('Input must be an array');
  }
  if (typeof size !== 'number' || size <= 0) {
    throw new Error('Size must be a positive number');
  }

  return array.reduce((chunks, item, index) => {
    const chunkIndex = Math.floor(index / size);
    if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
    chunks[chunkIndex].push(item);
    return chunks;
  }, [] as Chunk<T>);
}

export class ImportExportService {
  private config: {
    batchSize: number;
  };

  private errors: {
    INVALID_FILE_FORMAT: AppError;
    FILE_TOO_LARGE: AppError;
    INVALID_DATA: AppError;
    PROCESSING_ERROR: AppError;
    STORAGE_ERROR: AppError;
    PROGRESS_ERROR: AppError;
  };

  private repository: ImportExportRepository;
  private validationService: ValidationServiceImpl;

  constructor() {
    this.config = {
      batchSize: 1000
    };

    this.errors = {
      INVALID_FILE_FORMAT: new AppError('Invalid file format', ErrorCategory.IMPORT_EXPORT, 'INVALID_FILE_FORMAT'),
      FILE_TOO_LARGE: new AppError('File size exceeds maximum allowed size', ErrorCategory.IMPORT_EXPORT, 'FILE_TOO_LARGE'),
      INVALID_DATA: new AppError('Invalid data format', ErrorCategory.IMPORT_EXPORT, 'INVALID_DATA'),
      PROCESSING_ERROR: new AppError('Processing failed', ErrorCategory.IMPORT_EXPORT, 'PROCESSING_ERROR'),
      STORAGE_ERROR: new AppError('Storage operation failed', ErrorCategory.IMPORT_EXPORT, 'STORAGE_ERROR'),
      PROGRESS_ERROR: new AppError('Progress tracking failed', ErrorCategory.IMPORT_EXPORT, 'PROGRESS_ERROR')
    };

    this.repository = new ImportExportRepository();
    this.validationService = new ValidationServiceImpl();
  }

  async validateData(data: unknown[], options?: ValidationOptions): Promise<{
    success: boolean;
    message: string;
    data?: unknown[];
    errors?: { record: unknown; errors: string[] }[];
    validCount: number;
    invalidCount: number;
    totalProcessed: number;
    totalErrors: number;
  }> {
    try {
      if (!Array.isArray(data)) {
        throw this.errors.INVALID_DATA;
      }

      const result = await this.validationService.validate(data, options);
      
      return {
        success: result.invalidCount === 0,
        message: result.invalidCount === 0 ? 'Validation successful' : 'Validation failed',
        data: result.validRecords,
        errors: result.invalidRecords.map((record, index) => ({ record, errors: result.invalidRecords[index].errors })),
        validCount: result.validCount,
        invalidCount: result.invalidCount,
        totalProcessed: result.validCount + result.invalidCount,
        totalErrors: result.invalidCount
      };
    } catch (error: unknown) {
      throw this.errors.INVALID_DATA;
    }
  }

  async importData(userId: number, data: unknown[], entityType: string, options?: {
    batchSize?: number;
    delimiter?: string;
    includeHeaders?: boolean;
    format?: string;
    filters?: Record<string, any>;
  }): Promise<{
    success: boolean;
    message: string;
    data?: unknown[];
    errors?: unknown[];
    validCount: number;
    invalidCount: number;
    totalProcessed: number;
    totalErrors: number;
    importId?: string;
  }> {
    try {
      const importId = await this.repository.createImport(userId, entityType, options);
      
      return await this.processImport(data, options || {}, importId); // Provide default for options
    } catch (error: unknown) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  async exportData(userId: number, entityType: string, options: ExportOptions): Promise<Buffer> {
    try {
      const data = await this.repository.getExportData(userId, entityType, options);
      
      switch (options.format) {
        case 'csv':
          return await this.generateCSV(data, options);
        case 'json':
          return await this.generateJSON(data);
        case 'xlsx':
          return await this.generateExcel(data, options);
        default:
          throw this.errors.INVALID_FILE_FORMAT;
      }
    } catch (error: unknown) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  async validateFile(file: Express.Multer.File): Promise<{ type: string; data: unknown[] }> {
    try {
      // Check file size
      if (file.size > 50 * 1024 * 1024) { // 50MB
        throw this.errors.FILE_TOO_LARGE;
      }

      // Check file format and MIME type
      const extension = file.originalname.split('.').pop()?.toLowerCase();
      const validFormats = ['csv', 'json', 'xlsx'];
      if (!validFormats.includes(extension || '')) {
        throw this.errors.INVALID_FILE_FORMAT;
      }

      // MIME type validation
      const allowedMimeTypes: Record<string, string[]> = {
        csv: ['text/csv', 'application/csv'],
        json: ['application/json'],
        xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
      };

      if (extension && allowedMimeTypes[extension] && !allowedMimeTypes[extension].includes(file.mimetype)) {
        throw new AppError(
          `Invalid MIME type for ${extension} file. Received: ${file.mimetype}`,
          ErrorCategory.IMPORT_EXPORT,
          'INVALID_MIME_TYPE'
        );
      }

      let parsedData: unknown[] = [];

      switch (extension) {
        case 'csv':
          parsedData = await this.parseCSV(file.buffer);
          break;
        case 'json':
          parsedData = await this.parseJSON(file.buffer);
          break;
        case 'xlsx':
          parsedData = await this.parseExcel(file.buffer);
          break;
        default:
          throw this.errors.INVALID_FILE_FORMAT;
      }

      return {
        type: extension || '',
        data: parsedData
      };
    } catch (error: unknown) {
      throw this.errors.INVALID_DATA;
    }
  }

  async processImport(data: unknown[], options: {
    batchSize?: number;
    delimiter?: string;
    includeHeaders?: boolean;
    format?: string;
    filters?: Record<string, any>;
  }, importId: string): Promise<{
    success: boolean;
    message: string;
    validCount: number;
    invalidCount: number;
    totalProcessed: number;
    totalErrors: number;
    importId: string;
  }> {
    try {
      const batchSize = options.batchSize || this.config.batchSize;
      const totalBatches = Math.ceil(data.length / batchSize);
      
      let processed = 0;
      let errors = 0;
      
      for (let i = 0; i < totalBatches; i++) {
        const batchStart = i * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, data.length);
        const batch = data.slice(batchStart, batchEnd);
        
        const result = await this.processBatch(batch, importId);
        processed += result.totalProcessed;
        errors += result.totalErrors;
      }

      return {
        success: errors === 0,
        message: errors === 0 ? 'Import successful' : 'Import completed with errors',
        validCount: processed - errors,
        invalidCount: errors,
        totalProcessed: processed,
        totalErrors: errors,
        importId
      };
    } catch (error: unknown) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  async processBatch(data: unknown[], importId: string): Promise<{
    success: boolean;
    message: string;
    validCount: number;
    invalidCount: number;
    totalProcessed: number;
    totalErrors: number;
    importId: string;
  }> {
    try {
      const result = await this.repository.processBatch(data, importId);
      
      return {
        success: result.errors.length === 0,
        message: result.errors.length === 0 ? 'Batch processed successfully' : 'Batch processed with errors',
        validCount: data.length - result.errors.length,
        invalidCount: result.errors.length,
        totalProcessed: data.length,
        totalErrors: result.errors.length,
        importId
      };
    } catch (error: unknown) {
      throw this.errors.STORAGE_ERROR;
    }
  }

  private async generateCSV(data: unknown[], options: {
    format: string;
    includeHeaders: boolean;
    delimiter?: string;
  }): Promise<Buffer> {
    try {
      const config = {
        format: options.format,
        includeHeaders: options.includeHeaders,
        delimiter: options.delimiter || ','
      };

      const parser = new Parser(config);
      const csv = parser.parse(data); // Changed from stringify to parse
      return Buffer.from(csv, 'utf8');
    } catch (error: unknown) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  private async generateJSON(data: unknown[]): Promise<Buffer> {
    try {
      return Buffer.from(JSON.stringify(data, null, 2));
    } catch (error: unknown) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  private async generateExcel(data: unknown[], options: {
    format: string;
    includeHeaders: boolean;
    delimiter?: string;
  }): Promise<Buffer> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data');

      if (options.includeHeaders) {
        worksheet.addRow(Object.keys(data[0]));
      }

      data.forEach(row => {
        worksheet.addRow(Object.values(row));
      });

      return await workbook.xlsx.writeBuffer() as Buffer;
    } catch (error: unknown) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  private async parseCSV(buffer: Buffer): Promise<any[]> {
    try {
      const parser = parse({
        columns: true,
        skip_empty_lines: true
      });

      return new Promise((resolve, reject) => {
        const results: unknown[] = [];
        parser.on('data', (row) => {
          results.push(row);
        });
        parser.on('end', () => {
          resolve(results);
        });
        parser.on('error', (error) => {
          reject(error);
        });
        parser.write(buffer.toString());
        parser.end();
      });
    } catch (error: unknown) {
      throw this.errors.INVALID_DATA;
    }
  }

  private async parseJSON(buffer: Buffer): Promise<any[]> {
    try {
      return JSON.parse(buffer.toString());
    } catch (error: unknown) {
      throw this.errors.INVALID_DATA;
    }
  }

  private async parseExcel(buffer: Buffer): Promise<any[]> {
    try {
      // Use the secure xlsx wrapper with strict validation and sanitization
      const secureXlsx = new SecureXlsx({
        maxFileSize: 10 * 1024 * 1024, // 10MB limit for import files
        maxSheets: 5,                // Limit to 5 sheets
        maxRows: 5000                // Limit to 5000 rows per sheet
      });
      
      // Parse the Excel file using the secure wrapper
      const sheets = secureXlsx.readFile(buffer);
      
      // If no sheets were found, throw an error
      if (!sheets || Object.keys(sheets).length === 0) {
        throw new AppError(
          ErrorCategory.IMPORT_EXPORT,
          'Excel file does not contain any valid sheets.'
        );
      }
      
      // Get the first sheet's data
      const firstSheetName = Object.keys(sheets)[0];
      const sheetData = sheets[firstSheetName];
      
      if (!Array.isArray(sheetData) || sheetData.length === 0) {
        return [];
      }
      
      // If the first row contains headers, use them to create proper objects
      const headers = sheetData[0];
      const results: unknown[] = [];
      
      // Process data rows (skip header row)
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || !Array.isArray(row)) continue;
        
        const rowData: Record<string, any> = {};
        
        // Map each cell to its corresponding header
        for (let j = 0; j < headers.length && j < row.length; j++) {
          if (headers[j]) {
            rowData[String(headers[j])] = row[j];
          }
        }
        
        if (Object.keys(rowData).length > 0) {
          results.push(rowData);
        }
      }
      return results; // This should be outside the if, but inside try
    } catch (error: unknown) {
      if (error instanceof AppError) throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw this.errors.INVALID_DATA;
    }
  }

  private generatePrettyJSON(data: unknown[]): Buffer {
    try {
      return Buffer.from(JSON.stringify(data, null, 2));
    } catch (error: unknown) {
      throw new Error('Failed to generate JSON');
    }
  }

  private getConfig(): ImportExportConfig {
    return {
      batchSize: 100
    };
  }
}
