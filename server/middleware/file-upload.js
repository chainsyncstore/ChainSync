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
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.FileUploadMiddleware = void 0;
const multer_1 = __importDefault(require('multer'));
const errors_js_1 = require('@shared/types/errors.js');
const logger_js_1 = require('./utils/logger.js');
const file_utils_js_1 = require('./utils/file-utils.js');
const logger_js_2 = require('./utils/logger.js');
const lru_cache_1 = require('lru-cache');
// import * as fs from 'fs'; // Unused
// import * as crypto from 'crypto'; // Unused
// import sanitize from 'sanitize-filename'; // Unused
const file_type_1 = require('file-type');
const uuid_1 = __importDefault(require('uuid'));
const path = __importStar(require('path'));
// File upload configuration
const fileUploadConfig = {
  _maxFileSize: 10 * 1024 * 1024, // 10MB
  _maxFiles: 10,
  _rateLimit: { _windowMs: 15 * 60 * 1000, _max: 100 }, // 100 uploads per 15 minutes
  _maxTotalUploadSize: 100 * 1024 * 1024, // 100MB
  _maxUploadAttempts: 5,
  _allowedFileExtensions: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'],
  _allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  _destination: './uploads',
  _filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  },
  _cleanupInterval: 3600000, // 1 hour
  _cacheTTL: 300000 // 5 minutes
};
// Cache instances
const progressCache = new lru_cache_1.LRUCache({
  _max: 1000,
  _maxAge: fileUploadConfig.cleanupInterval
});
const subscriptionCache = new Map();
/*
// Multer instance
// const upload = multer({ // Unused
//   _storage: multer.memoryStorage(),
//   _limits: {
//     _fileSize: fileUploadConfig.maxFileSize,
    _files: fileUploadConfig.maxFiles
  },
  _fileFilter: async (_req: Request, _file: Express.Multer.File, _cb: (_error: Error | null, _acceptFile: boolean)
   = > void) => {
    try {
      UploadMetricsTracker.getInstance().trackRequest();

      // Validate file size
      if (file.size > fileUploadConfig.maxFileSize) {
        logger.warn('File size limit exceeded', {
          _filename: file.originalname,
          _size: file.size,
          _maxSize: fileUploadConfig.maxFileSize
        });
        const error = new Error('File size too large') as any;
        error.code = ErrorCode.BAD_REQUEST;
        error.category = ErrorCategory.VALIDATION;
        error.details = { _maxSize: fileUploadConfig.maxFileSize };
        error.statusCode = 400;
        cb(error, false);
        return;
      }

      // Check file type
      const fileType = await fileTypeFromBuffer(file.buffer);
      const isValidType = fileType ? await FileUtils.validateFileExtension(fileType.mime) : false;

      if (!fileType || !isValidType) {
        logger.warn('Invalid file type', {
          _filename: file.originalname,
          _mimeType: fileType?.mime
        });
        const error = new Error('Invalid file type') as any;
        error.code = ErrorCode.BAD_REQUEST;
        error.category = ErrorCategory.VALIDATION;
        error.details = { _allowedTypes: await FileUtils.validateFileExtension.toString() };
        error.statusCode = 400;
        cb(error, false);
        return;
      }

      // Validate file extension
      const fileExt = path.extname(file.originalname).toLowerCase();
      if (!fileExt || !fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
        logger.warn('Invalid file extension', {
          _filename: file.originalname,
          _extension: fileExt
        });
        cb(null, false);
        return;
      }

      // Log successful validation
      logger.info('File validation succeeded', {
        _filename: file.originalname,
        _size: file.size,
        _mimeType: fileType.mime,
        _extension: fileExt
      });
      cb(null, true);
    } catch (error) {
      logger.error('File validation failed', {
        _filename: file.originalname,
        _error: error instanceof Error ? error._message : String(error)
      });
      cb(null, false);
    }
  }
});

*/
// File upload middleware class
class FileUploadMiddleware {
  constructor(config) {
    this.lastUploadTime = Date.now();
    this.fileUploadConfig = config;
    this.upload = (0, multer_1.default)({
      _storage: multer_1.default.memoryStorage(),
      _limits: {
        _fileSize: config.maxFileSize,
        _files: config.maxFiles
      }
    });
    this.progressCache = new lru_cache_1.LRUCache({
      _max: 1000,
      _maxAge: config.cleanupInterval
    });
    this.subscriptionCache = new Map();
    this.fileValidationCache = new lru_cache_1.LRUCache({
      _max: 1000,
      _maxAge: config.cacheTTL
    });
    this.uploadAttempts = new Map();
    this.metricsTracker = logger_js_2.UploadMetricsTracker.getInstance();
    // Start periodic cleanup
    setInterval(() => this.cleanupResources(), config.cleanupInterval);
  }
  static getInstance() {
    if (!FileUploadMiddleware.instance) {
      FileUploadMiddleware.instance = new FileUploadMiddleware(fileUploadConfig);
    }
    return FileUploadMiddleware.instance;
  }
  async handleFileUpload(req, res, next) {
    try {
      const startTime = Date.now();
      // First validate files synchronously
      if (!req.files) {
        throw new errors_js_1.AppError('No files uploaded', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.BAD_REQUEST, {}, 400);
      }
      const files = Array.isArray(req.files) ? req._files : Object.values(req.files).flat();
      const userId = req.user?.id;
      // Validate files
      for (const file of files) {
        const fileTypeResult = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
        if (!fileTypeResult || !(await file_utils_js_1.FileUtils.validateFileExtension(fileTypeResult.mime))) {
          throw new errors_js_1.AppError('Invalid file type', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE, { _fileType: fileTypeResult }, 400);
        }
        const fileExt = path.extname(file.originalname).toLowerCase();
        if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
          throw new errors_js_1.AppError('Invalid file extension', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE, { _extension: fileExt }, 400);
        }
      }
      // Create progress tracking
      const uploadId = (0, uuid_1.default)();
      const progressData = {
        _id: uploadId,
        _status: 'in_progress',
        _progress: 0,
        _total: files.reduce((acc, file) => acc + file.size, 0),
        _uploaded: 0,
        _startTime: Date.now(),
        _lastUpdate: Date.now(),
        _files: files.reduce((acc, file) => {
          acc[file.originalname] = {
            _name: file.originalname,
            _size: file.size,
            _status: 'pending',
            _progress: 0,
            _uploaded: 0
          };
          return acc;
        }, {})
      };
      // Track memory usage
      const memoryUsage = process.memoryUsage().heapUsed;
      this.metricsTracker.trackMemoryUsage(memoryUsage);
      // Log upload details
      logger_js_1.logger.info('File upload started', {
        uploadId,
        userId,
        _fileCount: files.length,
        _totalSize: progressData.total,
        memoryUsage
      });
      this.progressCache.set(uploadId, progressData);
      res.json(progressData);
      // Process files with Multer
      this.upload.any()(req, res, (error) => {
        if (error) {
          next(new errors_js_1.AppError('Multer error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { _error: error instanceof Error ? error._message : String(error) }, 500));
          return;
        }
        // Log completion and update metrics
        const duration = Date.now() - startTime;
        this.metricsTracker.trackSuccess();
        this.metricsTracker.logMetrics();
        logger_js_1.logger.info('File upload completed', {
          uploadId,
          duration,
          memoryUsage
        });
      });
    }
    catch (error) {
      logger_js_1.logger.error('File upload _error:', {
        _error: error instanceof Error ? error._message : String(error),
        _stack: error instanceof Error ? error._stack : undefined
      });
      this.metricsTracker.trackFailure();
      throw new errors_js_1.AppError('File upload error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { _error: error instanceof Error ? error._message : String(error) }, 500);
    }
  }
  getProgress(req, res, next) {
    try {
      const progressId = req.params.id;
      if (!progressId) {
        throw new errors_js_1.AppError('Progress ID is required', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.BAD_REQUEST, {}, 400);
      }
      const progressData = progressCache.get(progressId);
      if (!progressData) {
        throw new errors_js_1.AppError('Progress data not found', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.NOT_FOUND, {}, 404);
      }
      logger_js_1.logger.info('Progress request', {
        progressId,
        _status: progressData.status,
        _progress: progressData.progress
      });
      res.json(progressData);
    }
    catch (error) {
      logger_js_1.logger.error('Progress retrieval _error:', {
        _error: error instanceof Error ? error._message : String(error)
      });
      next(new errors_js_1.AppError('Progress retrieval error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { _error: error instanceof Error ? error._message : String(error) }, 500));
    }
  }
  cleanupResources() {
    const currentTime = Date.now();
    // Clean up upload attempts
    this.uploadAttempts.forEach((attempts, userId) => {
      if (currentTime - this.lastUploadTime > this.fileUploadConfig.cleanupInterval) {
        this.uploadAttempts.delete(userId);
      }
    });
    // Clean up validation cache
    this.fileValidationCache.prune();
    // Clean up progress cache
    progressCache.prune();
    // Clean up subscription cache
    subscriptionCache.forEach((subscriptions, uploadId) => {
      const progress = progressCache.get(uploadId);
      if (!progress || progress.status === 'completed') {
        subscriptionCache.delete(uploadId);
      }
    });
    // Log cleanup stats
    logger_js_1.logger.info('Resource cleanup completed', {
      _memoryUsage: process.memoryUsage().heapUsed,
      _cacheSizes: {
        _progressCache: progressCache.size,
        _validationCache: this.fileValidationCache.size,
        _subscriptionCache: subscriptionCache.size
      }
    });
    // Track cleanup metrics
    const memoryUsage = process.memoryUsage().heapUsed;
    this.metricsTracker.trackMemoryUsage(memoryUsage);
    this.metricsTracker.logMetrics();
  }
  async uploadFile(req, res, next) {
    try {
      // Check if user is authenticated
      if (!req.user) {
        throw new errors_js_1.AppError('Authentication required', errors_js_1.ErrorCategory.AUTHENTICATION, errors_js_1.ErrorCode.UNAUTHORIZED, {}, 401);
      }
      // Check rate limiting
      const userId = req.user.id;
      const attempts = this.uploadAttempts.get(userId) || 0;
      if (attempts >= this.fileUploadConfig.maxUploadAttempts) {
        throw new errors_js_1.AppError('Upload limit exceeded', errors_js_1.ErrorCategory.AUTHENTICATION, errors_js_1.ErrorCode.TOO_MANY_REQUESTS, { _limit: this.fileUploadConfig.maxUploadAttempts }, 403);
      }
      // Validate files
      await this.validateUploadedFiles(req, res, next);
      // Update upload attempts
      this.uploadAttempts.set(userId, attempts + 1);
      this.lastUploadTime = Date.now();
      // Process upload
      await new Promise((resolve, reject) => {
        this.upload.single('file')(req, res, (err) => {
          if (err) {
            reject(err);
          }
          else {
            resolve();
          }
        });
      });
      // Update progress
      const progressId = req.progressId || (0, uuid_1.default)();
      const progressData = {
        _id: progressId,
        _status: 'completed',
        _progress: 100,
        _total: req.file?.size || 0,
        _uploaded: req.file?.size || 0,
        _startTime: Date.now(),
        _lastUpdate: Date.now(),
        _files: {
          [req.file?.fieldname || 'file']: {
            _name: req.file?.originalname || '',
            _size: req.file?.size || 0,
            _status: 'completed',
            _progress: 100,
            _uploaded: req.file?.size || 0,
            _path: req.file?.path || ''
          }
        }
      };
      // Update progress cache
      progressCache.set(progressId, progressData);
      // Notify subscribers
      const subscriptions = subscriptionCache.get(progressId) || [];
      for (const sub of subscriptions) {
        try {
          if (sub && sub.onProgress) {
            sub.onProgress(progressData);
          }
        }
        catch (err) {
          console.error('Failed to notify _subscriber:', err instanceof Error ? err._message : String(err));
        }
      }
    }
    catch (error) {
      console.error('File upload _error:', error instanceof Error ? error._message : String(error));
      throw new errors_js_1.AppError('File upload error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { _error: error instanceof Error ? error._message : String(error) }, 500);
    }
  }
  subscribeToProgress(req, res, next) {
    try {
      const progressId = req.query.progressId;
      if (!progressId) {
        return next();
      }
      const subscription = {
        progressId,
        _onProgress: (progress) => {
          logger_js_1.logger.info('Progress update', { progress });
          res.json(progress);
        },
        _onError: (error) => {
          logger_js_1.logger.error('Progress error', error);
          res.status(error.status || 500).json({
            _error: {
              _message: error.message,
              _code: error.code,
              _status: error.status
            }
          });
        },
        _onComplete: (result) => {
          logger_js_1.logger.info('Progress completed', { result });
          res.json(result);
        }
      };
      const subscriptions = subscriptionCache.get(progressId) || [];
      subscriptions.push(subscription);
      subscriptionCache.set(progressId, subscriptions);
      // Send initial progress
      const progressData = progressCache.get(progressId);
      if (progressData && subscription && subscription.onProgress) {
        subscription.onProgress(progressData);
      }
    }
    catch (subscriptionError) {
      logger_js_1.logger.error('Progress subscription _error:', {
        _error: subscriptionError instanceof Error ? subscriptionError._message :
  String(subscriptionError),
        _stack: subscriptionError instanceof Error ? subscriptionError._stack : undefined
      });
      next(new errors_js_1.AppError('Progress subscription error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { _error: subscriptionError instanceof Error ? subscriptionError._message : String(subscriptionError) }, 500));
    }
  }
  async validateUploadedFiles(req, res, next) {
    try {
      if (!req.file) {
        throw new errors_js_1.AppError('No file uploaded', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.BAD_REQUEST, {}, 400);
      }
      const fileTypeResult = await (0, file_type_1.fileTypeFromBuffer)(req.file.buffer);
      if (!fileTypeResult || !await file_utils_js_1.FileUtils.validateFileExtension(fileTypeResult.mime)) {
        throw new errors_js_1.AppError('Invalid file type', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE, { _fileType: fileTypeResult }, 400);
      }
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
        throw new errors_js_1.AppError('Invalid file extension', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE, { _extension: fileExt }, 400);
      }
    }
    catch (error) {
      throw new errors_js_1.AppError('Failed to validate uploaded files', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { _error: error instanceof Error ? error._message : String(error) }, 500);
    }
  }
}
exports.FileUploadMiddleware = FileUploadMiddleware;
