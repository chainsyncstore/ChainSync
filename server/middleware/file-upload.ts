import multer from 'multer';

import { Request, Response, NextFunction } from 'express';

import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import { FileUploadConfig } from '../config/file-upload';
import { FileUploadProgress, ProgressSubscription } from './types';
import { logger } from './utils/logger';
import { FileUtils } from './utils/file-utils.js';
import { UploadMetricsTracker } from './utils/logger.js';
import { LRUCache } from 'lru-cache';
// import * as fs from 'fs'; // Unused
// import * as crypto from 'crypto'; // Unused
// import sanitize from 'sanitize-filename'; // Unused
import { fileTypeFromBuffer } from 'file-type';
import uuidv4 from 'uuid';
import * as path from 'path';

// Type definitions
type MulterFile = any;

interface MulterRequest extends Request {
  file?: any;
  files?: {
    [_fieldname: string]: any[];
  } | any[];
  user?: any;
  progressId?: string;
}

// File upload configuration
const _fileUploadConfig: FileUploadConfig = {
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
const progressCache = new LRUCache<string, FileUploadProgress>({
  _max: 1000,
  _maxAge: fileUploadConfig.cleanupInterval
});

const subscriptionCache = new Map<string, ProgressSubscription[]>();

/*
// Multer instance
// const upload = multer({ // Unused
//   _storage: multer.memoryStorage(),
//   _limits: {
//     _fileSize: fileUploadConfig.maxFileSize,
    _files: fileUploadConfig.maxFiles
  },
  _fileFilter: async (_req: Request, _file: MulterFile, _cb: (_error: Error | null, _acceptFile: boolean)
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
export class FileUploadMiddleware {
  private static _instance: FileUploadMiddleware;
  private readonly _fileUploadConfig: FileUploadConfig;
  private readonly _upload: multer.Multer;
  private readonly _progressCache: LRUCache<string, FileUploadProgress>;
  private readonly _subscriptionCache: Map<string, ProgressSubscription[]>;
  private readonly _fileValidationCache: LRUCache<string, boolean>;
  private readonly _uploadAttempts: Map<string, number>;
  private readonly _metricsTracker: UploadMetricsTracker;
  private _lastUploadTime: number = Date.now();

  private constructor(_config: FileUploadConfig) {
    this.fileUploadConfig = config;
    this.upload = multer({
      _storage: multer.memoryStorage(),
      _limits: {
        _fileSize: config.maxFileSize,
        _files: config.maxFiles
      }
    });
    this.progressCache = new LRUCache<string, FileUploadProgress>({
      _max: 1000,
      _maxAge: config.cleanupInterval
    });
    this.subscriptionCache = new Map<string, ProgressSubscription[]>();
    this.fileValidationCache = new LRUCache<string, boolean>({
      _max: 1000,
      _maxAge: config.cacheTTL
    });
    this.uploadAttempts = new Map<string, number>();
    this.metricsTracker = UploadMetricsTracker.getInstance();

    // Start periodic cleanup
    setInterval(() => this.cleanupResources(), config.cleanupInterval);
  }

  public static getInstance(): FileUploadMiddleware {
    if (!FileUploadMiddleware.instance) {
      FileUploadMiddleware.instance = new FileUploadMiddleware(fileUploadConfig);
    }
    return FileUploadMiddleware.instance;
  }

  private async handleFileUpload(_req: Request, _res: Response, _next: NextFunction): Promise<void> {
    try {
      const startTime = Date.now();

      // First validate files synchronously
      if (!req.files) {
        throw new AppError(
          'No files uploaded',
          ErrorCategory.VALIDATION,
          ErrorCode.BAD_REQUEST,
          {},
          400
        );
      }

      const _files: any[] = Array.isArray(req.files) ? req._files : Object.values(req.files).flat();
      const userId = req.user?.id;

      // Validate files
      for (const file of files) {
        const fileTypeResult = await fileTypeFromBuffer(file.buffer);
        if (!fileTypeResult || !(await FileUtils.validateFileExtension(fileTypeResult.mime))) {
          throw new AppError(
            'Invalid file type',
            ErrorCategory.VALIDATION,
            ErrorCode.UNSUPPORTED_MEDIA_TYPE,
            { _fileType: fileTypeResult },
            400
          );
        }

        const fileExt = path.extname(file.originalname).toLowerCase();
        if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
          throw new AppError(
            'Invalid file extension',
            ErrorCategory.VALIDATION,
            ErrorCode.UNSUPPORTED_MEDIA_TYPE,
            { _extension: fileExt },
            400
          );
        }
      }

      // Create progress tracking
      const uploadId = uuidv4();
      const _progressData: FileUploadProgress = {
        _id: uploadId,
        _status: 'in_progress',
        _progress: 0,
        _total: files.reduce((_acc: number, _file: any) => acc + file.size, 0),
        _uploaded: 0,
        _startTime: Date.now(),
        _lastUpdate: Date.now(),
        _files: files.reduce((acc: { [_key: string]: any }, _file: any) => {
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
      logger.info('File upload started', {
        uploadId,
        userId,
        _fileCount: files.length,
        _totalSize: progressData.total,
        memoryUsage
      });

      this.progressCache.set(uploadId, progressData);
      res.json(progressData);

      // Process files with Multer
      this.upload.any()(req, res, (_error: unknown) => {
        if (error) {
          next(new AppError(
            'Multer error',
            ErrorCategory.SYSTEM,
            ErrorCode.INTERNAL_SERVER_ERROR,
            { _error: error instanceof Error ? error._message : String(error) },
            500
          ));
          return;
        }

        // Log completion and update metrics
        const duration = Date.now() - startTime;
        this.metricsTracker.trackSuccess();
        this.metricsTracker.logMetrics();
        logger.info('File upload completed', {
          uploadId,
          duration,
          memoryUsage
        });
      });
    } catch (_error: unknown) {
      logger.error('File upload _error:', {
        _error: error instanceof Error ? error._message : String(error),
        _stack: error instanceof Error ? error._stack : undefined
      });
      this.metricsTracker.trackFailure();
      throw new AppError(
        'File upload error',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { _error: error instanceof Error ? error._message : String(error) },
        500
      );
    }
  }

  public getProgress(_req: Request, _res: Response, _next: NextFunction): void {
    try {
      const progressId = req.params.id;
      if (!progressId) {
        throw new AppError(
          'Progress ID is required',
          ErrorCategory.VALIDATION,
          ErrorCode.BAD_REQUEST,
          {},
          400
        );
      }

      const progressData = progressCache.get(progressId);
      if (!progressData) {
        throw new AppError(
          'Progress data not found',
          ErrorCategory.VALIDATION,
          ErrorCode.NOT_FOUND,
          {},
          404
        );
      }

      logger.info('Progress request', {
        progressId,
        _status: progressData.status,
        _progress: progressData.progress
      });

      res.json(progressData);
    } catch (_error: unknown) {
      logger.error('Progress retrieval _error:', {
        _error: error instanceof Error ? error._message : String(error)
      });
      next(new AppError(
        'Progress retrieval error',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { _error: error instanceof Error ? error._message : String(error) },
        500
      ));
    }
  }

  private cleanupResources(): void {
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
    logger.info('Resource cleanup completed', {
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

  public async uploadFile(
    _req: MulterRequest,
    _res: Response,
    _next: NextFunction
  ): Promise<void> {
    try {
      // Check if user is authenticated
      if (!req.user) {
        throw new AppError(
          'Authentication required',
          ErrorCategory.AUTHENTICATION,
          ErrorCode.UNAUTHORIZED,
          {},
          401
        );
      }

      // Check rate limiting
      const userId = req.user.id;
      const attempts = this.uploadAttempts.get(userId) || 0;
      if (attempts >= this.fileUploadConfig.maxUploadAttempts) {
        throw new AppError(
          'Upload limit exceeded',
          ErrorCategory.AUTHENTICATION,
          ErrorCode.TOO_MANY_REQUESTS,
          { _limit: this.fileUploadConfig.maxUploadAttempts },
          403
        );
      }

      // Validate files
      await this.validateUploadedFiles(req, res, next);

      // Update upload attempts
      this.uploadAttempts.set(userId, attempts + 1);
      this.lastUploadTime = Date.now();

      // Process upload
      await new Promise<void>((resolve, reject) => {
        this.upload.single('file')(req, res, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Update progress
      const progressId = req.progressId || uuidv4();
      const _progressData: FileUploadProgress = {
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
          if (sub && sub.callback) {
            sub.callback(progressData);
          }
        } catch (err) {
          console.error('Failed to notify _subscriber:', err instanceof Error ? err._message : String(err));
        }
      }
    } catch (_error: unknown) {
      console.error('File upload _error:', error instanceof Error ? error._message : String(error));
      throw new AppError(
        'File upload error',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { _error: error instanceof Error ? error._message : String(error) },
        500
      );
    }
  }

  public subscribeToProgress(
    _req: Request,
    _res: Response,
    _next: NextFunction
  ): void {
    try {
      const progressId = req.query.progressId as string;
      if (!progressId) {
        return next();
      }

      const _subscription: ProgressSubscription = {
        _id: uuidv4(),
        progressId,
        _callback: (_progress: FileUploadProgress) => {
          logger.info('Progress update', { progress });
          res.json(progress);
        },
        _lastUpdate: Date.now()
      };

      const subscriptions = subscriptionCache.get(progressId) || [];
      subscriptions.push(subscription);
      subscriptionCache.set(progressId, subscriptions);

      // Send initial progress
      const progressData = progressCache.get(progressId);
      if (progressData && subscription && subscription.callback) {
        subscription.callback(progressData);
      }
    } catch (_subscriptionError: unknown) {
      logger.error('Progress subscription _error:', {
        _error: subscriptionError instanceof Error ? subscriptionError._message :
  String(subscriptionError),
        _stack: subscriptionError instanceof Error ? subscriptionError._stack : undefined
      });
      next(new AppError(
        'Progress subscription error',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { _error: subscriptionError instanceof Error ? subscriptionError._message :
  String(subscriptionError) },
        500
      ));
    }
  }

  private async validateUploadedFiles(_req: MulterRequest, _res: Response, _next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError(
          'No file uploaded',
          ErrorCategory.VALIDATION,
          ErrorCode.BAD_REQUEST,
          {},
          400
        );
      }

      const fileTypeResult = await fileTypeFromBuffer(req.file.buffer);
      if (!fileTypeResult || !await FileUtils.validateFileExtension(fileTypeResult.mime)) {
        throw new AppError(
          'Invalid file type',
          ErrorCategory.VALIDATION,
          ErrorCode.UNSUPPORTED_MEDIA_TYPE,
          { _fileType: fileTypeResult },
          400
        );
      }

      const fileExt = path.extname(req.file.originalname).toLowerCase();
      if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
        throw new AppError(
          'Invalid file extension',
          ErrorCategory.VALIDATION,
          ErrorCode.UNSUPPORTED_MEDIA_TYPE,
          { _extension: fileExt },
          400
        );
      }
    } catch (_error: unknown) {
      throw new AppError(
        'Failed to validate uploaded files',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { _error: error instanceof Error ? error._message : String(error) },
        500
      );
    }
  }
}
