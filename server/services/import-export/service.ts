import multer from 'multer';

type MulterFile = any;
// import { Request, Express } from 'express'; // Unused
// import * as multer from 'multer'; // Unused
import { AppError, ErrorCategory } from '@shared/types/errors';
// ImportExportServiceErrors, ImportExportProgress removed
import { ImportExportConfig, ImportExportResult, ImportExportOptions, ExportOptions, ValidationOptions } from './types';
import { ValidationService as ValidationServiceImpl } from './validation';
import { ImportExportRepository } from './repository';
// import * as fs from 'fs'; // Unused
// import * as path from 'path'; // Unused
// import { promisify } from 'util'; // Unused
import { parse as json2csv } from 'json2csv';
import { parse } from 'csv-parse';
import * as ExcelJS from 'exceljs';
// import * as xlsx from 'xlsx'; // Unused

// Helper function to chunk arrays
// type Chunk<T> = T[][]; // Unused

// function chunkArray<T>(_array: T[], _size: number): Chunk<T> { // Unused
//   if (!Array.isArray(array)) {
//     throw new Error('Input must be an array');
//   }
//   if (typeof size !== 'number' || size <= 0) {
//     throw new Error('Size must be a positive number');
//   }

//   return array.reduce((chunks, item, index) => {
//     const chunkIndex = Math.floor(index / size);
//     if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
//     chunks[chunkIndex].push(item);
//     return chunks;
//   }, [] as Chunk<T>);
// }

export class ImportExportService {
  private _config: {
    _batchSize: number;
  };

  private errors: {
    _INVALID_FILE_FORMAT: AppError;
    _FILE_TOO_LARGE: AppError;
    _INVALID_DATA: AppError;
    _PROCESSING_ERROR: AppError;
    _STORAGE_ERROR: AppError;
    _PROGRESS_ERROR: AppError;
  };

  private _repository: ImportExportRepository;
  private _validationService: ValidationServiceImpl;

  constructor() {
    this.config = {
      _batchSize: 1000
    };

    this.errors = {
      _INVALID_FILE_FORMAT: new AppError('Invalid file format', ErrorCategory.IMPORT_EXPORT, 'INVALID_FILE_FORMAT'),
      _FILE_TOO_LARGE: new AppError('File size exceeds maximum allowed size', ErrorCategory.IMPORT_EXPORT, 'FILE_TOO_LARGE'),
      _INVALID_DATA: new AppError('Invalid data format', ErrorCategory.IMPORT_EXPORT, 'INVALID_DATA'),
      _PROCESSING_ERROR: new AppError('Processing failed', ErrorCategory.IMPORT_EXPORT, 'PROCESSING_ERROR'),
      _STORAGE_ERROR: new AppError('Storage operation failed', ErrorCategory.IMPORT_EXPORT, 'STORAGE_ERROR'),
      _PROGRESS_ERROR: new AppError('Progress tracking failed', ErrorCategory.IMPORT_EXPORT, 'PROGRESS_ERROR')
    };

    this.repository = new ImportExportRepository();
    this.validationService = new ValidationServiceImpl();
  }

  async validateData(_data: any[], options?: ValidationOptions): Promise<{
    _success: boolean;
    _message: string;
    data?: any[];
    errors?: { _record: any; _errors: string[] }[];
    _validCount: number;
    _invalidCount: number;
    _totalProcessed: number;
    _totalErrors: number;
  }> {
    try {
      if (!Array.isArray(data)) {
        throw this.errors.INVALID_DATA;
      }

      const result = await this.validationService.validate(data, options);

      return {
        _success: result.invalidCount === 0,
        _message: result.invalidCount === 0 ? 'Validation successful' : 'Validation failed',
        _data: result.validRecords,
        _errors: result.invalidRecords.map((record, index) => ({ record, _errors: result.invalidRecords[index]?.errors || [] })),
        _validCount: result.validCount,
        _invalidCount: result.invalidCount,
        _totalProcessed: result.validCount + result.invalidCount,
        _totalErrors: result.invalidCount
      };
    } catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }

