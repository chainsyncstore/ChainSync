import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, ErrorCategory } from './types/error';
import { FileUploadConfig } from '../config/file-upload';
import { FileUploadProgress, ProgressSubscription } from './types/file-upload';
import { logger } from './utils/logger';
import { FileUtils } from './utils/file-utils';
import { LRUCache } from 'lru-cache';
import * as fs from 'fs';
import * as crypto from 'crypto';
import sanitize = require('sanitize-filename');
import { fileTypeFromBuffer } from 'file-type';
import v4 = require('uuid');
import * as path from 'path';

// Type definitions
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        [key: string]: any;
      };
      progressId?: string;
      files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
    }
  }
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
  user?: any;
}

// File upload configuration
const fileUploadConfig: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  uploadRateLimit: 1000000, // 1MB/s
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
  uploadDir: './uploads',
  cleanupInterval: 3600000, // 1 hour
  cacheTTL: 300000, // 5 minutes
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // max 100 uploads per 15 minutes
  }
};

// Cache instances
const progressCache = new LRUCache<string, FileUploadProgress>({
  max: 1000,
  maxAge: fileUploadConfig.cleanupInterval
});

const subscriptionCache = new Map<string, ProgressSubscription[]>();

// Multer instance
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: fileUploadConfig.maxFileSize,
    files: fileUploadConfig.maxFiles
  },
  fileFilter: async (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    try {
      UploadMetricsTracker.getInstance().trackRequest();
      
      // Validate file size
      if (file.size > fileUploadConfig.maxFileSize) {
        logger.warn('File size limit exceeded', { 
          filename: file.originalname,
          size: file.size,
          maxSize: fileUploadConfig.maxFileSize
        });
        cb(null, false);
        return;
      }

      // Validate file type
      const fileType = await fileTypeFromBuffer(file.buffer);
      if (!fileType || !await FileUtils.validateFileExtension(fileType.mime)) {
        logger.warn('Invalid file type', { 
          filename: file.originalname,
          mimeType: fileType?.mime
        });
        cb(null, false);
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

  private handleFileUpload(req: Request, res: Response, next: NextFunction): void {
    try {
      const startTime = Date.now();
      
      // First validate files synchronously
      if (!req.files) {
        const error = {
          category: ErrorCategory.VALIDATION,
          code: ErrorCode.BAD_REQUEST,
          message: 'No files uploaded',
          data: {},
          status: 400
        } as AppError;
        throw error;
      }

      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      const userId = req.user?.id;

      // Validate files
      for (const file of files) {
        const fileTypeResult = await fileTypeFromBuffer(file.buffer);
        if (!fileTypeResult || !FileUtils.validateFileExtension(fileTypeResult.mime)) {
          const error = {
            category: ErrorCategory.VALIDATION,
            code: ErrorCode.INVALID_FILE,
            message: 'Invalid file type',
            data: { fileType: fileTypeResult },
            status: 400
          } as AppError;
          throw error;
        }

        const fileExt = path.extname(file.originalname).toLowerCase();
        if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
          const error = {
            category: ErrorCategory.VALIDATION,
            code: ErrorCode.INVALID_FILE,
            message: 'Invalid file extension',
            data: { extension: fileExt },
            status: 400
          } as AppError;
          throw error;
        }
      }

      // Create progress tracking
      const uploadId = v4();
      const progressData: FileUploadProgress = {
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
          const errorObject = {
            category: ErrorCategory.SYSTEM,
            code: ErrorCode.UPLOAD_FAILED,
            message: 'Multer error',
            data: { error: error instanceof Error ? error.message : String(error) },
            status: 500
          } as AppError;
          next(errorObject);
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
      const errorObject = {
        category: ErrorCategory.SYSTEM,
        code: ErrorCode.UPLOAD_FAILED,
        message: 'File upload error',
        data: { error: error instanceof Error ? error.message : String(error) },
        status: 500
      } as AppError;
      logger.error('File upload error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      this.metricsTracker.trackFailure();
      throw errorObject;
    }
  }

  public getProgress(req: Request, res: Response, next: NextFunction): void {
    try {
      const progressId = req.params.id;
      if (!progressId) {
        const error = {
          category: ErrorCategory.VALIDATION,
          code: ErrorCode.INVALID_REQUEST,
          message: 'Progress ID is required',
          data: {},
          status: 400
        } as AppError;
        throw error;
      }

      const progressData = progressCache.get(progressId);
      if (!progressData) {
        const error = {
          category: ErrorCategory.VALIDATION,
          code: ErrorCode.NOT_FOUND,
          message: 'Progress data not found',
          data: {},
          status: 404
        } as AppError;
        throw error;
      }

      logger.info('Progress request', {
        progressId,
        status: progressData.status,
        progress: progressData.progress
      });

      res.json(progressData);
    } catch (error: unknown) {
      const errorObject = {
        category: ErrorCategory.SYSTEM,
        code: ErrorCode.UPLOAD_FAILED,
        message: 'Progress retrieval error',
        data: { error: error instanceof Error ? error.message : String(error) },
        status: 500
      } as AppError;
      logger.error('Progress retrieval error:', {
        error: error instanceof Error ? error.message : String(error)
      });
      next(errorObject);
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
        const error = {
          category: ErrorCategory.AUTH,
          code: ErrorCode.UPLOAD_LIMIT_EXCEEDED,
          message: 'Authentication required',
          data: {},
          status: 401
        } as AppError;
        throw error;
      }

      // Check rate limiting
      const userId = req.user.id;
      const attempts = this.uploadAttempts.get(userId) || 0;
      if (attempts >= this.fileUploadConfig.maxUploadAttempts) {
        const error = {
          category: ErrorCategory.AUTHENTICATION,
          code: ErrorCode.UPLOAD_LIMIT_EXCEEDED,
          message: 'Upload limit exceeded',
          data: { limit: this.fileUploadConfig.maxUploadAttempts },
          status: 403
        } as AppError;
        throw error;
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
      const progressId = req.progressId || v4();
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
          sub.onProgress(progressData);
        } catch (err) {
          console.error('Failed to notify subscriber:', err instanceof Error ? err.message : String(err));
        }
      }
    } catch (error: unknown) {
      const errorObject = {
        category: ErrorCategory.SYSTEM,
        code: ErrorCode.UPLOAD_FAILED,
        message: 'File upload error',
        data: { error: error instanceof Error ? error.message : String(error) },
        status: 500
      } as AppError;
      console.error('File upload error:', error instanceof Error ? error.message : String(error));
      throw errorObject;
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
        progressId,
        onProgress: (progress: FileUploadProgress) => {
          logger.info('Progress update', { progress });
          res.json(progress);
        },
        onError: (error: any) => {
          logger.error('Progress error', error);
          res.status(error.status || 500).json({
            error: {
              message: error.message,
              code: error.code,
              status: error.status
            }
          });
        },
        onComplete: (result: any) => {
          logger.info('Progress completed', { result });
          res.json(result);
        }
      };

      const subscriptions = subscriptionCache.get(progressId) || [];
      subscriptions.push(subscription);
      subscriptionCache.set(progressId, subscriptions);

      // Send initial progress
      const progressData = progressCache.get(progressId);
      if (progressData) {
        subscription.onProgress(progressData);
      }
    } catch (subscriptionError: unknown) {
      const errorObject = {
        category: ErrorCategory.SYSTEM,
        code: ErrorCode.UPLOAD_FAILED,
        message: 'Progress subscription error',
        data: { error: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError) },
        status: 500
      } as AppError;
      logger.error('Progress subscription error:', {
        error: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError),
        stack: subscriptionError instanceof Error ? subscriptionError.stack : undefined
      });
      next(errorObject);
    }
  }

  private async validateUploadedFiles(req: MulterRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        const error = {
          category: ErrorCategory.VALIDATION,
          code: ErrorCode.INVALID_REQUEST,
          message: 'No file uploaded',
          data: {},
          status: 400
        } as AppError;
        throw error;
      }

      const fileTypeResult = await fileTypeFromBuffer(req.file.buffer);
      if (!fileTypeResult || !await FileUtils.validateFileExtension(fileTypeResult.mime)) {
        const error = {
          category: ErrorCategory.VALIDATION,
          code: ErrorCode.INVALID_FILE,
          message: 'Invalid file type',
          data: { fileType: fileTypeResult },
          status: 400
        } as AppError;
        throw error;
      }

      const fileExt = path.extname(req.file.originalname).toLowerCase();
      if (!fileExt || !this.fileUploadConfig.allowedFileExtensions.includes(fileExt)) {
        const error = {
          category: ErrorCategory.VALIDATION,
          code: ErrorCode.INVALID_FILE,
          message: 'Invalid file extension',
          data: { extension: fileExt },
          status: 400
        } as AppError;
        throw error;
      }
    } catch (error: unknown) {
      const errorObject = {
        category: ErrorCategory.SYSTEM,
        code: ErrorCode.UPLOAD_FAILED,
        message: 'Failed to validate uploaded files',
        data: { error: error instanceof Error ? error.message : String(error) },
        status: 500
      } as AppError;
      throw errorObject;
    }
  }
}
