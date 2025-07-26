"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateParams = exports.validateRequest = void 0;
const zod_1 = require("zod");
const errors_1 = require("@shared/types/errors");
const validateRequest = (schema, data) => {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw errors_1.AppError.fromZodError(error);
        }
        throw new errors_1.AppError('Request validation failed', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.VALIDATION_FAILED, { details: error }, 400);
    }
};
exports.validateRequest = validateRequest;
const validateParams = (schema, params) => {
    try {
        return schema.parse(params);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw errors_1.AppError.fromZodError(error);
        }
        throw new errors_1.AppError('Route parameter validation failed', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.VALIDATION_FAILED, { details: error }, 400);
    }
};
exports.validateParams = validateParams;
const validateQuery = (schema, query) => {
    try {
        return schema.parse(query);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw errors_1.AppError.fromZodError(error);
        }
        throw new errors_1.AppError('Query parameter validation failed', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.VALIDATION_FAILED, { details: error }, 400);
    }
};
exports.validateQuery = validateQuery;
