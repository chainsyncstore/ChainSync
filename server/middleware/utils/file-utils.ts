import { promisify } from 'util';
import { fileTypeFromBuffer } from 'file-type';
import sanitize from 'sanitize-filename';
import crypto from 'crypto';

export const FileUtils = {
    _VALID_FILENAME_REGEX: /^[a-zA-Z0-9._-]+$/,

    _sanitizeFilename: (_filename: string): string => {
        return sanitize(filename);
    },

    _validateFilename: (_filename: string): boolean => {
        return FileUtils.VALID_FILENAME_REGEX.test(filename);
    },

    _validateFileExtension: async(_mimeType: string): Promise<boolean> => {
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'image/jpeg',
            'image/png',
            'image/gif',
            'text/plain',
            'application/json',
            'application/xml',
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed'
        ];

        return allowedMimeTypes.includes(mimeType);
    },

    _calculateFileSize: (_buffer: Buffer): number => {
        return buffer.byteLength;
    },

    _calculateFileHash: async(_buffer: Buffer): Promise<string> => {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            hash.update(buffer);
            resolve(hash.digest('hex'));
        });
    }
};
