"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.validateBody = validateBody;
exports.validateParams = validateParams;
exports.validateQuery = validateQuery;
const zod_1 = require("zod");
const index_js_1 = require("../../src/logging/index.js");
// Get centralized logger for validation middleware
const logger = (0, index_js_1.getLogger)().child({ component: 'validation-middleware' });
/**
 * Custom error class for validation failures
 */
class ValidationError extends Error {
    constructor(message, errors) {
        super(message);
        this.status = 400;
        this.code = 'VALIDATION_ERROR';
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
exports.ValidationError = ValidationError;
/**
 * Validate request body against a Zod schema
 */
function validateBody(schema) {
    return (req, res, next) => {
        const reqLogger = (0, index_js_1.getRequestLogger)(req) || logger;
        try {
            // Parse and validate request body
            const validatedData = schema.parse(req.body);
            // Replace request body with validated data
            req.body = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                reqLogger.warn('Request body validation failed', {
                    path: req.path,
                    method: req.method,
                    validationErrors: error.errors.map(err => ({
                        path: err.path.join('.'),
                        message: err.message
                    }))
                });
                const validationError = new ValidationError('Invalid request data', error);
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
function validateParams(schema) {
    return (req, res, next) => {
        const reqLogger = (0, index_js_1.getRequestLogger)(req) || logger;
        try {
            // Parse and validate URL parameters
            const validatedData = schema.parse(req.params);
            // Replace request params with validated data
            req.params = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                reqLogger.warn('Request params validation failed', {
                    path: req.path,
                    method: req.method,
                    validationErrors: error.errors.map(err => ({
                        path: err.path.join('.'),
                        message: err.message
                    }))
                });
                const validationError = new ValidationError('Invalid URL parameters', error);
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
function validateQuery(schema) {
    return (req, res, next) => {
        const reqLogger = (0, index_js_1.getRequestLogger)(req) || logger;
        try {
            // Parse and validate query parameters
            const validatedData = schema.parse(req.query);
            // Replace request query with validated data
            req.query = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                reqLogger.warn('Request query validation failed', {
                    path: req.path,
                    method: req.method,
                    validationErrors: error.errors.map(err => ({
                        path: err.path.join('.'),
                        message: err.message
                    }))
                });
                const validationError = new ValidationError('Invalid query parameters', error);
                return res.status(400).json(validationError.toJSON());
            }
            // Pass other errors to the error handler
            next(error);
        }
    };
}
