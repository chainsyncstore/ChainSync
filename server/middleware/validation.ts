// server/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ _component: 'validation-middleware' });

/**
 * Generic validation middleware using Zod schemas
 */
export const validateBody = (_schema: z.ZodSchema) => {
  return (_req: Request, _res: Response, _next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation failed', {
          _path: req.path,
          _method: req.method,
          _errors: error.issues
        });

        res.status(400).json({
          _success: false,
          _error: {
            code: 'VALIDATION_ERROR',
            _message: 'Invalid request data',
            _details: error.issues.map(err => ({
              _field: err.path.join('.'),
              _message: err.message
            }))
          }
        });
        return;
      }

      logger.error('Validation middleware error', { error });
      res.status(500).json({
        _success: false,
        _error: {
          code: 'VALIDATION_ERROR',
          _message: 'Internal validation error'
        }
      });
      return;
    }
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = (_schema: z.ZodSchema) => {
  return (_req: Request, _res: Response, _next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Query validation failed', {
          _path: req.path,
          _method: req.method,
          _errors: error.issues
        });

        res.status(400).json({
          _success: false,
          _error: {
            code: 'VALIDATION_ERROR',
            _message: 'Invalid query parameters',
            _details: error.issues.map(err => ({
              _field: err.path.join('.'),
              _message: err.message
            }))
          }
        });
        return;
      }

      next(error);
    }
  };
};

/**
 * Validate URL parameters
 */
export const validateParams = (_schema: z.ZodSchema) => {
  return (_req: Request, _res: Response, _next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Params validation failed', {
          _path: req.path,
          _method: req.method,
          _errors: error.issues
        });

        res.status(400).json({
          _success: false,
          _error: {
            code: 'VALIDATION_ERROR',
            _message: 'Invalid URL parameters',
            _details: error.issues.map(err => ({
              _field: err.path.join('.'),
              _message: err.message
            }))
          }
        });
        return;
      }

      next(error);
    }
  };
};

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export const sanitizeInput = (_req: Request, _res: Response, _next: NextFunction): void => {
  try {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Sanitization error', { error });
    res.status(400).json({
      _success: false,
      _error: {
        code: 'SANITIZATION_ERROR',
        _message: 'Invalid input detected'
      }
    });
    return;
  }
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(_obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const _sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Sanitize individual values
 */
function sanitizeValue(_value: any): any {
  if (typeof value !== 'string') {
    return value;
  }

  // Remove potentially dangerous characters and patterns
  return value
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove _javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .trim();
}

/**
 * Rate limiting for specific endpoints
 */
export const createRateLimiter = (_windowMs: number, _max: number, message?: string) => {
  const requests = new Map<string, { _count: number; _resetTime: number }>();

  return (_req: Request, _res: Response, _next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    const requestData = requests.get(key);

    if (!requestData || now > requestData.resetTime) {
      requests.set(key, { _count: 1, _resetTime: now + windowMs });
      next();
    } else if (requestData.count < max) {
      requestData.count++;
      next();
    } else {
      logger.warn('Rate limit exceeded', { _ip: key, _path: req.path });

      res.status(429).json({
        _success: false,
        _error: {
          code: 'RATE_LIMIT_EXCEEDED',
          _message: message || 'Too many requests, please try again later'
        }
      });
      return;
    }
  };
};

/**
 * Content type validation
 */
export const validateContentType = (_allowedTypes: string[] = ['application/json']) => {
  return (_req: Request, _res: Response, _next: NextFunction): void => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      next();
      return;
    }

    const contentType = req.headers['content-type'];

    if (!contentType) {
      res.status(400).json({
        _success: false,
        _error: {
          code: 'MISSING_CONTENT_TYPE',
          _message: 'Content-Type header is required'
        }
      });
      return;
    }

    const isValidType = allowedTypes.some(type =>
      contentType.includes(type)
    );

    if (!isValidType) {
      res.status(415).json({
        _success: false,
        _error: {
          code: 'UNSUPPORTED_CONTENT_TYPE',
          _message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * File upload validation
 */
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
} = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxFiles = 5
  } = options;

  return (_req: Request, _res: Response, _next: NextFunction): void => {
    if (!req.files || Object.keys(req.files).length === 0) {
      next();
      return;
    }

    const files = Array.isArray(req.files) ? req._files : Object.values(req.files);

    if (files.length > maxFiles) {
      res.status(400).json({
        _success: false,
        _error: {
          code: 'TOO_MANY_FILES',
          _message: `Maximum ${maxFiles} files allowed`
        }
      });
      return;
    }

    for (const file of files) {
      const fileObj = Array.isArray(file) ? file[0] : file;
      if (!fileObj) continue;

      if (fileObj.size > maxSize) {
        res.status(400).json({
          _success: false,
          _error: {
            code: 'FILE_TOO_LARGE',
            _message: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`
          }
        });
        return;
      }

      if (!allowedTypes.includes(fileObj.mimetype)) {
        res.status(400).json({
          _success: false,
          _error: {
            code: 'INVALID_FILE_TYPE',
            _message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
          }
        });
        return;
      }
    }

    next();
  };
};
