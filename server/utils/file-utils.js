"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUtils = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const errors_1 = require("@shared/types/errors");
const file_upload_1 = require("../config/file-upload");
class FileUtils {
    static validateFileSize(size) {
        return size <= FileUtils.MAX_FILE_SIZE;
    }
    static validateFileType(fileExt) {
        const allowedTypes = new Set([
            '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx',
            '.csv', '.xlsx', '.json'
        ]);
        return allowedTypes.has(fileExt.toLowerCase());
    }
    static validateFilename(filename) {
        return FileUtils.VALID_FILENAME_REGEX.test(filename);
    }
    static async validateFile(filePath, maxSize, allowedTypes) {
        try {
            const stats = await fs_1.default.promises.stat(filePath);
            // Validate file size
            if (stats.size > maxSize) {
                throw new errors_1.AppError('File size exceeds maximum allowed size', file_upload_1.FileUploadErrors.FILE_TOO_LARGE.code, file_upload_1.FileUploadErrors.FILE_TOO_LARGE.category);
            }
            // Validate file type
            const type = await this.detectFileType(filePath);
            if (!allowedTypes.includes(type)) {
                throw new errors_1.AppError('Invalid file type', file_upload_1.FileUploadErrors.INVALID_FILE_TYPE.code, file_upload_1.FileUploadErrors.INVALID_FILE_TYPE.category);
            }
            // Validate file age
            if (Date.now() - stats.birthtimeMs > FileUtils.MAX_FILE_AGE) {
                throw new errors_1.AppError('File is too old', errors_1.ErrorCode.INVALID_FIELD_VALUE, errors_1.ErrorCategory.VALIDATION, {});
            }
        }
        catch (error) {
            throw new errors_1.AppError('Failed to validate file', file_upload_1.FileUploadErrors.STORAGE_ERROR.code, file_upload_1.FileUploadErrors.STORAGE_ERROR.category, {}, 500, true, 5000);
        }
    }
    static async detectFileType(filePath) {
        try {
            const fileHandle = await fs_1.default.promises.open(filePath, 'r');
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
        }
        catch (error) {
            throw new errors_1.AppError('Failed to detect file type', file_upload_1.FileUploadErrors.STORAGE_ERROR.category, file_upload_1.FileUploadErrors.STORAGE_ERROR.code, {}, 500, true, 5000);
        }
    }
    static async generateFileHash(filePath) {
        try {
            const hash = crypto_1.default.createHash('sha256');
            const stream = fs_1.default.createReadStream(filePath);
            return new Promise((resolve, reject) => {
                stream.on('data', (chunk) => hash.update(chunk));
                stream.on('end', () => resolve(hash.digest('hex')));
                stream.on('error', (error) => reject(error));
            });
        }
        catch (error) {
            throw new errors_1.AppError('Failed to generate file hash', file_upload_1.FileUploadErrors.STORAGE_ERROR.category, file_upload_1.FileUploadErrors.STORAGE_ERROR.code, {}, 500, true, 5000);
        }
    }
    static async cleanupOldFiles(directory, maxAge = FileUtils.MAX_FILE_AGE) {
        try {
            const files = await fs_1.default.promises.readdir(directory);
            for (const file of files) {
                const filePath = path_1.default.join(directory, file);
                const stats = await fs_1.default.promises.stat(filePath);
                if (Date.now() - stats.birthtimeMs > maxAge) {
                    await fs_1.default.promises.unlink(filePath);
                }
            }
        }
        catch (error) {
            console.error('Failed to cleanup old files:', error);
        }
    }
    static async resizeImage(filePath, maxWidth, maxHeight) {
        try {
            // This would require an image processing library like sharp
            // Placeholder implementation
            return filePath;
        }
        catch (error) {
            throw new errors_1.AppError('Failed to resize image', file_upload_1.FileUploadErrors.STORAGE_ERROR.category, file_upload_1.FileUploadErrors.STORAGE_ERROR.code, {}, 500, true, 5000);
        }
    }
    static async compressFile(filePath, targetSize) {
        try {
            // This would require a compression library
            // Placeholder implementation
            return filePath;
        }
        catch (error) {
            throw new errors_1.AppError('Failed to compress file', file_upload_1.FileUploadErrors.STORAGE_ERROR.category, file_upload_1.FileUploadErrors.STORAGE_ERROR.code, {}, 500, true, 5000);
        }
    }
}
exports.FileUtils = FileUtils;
FileUtils.MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours
FileUtils.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
FileUtils.VALID_FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/;
