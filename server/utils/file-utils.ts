import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import { FileUploadErrors } from '../config/file-upload';

export class FileUtils {
  public static readonly MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  public static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  public static readonly VALID_FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/;

  public static validateFileSize(_size: number): boolean {
    return size <= FileUtils.MAX_FILE_SIZE;
  }

  public static validateFileType(_fileExt: string): boolean {
    const allowedTypes = new Set([
      '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx',
      '.csv', '.xlsx', '.json'
    ]);
    return allowedTypes.has(fileExt.toLowerCase());
  }

  public static validateFilename(_filename: string): boolean {
    return FileUtils.VALID_FILENAME_REGEX.test(filename);
  }

  public static async validateFile(
    _filePath: string,
    _maxSize: number,
    _allowedTypes: string[]
  ): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);

      // Validate file size
      if (stats.size > maxSize) {
        throw new AppError(
          'File size exceeds maximum allowed size',
          FileUploadErrors.FILE_TOO_LARGE.code,
          FileUploadErrors.FILE_TOO_LARGE.category
        );
      }

      // Validate file type
      const type = await this.detectFileType(filePath);
      if (!allowedTypes.includes(type)) {
        throw new AppError(
          'Invalid file type',
          FileUploadErrors.INVALID_FILE_TYPE.code,
          FileUploadErrors.INVALID_FILE_TYPE.category
        );
      }

      // Validate file age
      if (Date.now() - stats.birthtimeMs > FileUtils.MAX_FILE_AGE) {
        throw new AppError(
          'File is too old',
          ErrorCode.INVALID_FIELD_VALUE,
          ErrorCategory.VALIDATION,
          {}
        );
      }
    } catch (error) {
      throw new AppError(
        'Failed to validate file',
        FileUploadErrors.STORAGE_ERROR.code,
        FileUploadErrors.STORAGE_ERROR.category,
        {},
        500,
        true,
        5000
      );
    }
  }

  public static async detectFileType(_filePath: string): Promise<string> {
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
        return 'application/octet-stream';
      }
    } catch (error) {
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

  public static async generateFileHash(_filePath: string): Promise<string> {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (error) => reject(error));
      });
    } catch (error) {
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
    _directory: string,
    _maxAge: number = FileUtils.MAX_FILE_AGE
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
    } catch (error) {
      console.error('Failed to cleanup old _files:', error);
    }
  }

  public static async resizeImage(
    _filePath: string,
    _maxWidth: number,
    _maxHeight: number
  ): Promise<string> {
    try {
      // This would require an image processing library like sharp
      // Placeholder implementation
      return filePath;
    } catch (error) {
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

  public static async compressFile(
    _filePath: string,
    _targetSize: number
  ): Promise<string> {
    try {
      // This would require a compression library
      // Placeholder implementation
      return filePath;
    } catch (error) {
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
