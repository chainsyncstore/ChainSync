import * as xlsx from 'xlsx';

import { AppError, ErrorCode, ErrorCategory } from '../../shared/types/errors';
import { getLogger } from '../../src/logging/index';

/**
 * Secure wrapper for xlsx library to mitigate known vulnerabilities
 * - ReDoS vulnerability (SNYK-JS-XLSX-6252523)
 * - Prototype Pollution (SNYK-JS-XLSX-5457926)
 */
export class SecureXlsx {
  // Initialize logger
  private logger = getLogger();
  /**
   * Maximum allowed file size in bytes (default: 5MB)
   */
  private maxFileSize: number;

  /**
   * Maximum number of sheets allowed in workbook
   */
  private maxSheets: number;

  /**
   * Maximum number of rows allowed per sheet
   */
  private maxRows: number;

  constructor(options?: { maxFileSize?: number; maxSheets?: number; maxRows?: number }) {
    this.maxFileSize = options?.maxFileSize || 5 * 1024 * 1024; // 5MB default
    this.maxSheets = options?.maxSheets || 10;
    this.maxRows = options?.maxRows || 10000;
  }

  /**
   * Safely read an Excel file buffer with validation and sanitization
   */
  public readFile(fileBuffer: Buffer): Record<string, any[]> {
    try {
      // Check file size
      if (fileBuffer.length > this.maxFileSize) {
        throw new AppError(
          `File exceeds maximum allowed size (${this.maxFileSize / 1024 / 1024}MB)`,
          ErrorCategory.IMPORT_EXPORT,
          ErrorCode.VALIDATION_ERROR
        );
      }

      // Parse workbook with defensive options
      const workbook = xlsx.read(fileBuffer, {
        type: 'buffer',
        cellFormula: false, // Disable formulas for security
        cellNF: false, // Disable number formats
        cellHTML: false, // Disable HTML
      });

      // Validate workbook structure
      if (!workbook.SheetNames || !Array.isArray(workbook.SheetNames)) {
        throw new AppError(
          'Invalid Excel file structure',
          ErrorCategory.IMPORT_EXPORT,
          ErrorCode.INVALID_FILE
        );
      }

      // Check sheet count
      if (workbook.SheetNames.length > this.maxSheets) {
        throw new AppError(
          `File contains too many sheets (maximum ${this.maxSheets})`,
          ErrorCategory.IMPORT_EXPORT,
          ErrorCode.VALIDATION_ERROR
        );
      }

      // Process each sheet with row limits
      const result: Record<string, any[]> = {};

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];

        // Validate worksheet
        if (!worksheet || typeof worksheet !== 'object' || !worksheet['!ref']) {
          this.logger.warn(`Invalid or empty worksheet: ${sheetName}`);
          result[sheetName] = []; // Assign empty array for invalid/empty sheets
          continue;
        }

        // Get sheet range
        const range = xlsx.utils.decode_range(worksheet['!ref']);

        // Check row count
        if (range.e.r > this.maxRows) {
          throw new AppError(
            `Sheet "${sheetName}" exceeds maximum allowed rows (${this.maxRows})`,
            ErrorCategory.IMPORT_EXPORT,
            ErrorCode.VALIDATION_ERROR
          );
        }

        // Convert to JSON with safe options
        const data = xlsx.utils.sheet_to_json(worksheet, {
          defval: null, // Default to null for empty cells
          raw: false, // Convert values to strings
          header: 1, // Use first row as headers
        });

        // Deep sanitize the data
        const sanitizedData = this.sanitizeData(data);

        result[sheetName] = sanitizedData;
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof AppError) {
        // If it's already an AppError, rethrow it
        throw error;
      }

      // Log the original error for debugging
      this.logger.error('Error processing Excel file', {
        originalError:
          error instanceof Error
            ? { message: error.message, stack: error.stack, name: error.name }
            : error,
      });

      // Throw a new AppError for consistent error handling
      throw new AppError(
        'Unable to process Excel file',
        ErrorCategory.IMPORT_EXPORT,
        ErrorCode.INVALID_FILE
      );
    }
  }

  /**
   * Sanitize data from xlsx to prevent prototype pollution and other injection attacks
   *
   * This function creates new objects without prototype inheritance to prevent
   * prototype pollution attacks that could be triggered by specially crafted Excel files.
   * It also converts object values to strings to prevent nested pollution.
   */
  private sanitizeData(data: unknown[]): unknown[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(row => {
      if (row === null || typeof row !== 'object') {
        return {};
      }

      // Create a new object without prototype
      const sanitizedRow: Record<string, any> = Object.create(null);

      // Copy only valid properties
      const indexableRow = row as Record<string, any>;
      Object.keys(indexableRow).forEach(key => {
        // Skip __proto__ and constructor properties
        if (key === '__proto__' || key === 'constructor') {
          return;
        }

        // Sanitize values
        let value = indexableRow[key];

        // Convert objects to strings to prevent nested pollution
        if (value !== null && typeof value === 'object') {
          value = JSON.stringify(value);
        }

        sanitizedRow[key] = value;
      });

      return sanitizedRow;
    });
  }

  /**
   * Safely extract headers from an Excel sheet
   */
  public extractHeaders(fileBuffer: Buffer, sheetIndex = 0): string[] {
    const sheets = this.readFile(fileBuffer);
    const sheetName = Object.keys(sheets)[sheetIndex];

    if (!sheetName || !sheets[sheetName] || !Array.isArray(sheets[sheetName])) {
      return [];
    }

    const firstRow = sheets[sheetName][0];
    return Array.isArray(firstRow) ? firstRow.map(String) : [];
  }
}
