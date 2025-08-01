import multer from 'multer';
import { File } from 'multer';
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
type MulterFile = File;

interface MulterRequest extends Request {
  file?: MulterFile;
  files?: {
    [fieldname: string]: MulterFile[];
  } | MulterFile[];
  user?: any;
  progressId?: string;
}

// File upload configuration
const fileUploadConfig: FileUploadConfig = {
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
const progressCache = new LRUCache<string, FileUploadProgress>({
  max: 1000,
  maxAge: fileUploadConfig.cleanupInterval
});

const subscriptionCache = new Map<string, ProgressSubscription[]>();

/*
// Multer instance
// const upload = multer({ // Unused
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: fileUploadConfig.maxFileSize,
    files: fileUploadConfig.maxFiles
  },
  fileFilter: async (req: Request, file: MulterFile, cb: (error: Error | null, acceptFile: boolean) => void) => {
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
export class FileUploadMiddleware {
  private static instance: FileUploadMiddleware;
  private readonly fileUploadConfig: FileUploadConfig;
  private readonly upload: multer.Multer;
  private readonly progressCache: LRUCache<string, FileUploadProgress>;
  private readonly subscriptionCache: Map<string, ProgressSubscription[]>;
  private readonly fileValidationCache: LRUCache<string, boolean>;
  private readonly uploadAttempts: Map<string, number>;
  private readonly metricsTracker: UploadMetricsTracker;
  private lastUploadTime: number = Date.now();

  private constructor(config: FileUploadConfig) {
    this.fileUploadConfig = config;
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: config.maxFileSize,
        files: config.maxFiles
      }
    });
    this.progressCache = new LRUCache<string, FileUploadProgress>({
      max: 1000,
      maxAge: config.cleanupInterval
    });
    this.subscriptionCache = new Map<string, ProgressSubscription[]>();
    this.fileValidationCache = new LRUCache<string, boolean>({
      max: 1000,
      maxAge: config.cacheTTL
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

  private async handleFileUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      const userId = req.user?.id;

      // Validate files
      for (const file of files) {
        const fileTypeResult = await fileTypeFromBuffer(file.buffer);
        if (!fileTypeResult || !(await FileUtils.validateFileExtension(fileTypeResult.mime))) {
          throw new AppError(
            'Invalid file type',
            ErrorCategory.VALIDATION,
            ErrorCode.UNSUPPORTED_MEDIA_TYPE,
            { fileType: fileTypeResult },
            400
          );
        }

        const fileExt = path.extname(file.originalname).toLowerCase();
        if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
          throw new AppError(
            'Invalid file extension',
            ErrorCategory.VALIDATION,
            ErrorCode.UNSUPPORTED_MEDIA_TYPE,
            { extension: fileExt },
            400
          );
        }
      }

      // Create progress tracking
      const uploadId = uuidv4();
      const progressData: FileUploadProgress = {
        id: uploadId,
        status: 'in_progress',
        progress: 0,
        total: files.reduce((acc: number, file: MulterFile) => acc + file.size, 0),
        uploaded: 0,
        startTime: Date.now(),
        lastUpdate: Date.now(),
        files: files.reduce((acc: { [key: string]: any }, file: MulterFile) => {
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
      logger.info('File upload started', {
        uploadId,
        userId,
        fileCount: files.length,
        totalSize: progressData.total,
        memoryUsage
      });

      this.progressCache.set(uploadId, progressData);
      res.json(progressData);

      // Process files with Multer
      this.upload.any()(req, res, (error: unknown) => {
        if (error) {
          next(new AppError(
            'Multer error',
            ErrorCategory.SYSTEM,
            ErrorCode.INTERNAL_SERVER_ERROR,
            { error: error instanceof Error ? error.message : String(error) },
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
    } catch (error: unknown) {
      logger.error('File upload error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      this.metricsTracker.trackFailure();
      throw new AppError(
        'File upload error',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }

  public getProgress(req: Request, res: Response, next: NextFunction): void {
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
        status: progressData.status,
        progress: progressData.progress
      });

      res.json(progressData);
    } catch (error: unknown) {
      logger.error('Progress retrieval error:', {
        error: error instanceof Error ? error.message : String(error)
      });
      next(new AppError(
        'Progress retrieval error',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error: error instanceof Error ? error.message : String(error) },
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

  public async uploadFile(
    req: MulterRequest,
    res: Response,
    next: NextFunction
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
          { limit: this.fileUploadConfig.maxUploadAttempts },
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
      const progressData: FileUploadProgress = {
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
          if (sub && sub.callback) {
            sub.callback(progressData);
          }
        } catch (err) {
          console.error('Failed to notify subscriber:', err instanceof Error ? err.message : String(err));
        }
      }
    } catch (error: unknown) {
      console.error('File upload error:', error instanceof Error ? error.message : String(error));
      throw new AppError(
        'File upload error',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }

  public subscribeToProgress(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      const progressId = req.query.progressId as string;
      if (!progressId) {
        return next();
      }

      const subscription: ProgressSubscription = {
        id: uuidv4(),
        progressId,
        callback: (progress: FileUploadProgress) => {
          logger.info('Progress update', { progress });
          res.json(progress);
        },
        lastUpdate: Date.now()
      };

      const subscriptions = subscriptionCache.get(progressId) || [];
      subscriptions.push(subscription);
      subscriptionCache.set(progressId, subscriptions);

      // Send initial progress
      const progressData = progressCache.get(progressId);
      if (progressData && subscription && subscription.callback) {
        subscription.callback(progressData);
      }
    } catch (subscriptionError: unknown) {
      logger.error('Progress subscription error:', {
        error: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError),
        stack: subscriptionError instanceof Error ? subscriptionError.stack : undefined
      });
      next(new AppError(
        'Progress subscription error',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError) },
        500
      ));
    }
  }

  private async validateUploadedFiles(req: MulterRequest, res: Response, next: NextFunction): Promise<void> {
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
          { fileType: fileTypeResult },
          400
        );
      }

      const fileExt = path.extname(req.file.originalname).toLowerCase();
      if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
        throw new AppError(
          'Invalid file extension',
          ErrorCategory.VALIDATION,
          ErrorCode.UNSUPPORTED_MEDIA_TYPE,
          { extension: fileExt },
          400
        );
      }
    } catch (error: unknown) {
      throw new AppError(
        'Failed to validate uploaded files',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }
}
