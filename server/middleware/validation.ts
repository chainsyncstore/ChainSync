// server/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getLogger, getRequestLogger } from '../../src/logging';

// Get centralized logger for validation middleware
const logger = getLogger().child({ component: 'validation-middleware' });

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  public errors: z.ZodError;
  public status: number = 400;
  public code: string = 'VALIDATION_ERROR';
  
  constructor(message: string, errors: z.ZodError) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
  
  /**
   * Convert to a client-friendly format
   */
  toJSON() {
    return {
      message: this.message,
      code: this.code,
      errors: this.errors.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }))
    };
  }
}

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const reqLogger = getRequestLogger(req) || logger;
    
    try {
      // Parse and validate request body
      const validatedData = schema.parse(req.body);
      
      // Replace request body with validated data
      req.body = validatedData;
      
      next();
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        reqLogger.warn('Request body validation failed', {
          path: req.path,
          method: req.method,
          validationErrors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        
        const validationError = new ValidationError(
          'Invalid request data', 
          error
        );
        
        return res.status(400).json(validationError.toJSON());
      }
      
      // Pass other errors to the error handler
      next(error);
    }
  };
}

/**
 * Validate request params against a Zod schema
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const reqLogger = getRequestLogger(req) || logger;
    
    try {
      // Parse and validate URL parameters
      const validatedData = schema.parse(req.params);
      
      // Replace request params with validated data
      req.params = validatedData;
      
      next();
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        reqLogger.warn('Request params validation failed', {
          path: req.path,
          method: req.method,
          validationErrors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        
        const validationError = new ValidationError(
          'Invalid URL parameters', 
          error
        );
        
        return res.status(400).json(validationError.toJSON());
      }
      
      // Pass other errors to the error handler
      next(error);
    }
  };
}

/**
 * Validate request query against a Zod schema
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const reqLogger = getRequestLogger(req) || logger;
    
    try {
      // Parse and validate query parameters
      const validatedData = schema.parse(req.query);
      
      // Replace request query with validated data
      req.query = validatedData;
      
      next();
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        reqLogger.warn('Request query validation failed', {
          path: req.path,
          method: req.method,
          validationErrors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
        
        const validationError = new ValidationError(
          'Invalid query parameters', 
          error
        );
        
        return res.status(400).json(validationError.toJSON());
      }
      
      // Pass other errors to the error handler
      next(error);
    }
  };
}
