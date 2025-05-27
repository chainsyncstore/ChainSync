import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Input Sanitization Middleware
 * Provides XSS protection and input validation
 */

interface SanitizationOptions {
  maxLength?: number;
  allowHtml?: boolean;
}

const defaultOptions: SanitizationOptions = {
  maxLength: 10000,
  allowHtml: false
};

/**
 * Sanitize a string value to prevent XSS attacks
 * Uses a simple but effective approach without external dependencies
 */
export function sanitizeString(value: string, options: SanitizationOptions = {}): string {
  const opts = { ...defaultOptions, ...options };
  
  // Check length limit
  if (opts.maxLength && value.length > opts.maxLength) {
    throw new Error(`Input exceeds maximum length of ${opts.maxLength} characters`);
  }
  
  if (!opts.allowHtml) {
    // Remove HTML tags and decode HTML entities
    return value
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#x60;/g, '`')
      .replace(/&#x3D;/g, '=');
  }
  
  return value;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any, options: SanitizationOptions = {}): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeString(key, { maxLength: 100, allowHtml: false });
      sanitized[sanitizedKey] = sanitizeObject(value, options);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Middleware to sanitize request body, query, and params
 */
export function inputSanitization(options: SanitizationOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, options);
      }
      
      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query, options);
      }
      
      // Sanitize route parameters
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params, options);
      }
      
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Invalid input',
        message: error instanceof Error ? error.message : 'Input validation failed'
      });
    }
  };
}

/**
 * Validation schemas for common input types
 */
export const validationSchemas = {
  // Email validation
  email: z.string().email().max(254),
  
  // Username validation (alphanumeric, underscore, hyphen)
  username: z.string().regex(/^[a-zA-Z0-9_-]+$/).min(3).max(30),
  
  // Password validation (strong password requirements)
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/^(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/^(?=.*\d)/, 'Password must contain at least one number')
    .regex(/^(?=.*[@$!%*?&])/, 'Password must contain at least one special character'),
  
  // Phone number validation
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).min(10).max(20),
  
  // Name validation (letters, spaces, hyphens, apostrophes)
  name: z.string().regex(/^[a-zA-Z\s\-']+$/).min(1).max(100),
  
  // Numeric ID validation
  id: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().positive()),
  
  // Text content validation (for descriptions, comments, etc.)
  text: z.string().max(5000),
  
  // URL validation
  url: z.string().url().max(2048),
  
  // Date validation
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  
  // Currency amount validation
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).pipe(z.number().nonnegative()),
};

/**
 * Create a validation middleware for specific schemas
 */
export function validateInput(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate the request body against the schema
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({
          error: 'Validation failed',
          details: errorMessages
        });
      } else {
        res.status(400).json({
          error: 'Invalid input',
          message: 'Request validation failed'
        });
      }
    }
  };
}

/**
 * SQL Injection prevention helpers
 */
export const sqlSafetyHelpers = {
  /**
   * Escape SQL identifiers (table names, column names)
   */
  escapeIdentifier: (identifier: string): string => {
    // Remove any non-alphanumeric characters except underscores
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  },
  
  /**
   * Validate that a string contains only safe characters for SQL
   */
  isSqlSafe: (value: string): boolean => {
    // Check for common SQL injection patterns
    const dangerousPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|\/\*|\*\/)/,
      /(\b(UNION|OR|AND)\b.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/i,
      /(;|\||&)/
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(value));
  }
};

/**
 * Password policy enforcement
 */
export const passwordPolicy = {
  /**
   * Check if password meets complexity requirements
   */
  isValid: (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }
    
    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },
  
  /**
   * Generate a secure random password
   */
  generate: (length: number = 16): string => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '@$!%*?&';
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
};

export default inputSanitization;