  async importData(_userId: number, _data: any[], _entityType: string, _options: {
    batchSize?: number;
    delimiter?: string;
    includeHeaders?: boolean;
    format?: string;
    filters?: Record<string, any>;
  } = {}): Promise<{
    _success: boolean;
    _message: string;
    data?: any[];
    errors?: any[];
    _validCount: number;
    _invalidCount: number;
    _totalProcessed: number;
    _totalErrors: number;
    importId?: string;
  }> {
    try {
      const importId = await this.repository.createImport(userId, entityType, options);

      return await this.processImport(data, options, importId);
    } catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  async exportData(_userId: number, _entityType: string, _options: ExportOptions): Promise<Buffer> {
    try {
      const data = await this.repository.getExportData(userId, entityType, options);

      switch (options.format) {
        case 'csv':
          return await this.generateCSV(data, options);
        case 'json':
          return await this.generateJSON(data);
        case 'xlsx':
          return await this.generateExcel(data, options);
        throw this.errors.INVALID_FILE_FORMAT;
      }
    } catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  async validateFile(_file: MulterFile): Promise<{ _type: string; _data: any[] }> {
    try {
      // Check file size
      if (file.size > 50 * 1024 * 1024) { // 50MB
        throw this.errors.FILE_TOO_LARGE;
      }

      // Check file format
      const extension = file.originalname.split('.').pop()?.toLowerCase();
      const validFormats = ['csv', 'json', 'xlsx'];
      if (!validFormats.includes(extension || '')) {
        throw this.errors.INVALID_FILE_FORMAT;
      }

      const _parsedData: any[] = [];

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
        throw this.errors.INVALID_FILE_FORMAT;
      }

      return {
        _type: extension || '',
        _data: parsedData
      };
    } catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }

  async processImport(_data: any[], _options: {
    batchSize?: number;
    delimiter?: string;
    includeHeaders?: boolean;
    format?: string;
    filters?: Record<string, any>;
  }, _importId: string): Promise<{
    _success: boolean;
    _message: string;
    _validCount: number;
    _invalidCount: number;
    _totalProcessed: number;
    _totalErrors: number;
    _importId: string;
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
        _success: errors === 0,
        _message: errors === 0 ? 'Import successful' : 'Import completed with errors',
        _validCount: processed - errors,
        _invalidCount: errors,
        _totalProcessed: processed,
        _totalErrors: errors,
        importId
      };
    } catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  async processBatch(_data: any[], _importId: string): Promise<{
    _success: boolean;
    _message: string;
    _validCount: number;
    _invalidCount: number;
    _totalProcessed: number;
    _totalErrors: number;
    _importId: string;
  }> {
    try {
      const result = await this.repository.processBatch(data, importId);

      return {
        _success: result.errors.length === 0,
        _message: result.errors.length === 0 ? 'Batch processed successfully' : 'Batch processed with errors',
        _validCount: data.length - result.errors.length,
        _invalidCount: result.errors.length,
        _totalProcessed: data.length,
        _totalErrors: result.errors.length,
        importId
      };
    } catch (error) {
      throw this.errors.STORAGE_ERROR;
    }
  }

  private async generateCSV(_data: any[], _options: {
    _format: string;
    _includeHeaders: boolean;
    delimiter?: string;
  }): Promise<Buffer> {
    try {
      const config = {
        _fields: options.includeHeaders ? Object.keys(data[0] || {}) : undefined,
        _delimiter: options.delimiter || ','
      };

      const csv = json2csv(data, config as any);
      return Buffer.from(csv, 'utf8');
    } catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  private async generateJSON(_data: any[]): Promise<Buffer> {
    try {
      return Buffer.from(JSON.stringify(data, null, 2));
    } catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  private async generateExcel(_data: any[], _options: {
    _format: string;
    _includeHeaders: boolean;
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

      return await workbook.xlsx.writeBuffer() as unknown as Buffer;
    } catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }

  private async parseCSV(_buffer: Buffer): Promise<any[]> {
    try {
      const parser = parse({
        _columns: true,
        _skip_empty_lines: true
      });

      return new Promise((resolve, reject) => {
        const _results: any[] = [];
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
    } catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }

  private async parseJSON(_buffer: Buffer): Promise<any[]> {
    try {
      return JSON.parse(buffer.toString());
    } catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }

  private async parseExcel(_buffer: Buffer): Promise<any[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as Buffer);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        return [];
      }
      const row1 = worksheet.getRow(1).values as string[];
      const headers = Array.isArray(row1) ? row1.slice(1) : [];

      const _results: any[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const _rowData: any = {};
        headers.forEach((_header: any, _index: number) => {
          if (header) {
            const cell = row.getCell(index + 1);
            rowData[String(header)] = cell?.value;
          }
        });
        results.push(rowData);
      });
      return results;
    } catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }
  private generatePrettyJSON(_data: any[]): Buffer {
    try {
      return Buffer.from(JSON.stringify(data, null, 2));
    } catch (error) {
      throw new Error('Failed to generate JSON');
    }
  }

  // private getConfig(): ImportExportConfig { // Unused
  //   return {
  //     _batchSize: 100
  //   };
  // }
}
