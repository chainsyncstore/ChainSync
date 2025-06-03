/**
 * Zod validation helpers
 * 
 * This file contains utility functions and common schemas for use with Zod validation
 * throughout the ChainSync application.
 */

import { z, type EnumLike } from 'zod'; // Added EnumLike import

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // Basic types
  uuid: z.string().uuid(),
  email: z.string().email().trim(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, { message: 'Invalid phone number format' }),
  url: z.string().url(),
  nonEmptyString: z.string().trim().min(1, { message: 'Cannot be empty' }),
  positiveNumber: z.number().positive(),
  nonNegativeNumber: z.number().nonnegative(),
  integerString: z.string().regex(/^\d+$/).transform(Number),
  date: z.date(),
  dateString: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((str) => new Date(str)),
  boolean: z.boolean(),
  booleanString: z.enum(['true', 'false']).transform((value) => value === 'true'),
  
  // Common field patterns
  id: z.number().int().positive().or(z.string().uuid()),
  status: z.enum(['active', 'inactive', 'pending', 'deleted']),
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortDirection: z.enum(['asc', 'desc']).optional().default('asc')
  }),
  dateRange: z.object({
    startDate: z.date(),
    endDate: z.date()
  }).refine(data => data.startDate <= data.endDate, {
    message: 'End date must be after start date',
    path: ['endDate']
  })
};

/**
 * Utility functions for schema creation and transformation
 */
export const SchemaUtils = {
  /**
   * Converts string representation of numbers to actual numbers
   */
  stringToNumber: (schema: z.ZodString) => schema.transform((val) => parseFloat(val)),
  
  /**
   * Trims all string values in an object schema
   */
  trimAllStrings: <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => {
    const newShape = Object.entries(schema.shape).reduce((acc, [key, value]) => {
      if (value instanceof z.ZodString) {
        acc[key] = value.transform((val) => val.trim());
      } else if (value instanceof z.ZodObject) {
        acc[key] = SchemaUtils.trimAllStrings(value);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    return z.object(newShape);
  },
  
  /**
   * Creates a schema for optional fields that, if present, must meet validation criteria
   */
  optionalField: <T extends z.ZodTypeAny>(schema: T) => {
    return z.union([schema, z.undefined()]);
  },
  
  /**
   * Creates a schema for fields that can be null or must meet validation criteria
   */
  nullableField: <T extends z.ZodTypeAny>(schema: T) => {
    return z.union([schema, z.null()]);
  },
  
  /**
   * Converts enum values to a Zod schema
   */
  enumToSchema: <T extends string>(enumObj: Record<string, T>) => {
    const values = Object.values(enumObj).filter(value => typeof value === 'string') as [T, ...T[]];
    return z.enum(values);
  },
  
  /**
   * Converts number enum values to a Zod schema
   */
  numberEnumToSchema: <T extends EnumLike>(enumObj: T) => { // Changed constraint to EnumLike
    return z.nativeEnum(enumObj);
  },
  
  /**
   * Creates a schema for ID validation with appropriate error message
   */
  idValidator: (entityName: string) => {
    return z.number().int().positive({ 
      message: `Invalid ${entityName} ID. Must be a positive integer.` 
    }).or(
      z.string().uuid({ message: `Invalid ${entityName} ID. Must be a valid UUID.` })
    );
  }
};

/**
 * Common error messages for validation
 */
export const ValidationErrorMessages = {
  required: (field: string) => `${field} is required`,
  invalid: (field: string) => `Invalid ${field}`,
  minLength: (field: string, min: number) => `${field} must be at least ${min} characters`,
  maxLength: (field: string, max: number) => `${field} must be at most ${max} characters`,
  format: (field: string, format: string) => `${field} must be in ${format} format`,
  enum: (field: string, values: string[]) => `${field} must be one of: ${values.join(', ')}`,
  number: {
    min: (field: string, min: number) => `${field} must be at least ${min}`,
    max: (field: string, max: number) => `${field} must be at most ${max}`,
    integer: (field: string) => `${field} must be an integer`,
    positive: (field: string) => `${field} must be positive`,
    nonNegative: (field: string) => `${field} must be zero or positive`
  }
};

/**
 * Helper functions for common schema validation patterns
 */
export const ValidationHelpers = {
  /**
   * Safely converts input to string, handling various input types
   */
  safeToString: (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return String(value);
      }
    }
    return String(value);
  },
  
  /**
   * Safely parse a string to a number, returning null if invalid
   */
  safeParseNumber: (value: unknown): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    return isNaN(num) ? null : num;
  },
  
  /**
   * Creates a formatted validation error response
   */
  formatZodError: (error: z.ZodError): Record<string, string[]> => {
    const formattedErrors: Record<string, string[]> = {};
    
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(err.message);
    });
    
    return formattedErrors;
  }
};

/**
 * Type definitions for commonly used validation structures
 */
export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
};

/**
 * Utility function to run validation and return a standardized result
 */
export function validateWithZod<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: ValidationHelpers.formatZodError(error)
      };
    }
    throw error;
  }
}
