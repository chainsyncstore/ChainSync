"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const errors_js_1 = require("@shared/types/errors.js");
const logger_js_1 = require("./utils/logger.js");
const file_utils_js_1 = require("./utils/file-utils.js");
const logger_js_2 = require("./utils/logger.js");
const lru_cache_1 = require("lru-cache");
// import * as fs from 'fs'; // Unused
// import * as crypto from 'crypto'; // Unused
// import sanitize from 'sanitize-filename'; // Unused
const file_type_1 = require("file-type");
const uuid_1 = __importDefault(require("uuid"));
const path = __importStar(require("path"));
// File upload configuration
const fileUploadConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 uploads per 15 minutes
    maxTotalUploadSize: 100 * 1024 * 1024, // 100MB
    maxUploadAttempts: 5,
    allowedFileExtensions: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'],
    allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    destination: './uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix);
    },
    cleanupInterval: 3600000, // 1 hour
    cacheTTL: 300000 // 5 minutes
};
// Cache instances
const progressCache = new lru_cache_1.LRUCache({
    max: 1000,
    maxAge: fileUploadConfig.cleanupInterval
});
const subscriptionCache = new Map();
/*
// Multer instance
// const upload = multer({ // Unused
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: fileUploadConfig.maxFileSize,
    files: fileUploadConfig.maxFiles
  },
  fileFilter: async (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    try {
      UploadMetricsTracker.getInstance().trackRequest();
      
      // Validate file size
      if (file.size > fileUploadConfig.maxFileSize) {
        logger.warn('File size limit exceeded', {
          filename: file.originalname,
          size: file.size,
          maxSize: fileUploadConfig.maxFileSize
        });
        const error = new Error('File size too large') as any;
        error.code = ErrorCode.BAD_REQUEST;
        error.category = ErrorCategory.VALIDATION;
        error.details = { maxSize: fileUploadConfig.maxFileSize };
        error.statusCode = 400;
        cb(error, false);
        return;
      }

      // Check file type
      const fileType = await fileTypeFromBuffer(file.buffer);
      const isValidType = fileType ? await FileUtils.validateFileExtension(fileType.mime) : false;
      
      if (!fileType || !isValidType) {
        logger.warn('Invalid file type', {
          filename: file.originalname,
          mimeType: fileType?.mime
        });
        const error = new Error('Invalid file type') as any;
        error.code = ErrorCode.BAD_REQUEST;
        error.category = ErrorCategory.VALIDATION;
        error.details = { allowedTypes: await FileUtils.validateFileExtension.toString() };
        error.statusCode = 400;
        cb(error, false);
        return;
      }

      // Validate file extension
      const fileExt = path.extname(file.originalname).toLowerCase();
      if (!fileExt || !fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
        logger.warn('Invalid file extension', {
          filename: file.originalname,
          extension: fileExt
        });
        cb(null, false);
        return;
      }

      // Log successful validation
      logger.info('File validation succeeded', {
        filename: file.originalname,
        size: file.size,
        mimeType: fileType.mime,
        extension: fileExt
      });
      cb(null, true);
    } catch (error) {
      logger.error('File validation failed', {
        filename: file.originalname,
        error: error instanceof Error ? error.message : String(error)
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
            storage: multer_1.default.memoryStorage(),
            limits: {
                fileSize: config.maxFileSize,
                files: config.maxFiles
            }
        });
        this.progressCache = new lru_cache_1.LRUCache({
            max: 1000,
            maxAge: config.cleanupInterval
        });
        this.subscriptionCache = new Map();
        this.fileValidationCache = new lru_cache_1.LRUCache({
            max: 1000,
            maxAge: config.cacheTTL
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
            const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
            const userId = req.user?.id;
            // Validate files
            for (const file of files) {
                const fileTypeResult = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
                if (!fileTypeResult || !(await file_utils_js_1.FileUtils.validateFileExtension(fileTypeResult.mime))) {
                    throw new errors_js_1.AppError('Invalid file type', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE, { fileType: fileTypeResult }, 400);
                }
                const fileExt = path.extname(file.originalname).toLowerCase();
                if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
                    throw new errors_js_1.AppError('Invalid file extension', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE, { extension: fileExt }, 400);
                }
            }
            // Create progress tracking
            const uploadId = (0, uuid_1.default)();
            const progressData = {
                id: uploadId,
                status: 'in_progress',
                progress: 0,
                total: files.reduce((acc, file) => acc + file.size, 0),
                uploaded: 0,
                startTime: Date.now(),
                lastUpdate: Date.now(),
                files: files.reduce((acc, file) => {
                    acc[file.originalname] = {
                        name: file.originalname,
                        size: file.size,
                        status: 'pending',
                        progress: 0,
                        uploaded: 0
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
                fileCount: files.length,
                totalSize: progressData.total,
                memoryUsage
            });
            this.progressCache.set(uploadId, progressData);
            res.json(progressData);
            // Process files with Multer
            this.upload.any()(req, res, (error) => {
                if (error) {
                    next(new errors_js_1.AppError('Multer error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { error: error instanceof Error ? error.message : String(error) }, 500));
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
            logger_js_1.logger.error('File upload error:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            this.metricsTracker.trackFailure();
            throw new errors_js_1.AppError('File upload error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { error: error instanceof Error ? error.message : String(error) }, 500);
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
                status: progressData.status,
                progress: progressData.progress
            });
            res.json(progressData);
        }
        catch (error) {
            logger_js_1.logger.error('Progress retrieval error:', {
                error: error instanceof Error ? error.message : String(error)
            });
            next(new errors_js_1.AppError('Progress retrieval error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { error: error instanceof Error ? error.message : String(error) }, 500));
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
            memoryUsage: process.memoryUsage().heapUsed,
            cacheSizes: {
                progressCache: progressCache.size,
                validationCache: this.fileValidationCache.size,
                subscriptionCache: subscriptionCache.size
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
                throw new errors_js_1.AppError('Upload limit exceeded', errors_js_1.ErrorCategory.AUTHENTICATION, errors_js_1.ErrorCode.TOO_MANY_REQUESTS, { limit: this.fileUploadConfig.maxUploadAttempts }, 403);
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
                id: progressId,
                status: 'completed',
                progress: 100,
                total: req.file?.size || 0,
                uploaded: req.file?.size || 0,
                startTime: Date.now(),
                lastUpdate: Date.now(),
                files: {
                    [req.file?.fieldname || 'file']: {
                        name: req.file?.originalname || '',
                        size: req.file?.size || 0,
                        status: 'completed',
                        progress: 100,
                        uploaded: req.file?.size || 0,
                        path: req.file?.path || ''
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
                    console.error('Failed to notify subscriber:', err instanceof Error ? err.message : String(err));
                }
            }
        }
        catch (error) {
            console.error('File upload error:', error instanceof Error ? error.message : String(error));
            throw new errors_js_1.AppError('File upload error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { error: error instanceof Error ? error.message : String(error) }, 500);
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
                onProgress: (progress) => {
                    logger_js_1.logger.info('Progress update', { progress });
                    res.json(progress);
                },
                onError: (error) => {
                    logger_js_1.logger.error('Progress error', error);
                    res.status(error.status || 500).json({
                        error: {
                            message: error.message,
                            code: error.code,
                            status: error.status
                        }
                    });
                },
                onComplete: (result) => {
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
            logger_js_1.logger.error('Progress subscription error:', {
                error: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError),
                stack: subscriptionError instanceof Error ? subscriptionError.stack : undefined
            });
            next(new errors_js_1.AppError('Progress subscription error', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { error: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError) }, 500));
        }
    }
    async validateUploadedFiles(req, res, next) {
        try {
            if (!req.file) {
                throw new errors_js_1.AppError('No file uploaded', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.BAD_REQUEST, {}, 400);
            }
            const fileTypeResult = await (0, file_type_1.fileTypeFromBuffer)(req.file.buffer);
            if (!fileTypeResult || !await file_utils_js_1.FileUtils.validateFileExtension(fileTypeResult.mime)) {
                throw new errors_js_1.AppError('Invalid file type', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE, { fileType: fileTypeResult }, 400);
            }
            const fileExt = path.extname(req.file.originalname).toLowerCase();
            if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
                throw new errors_js_1.AppError('Invalid file extension', errors_js_1.ErrorCategory.VALIDATION, errors_js_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE, { extension: fileExt }, 400);
            }
        }
        catch (error) {
            throw new errors_js_1.AppError('Failed to validate uploaded files', errors_js_1.ErrorCategory.SYSTEM, errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR, { error: error instanceof Error ? error.message : String(error) }, 500);
        }
    }
}
exports.FileUploadMiddleware = FileUploadMiddleware;
