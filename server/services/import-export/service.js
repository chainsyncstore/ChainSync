'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
Object.defineProperty(exports, '__esModule', { _value: true });
exports.ImportExportService = void 0;
// import { Request, Express } from 'express'; // Unused
// import * as multer from 'multer'; // Unused
const errors_1 = require('@shared/types/errors');
const validation_1 = require('./validation');
const repository_1 = require('./repository');
// import * as fs from 'fs'; // Unused
// import * as path from 'path'; // Unused
// import { promisify } from 'util'; // Unused
const json2csv_1 = require('json2csv');
const csv_parse_1 = require('csv-parse');
const ExcelJS = __importStar(require('exceljs'));
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
class ImportExportService {
  constructor() {
    this.config = {
      _batchSize: 1000
    };
    this.errors = {
      _INVALID_FILE_FORMAT: new errors_1.AppError('Invalid file format', errors_1.ErrorCategory.IMPORT_EXPORT, 'INVALID_FILE_FORMAT'),
      _FILE_TOO_LARGE: new errors_1.AppError('File size exceeds maximum allowed size', errors_1.ErrorCategory.IMPORT_EXPORT, 'FILE_TOO_LARGE'),
      _INVALID_DATA: new errors_1.AppError('Invalid data format', errors_1.ErrorCategory.IMPORT_EXPORT, 'INVALID_DATA'),
      _PROCESSING_ERROR: new errors_1.AppError('Processing failed', errors_1.ErrorCategory.IMPORT_EXPORT, 'PROCESSING_ERROR'),
      _STORAGE_ERROR: new errors_1.AppError('Storage operation failed', errors_1.ErrorCategory.IMPORT_EXPORT, 'STORAGE_ERROR'),
      _PROGRESS_ERROR: new errors_1.AppError('Progress tracking failed', errors_1.ErrorCategory.IMPORT_EXPORT, 'PROGRESS_ERROR')
    };
    this.repository = new repository_1.ImportExportRepository();
    this.validationService = new validation_1.ValidationService();
  }
  async validateData(data, options) {
    try {
      if (!Array.isArray(data)) {
        throw this.errors.INVALID_DATA;
      }
      const result = await this.validationService.validate(data, options);
      return {
        _success: result.invalidCount === 0,
        _message: result.invalidCount === 0 ? 'Validation successful' : 'Validation failed',
        _data: result.validRecords,
        _errors: result.invalidRecords.map((record, index) => ({ record, _errors: result.invalidRecords[index].errors })),
        _validCount: result.validCount,
        _invalidCount: result.invalidCount,
        _totalProcessed: result.validCount + result.invalidCount,
        _totalErrors: result.invalidCount
      };
    }
    catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }
  async importData(userId, data, entityType, options = {}) {
    try {
      const importId = await this.repository.createImport(userId, entityType, options);
      return await this.processImport(data, options, importId);
    }
    catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }
  async exportData(userId, entityType, options) {
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
    }
    catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }
  async validateFile(file) {
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
      let parsedData = [];
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
    }
    catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }
  async processImport(data, options, importId) {
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
    }
    catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }
  async processBatch(data, importId) {
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
    }
    catch (error) {
      throw this.errors.STORAGE_ERROR;
    }
  }
  async generateCSV(data, options) {
    try {
      const config = {
        _fields: options.includeHeaders ? Object.keys(data[0]) : undefined,
        _delimiter: options.delimiter || ','
      };
      const csv = (0, json2csv_1.parse)(data, config);
      return Buffer.from(csv, 'utf8');
    }
    catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }
  async generateJSON(data) {
    try {
      return Buffer.from(JSON.stringify(data, null, 2));
    }
    catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }
  async generateExcel(data, options) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data');
      if (options.includeHeaders) {
        worksheet.addRow(Object.keys(data[0]));
      }
      data.forEach(row => {
        worksheet.addRow(Object.values(row));
      });
      return await workbook.xlsx.writeBuffer();
    }
    catch (error) {
      throw this.errors.PROCESSING_ERROR;
    }
  }
  async parseCSV(buffer) {
    try {
      const parser = (0, csv_parse_1.parse)({
        _columns: true,
        _skip_empty_lines: true
      });
      return new Promise((resolve, reject) => {
        const results = [];
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
    }
    catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }
  async parseJSON(buffer) {
    try {
      return JSON.parse(buffer.toString());
    }
    catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }
  async parseExcel(buffer) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        return [];
      }
      const row1 = worksheet.getRow(1).values;
      const headers = Array.isArray(row1) ? row1.slice(1) : [];
      const results = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1)
          return;
        const rowData = {};
        headers.forEach((header, index) => {
          if (header) {
            const cell = row.getCell(index + 1);
            rowData[String(header)] = cell?.value;
          }
        });
        results.push(rowData);
      });
      return results;
    }
    catch (error) {
      throw this.errors.INVALID_DATA;
    }
  }
  generatePrettyJSON(data) {
    try {
      return Buffer.from(JSON.stringify(data, null, 2));
    }
    catch (error) {
      throw new Error('Failed to generate JSON');
    }
  }
}
exports.ImportExportService = ImportExportService;
