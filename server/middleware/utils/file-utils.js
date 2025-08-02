'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.FileUtils = void 0;
const sanitize_filename_1 = __importDefault(require('sanitize-filename'));
const crypto_1 = __importDefault(require('crypto'));
exports.FileUtils = {
  VALID_FILENAME_REGEX: /^[a-zA-Z0-9._-]+$/,
  sanitizeFilename: (filename) => {
    return (0, sanitize_filename_1.default)(filename);
  },
  validateFilename: (filename) => {
    return exports.FileUtils.VALID_FILENAME_REGEX.test(filename);
  },
  validateFileExtension: async(mimeType) => {
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
  calculateFileSize: (buffer) => {
    return buffer.byteLength;
  },
  calculateFileHash: async(buffer) => {
    return new Promise((resolve, reject) => {
      const hash = crypto_1.default.createHash('sha256');
      hash.update(buffer);
      resolve(hash.digest('hex'));
    });
  }
};
