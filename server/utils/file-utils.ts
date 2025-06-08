import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors.js';

import { getLogger } from '../../src/logging/index.js';
import { FileUploadErrors } from '../config/file-upload.js';

export class FileUtils {
  private static logger = getLogger();
  public static readonly MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  public static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  public static readonly VALID_FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/;

  public static validateFileSize(size: number): boolean {
    return size <= FileUtils.MAX_FILE_SIZE;
  }

  /**
   * Validates if a file extension is allowed
   * @param fileExt File extension including the dot (e.g., '.xlsx')
   * @param trustLevel Optional trust level of the file source (defaults to 'untrusted')
   * @returns boolean indicating if the file type is allowed
   */
  public static validateFileType(
    fileExt: string,
    trustLevel: 'trusted' | 'untrusted' = 'untrusted'
  ): boolean {
    fileExt = fileExt.toLowerCase();

    // Base allowed types for all trust levels
    const baseTypes = new Set(['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.csv', '.json']);

    // Potentially risky file types only allowed from trusted sources
    const trustedOnlyTypes = new Set(['.doc', '.docx', '.xlsx']);

    // Check if the file type is in the base allowed types
    if (baseTypes.has(fileExt)) {
      return true;
    }

    // For potentially risky file types, only allow if the source is trusted
    if (trustedOnlyTypes.has(fileExt)) {
      return trustLevel === 'trusted';
    }

    return false;
  }

  public static validateFilename(filename: string): boolean {
    return FileUtils.VALID_FILENAME_REGEX.test(filename);
  }

  /**
   * Comprehensive file validation method for secure file handling
   * 
   * @param filePath Path to the file to validate
   * @param maxSize Maximum allowed file size in bytes
   * @param allowedTypes List of allowed file extensions
   * @param trustLevel Trust level of the file source ('trusted' or 'untrusted')
  ): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      
      // Validate file size
      if (stats.size > maxSize) {
        throw new AppError(
          'File size exceeds maximum allowed size',
          FileUploadErrors.FILE_TOO_LARGE.category,
          FileUploadErrors.FILE_TOO_LARGE.code,
          {},
          500,
          true,
          5000
        );
      }

      // Validate file type
      const fileExt = path.extname(filePath);
      
      // Check if file extension is in the allowed list
      if (!allowedTypes.includes(fileExt.toLowerCase())) {
        this.logger.warn(`Rejected file with disallowed extension: ${fileExt}`);
        throw new AppError(
          'Unsupported file type',
          ErrorCategory.VALIDATION,
          FileUploadErrors.INVALID_FILE_TYPE
        );
      }
      
      // Apply trust level validation for potentially risky file types
      if (!this.validateFileType(fileExt, trustLevel)) {
        this.logger.warn(`Rejected ${fileExt} file with trust level: ${trustLevel}`);
        throw new AppError(
          `${fileExt} files are only allowed from trusted sources`,
          ErrorCategory.VALIDATION,
          ErrorCode.INVALID_FILE
        );
      }
      
      // Additional validation for XLSX files
      if (fileExt === '.xlsx') {
        await this.validateExcelFile(filePath);
      }

      // Validate file age
      if (Date.now() - stats.birthtimeMs > FileUtils.MAX_FILE_AGE) {
        throw new AppError(
          'File is too old',
          ErrorCategory.VALIDATION,
          ErrorCode.INVALID_FIELD_VALUE,
          {},
          500,
          true,
          5000
        );
      }
    } catch (error: unknown) {
      throw new AppError(
        'Failed to validate file',
        FileUploadErrors.STORAGE_ERROR.category,
        FileUploadErrors.STORAGE_ERROR.code,
        {},
        500,
        true,
        5000
      );
    }
  }

  /**
   * Additional security check specifically for XLSX files
   * Helps prevent ReDoS and Prototype Pollution vulnerabilities
   * 
   * @param filePath Path to the XLSX file
   * @returns true if the file appears to be a valid XLSX file
   */
  public static async validateExcelFile(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Check file signature (magic bytes) for Office Open XML files
      // XLSX files are ZIP archives with specific structure
      fs.readFile(filePath, (err, data) => {
        if (err) {
          this.logger.error('Error reading Excel file for validation', { error: err });
          return reject(
            new AppError(
              'Error validating Excel file',
              ErrorCategory.VALIDATION,
              ErrorCode.INVALID_FILE
            )
          );
        }

        // Check for ZIP file signature (PK\x03\x04)
        if (
          data.length < 4 ||
          data[0] !== 0x50 ||
          data[1] !== 0x4b ||
          data[2] !== 0x03 ||
          data[3] !== 0x04
        ) {
          this.logger.warn('Invalid Excel file signature detected');
          return reject(
            new AppError(
              'Invalid Excel file format',
              ErrorCategory.VALIDATION,
              ErrorCode.INVALID_FILE
            )
          );
        }

        // Additional validation could be performed here, such as:
        // - Checking for presence of expected internal files
        // - Validating the ZIP structure
        // - Scanning for malicious content

        resolve(true);
      });
    });
  }

  public static async detectFileType(filePath: string): Promise<string> {
    try {
      const fileHandle = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(4);
      await fileHandle.read(buffer, 0, 4, 0);
      await fileHandle.close();

      switch (buffer.toString('hex', 0, 4)) {
        case '89504e47':
          return 'image/png';
        case 'ffd8ffe0':
        case 'ffd8ffe1':
        case 'ffd8ffe2':
          return 'image/jpeg';
        case '47494638':
          return 'image/gif';
        case '25504446':
          return 'application/pdf';
        default:
          return 'application/octet-stream';
      }
    } catch (error: unknown) {
      throw new AppError(
        'Failed to detect file type',
        FileUploadErrors.STORAGE_ERROR.category,
        FileUploadErrors.STORAGE_ERROR.code,
        {},
        500,
        true,
        5000
      );
    }
  }

  public static async generateFileHash(filePath: string): Promise<string> {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      return new Promise((resolve, reject) => {
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', error => reject(error));
      });
    } catch (error: unknown) {
      throw new AppError(
        'Failed to generate file hash',
        FileUploadErrors.STORAGE_ERROR.category,
        FileUploadErrors.STORAGE_ERROR.code,
        {},
        500,
        true,
        5000
      );
    }
  }

  public static async cleanupOldFiles(
    directory: string,
    maxAge: number = FileUtils.MAX_FILE_AGE
  ): Promise<void> {
    try {
      const files = await fs.promises.readdir(directory);

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.promises.stat(filePath);

        if (Date.now() - stats.birthtimeMs > maxAge) {
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error: unknown) {
      console.error('Failed to cleanup old files:', error);
    }
  }

  public static async resizeImage(
    filePath: string,
    maxWidth: number,
    maxHeight: number
  ): Promise<string> {
    try {
      // This would require an image processing library like sharp
      // Placeholder implementation
      return filePath;
    } catch (error: unknown) {
      throw new AppError(
        'Failed to resize image',
        FileUploadErrors.STORAGE_ERROR.category,
        FileUploadErrors.STORAGE_ERROR.code,
        {},
        500,
        true,
        5000
      );
    }
  }

  public static async compressFile(filePath: string, targetSize: number): Promise<string> {
    try {
      // This would require a compression library
      // Placeholder implementation
      return filePath;
    } catch (error: unknown) {
      throw new AppError(
        'Failed to compress file',
        FileUploadErrors.STORAGE_ERROR.category,
        FileUploadErrors.STORAGE_ERROR.code,
        {},
        500,
        true,
        5000
      );
    }
  }
}
