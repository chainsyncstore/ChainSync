"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.ErrorCode = exports.RetryableError = exports.ErrorCategory = void 0;
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["VALIDATION"] = "VALIDATION";
    ErrorCategory["AUTHENTICATION"] = "AUTHENTICATION";
    ErrorCategory["RESOURCE"] = "RESOURCE";
    ErrorCategory["DATABASE"] = "DATABASE";
    ErrorCategory["BUSINESS"] = "BUSINESS";
    ErrorCategory["SYSTEM"] = "SYSTEM";
    ErrorCategory["IMPORT_EXPORT"] = "IMPORT_EXPORT";
    ErrorCategory["PROCESSING"] = "PROCESSING";
    ErrorCategory["INVALID_FORMAT"] = "INVALID_FORMAT";
    ErrorCategory["EXPORT_ERROR"] = "EXPORT_ERROR";
    ErrorCategory["DATABASE_ERROR"] = "DATABASE_ERROR";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
var RetryableError;
(function (RetryableError) {
    // Temporary errors that might succeed if retried
    RetryableError["TEMPORARY_UNAVAILABLE"] = "TEMPORARY_UNAVAILABLE";
    RetryableError["RATE_LIMITED"] = "RATE_LIMITED";
    RetryableError["TIMEOUT"] = "TIMEOUT";
    RetryableError["NETWORK_ERROR"] = "NETWORK_ERROR";
    RetryableError["CONNECTION_LOST"] = "CONNECTION_LOST";
    RetryableError["LOCKED_RESOURCE"] = "LOCKED_RESOURCE";
})(RetryableError || (exports.RetryableError = RetryableError = {}));
var ErrorCode;
(function (ErrorCode) {
    // Success codes
    ErrorCode["SUCCESS"] = "SUCCESS";
    ErrorCode["CREATED"] = "CREATED";
    ErrorCode["UPDATED"] = "UPDATED";
    ErrorCode["DELETED"] = "DELETED";
    // Client errors
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["METHOD_NOT_ALLOWED"] = "METHOD_NOT_ALLOWED";
    ErrorCode["NOT_ACCEPTABLE"] = "NOT_ACCEPTABLE";
    ErrorCode["REQUEST_TIMEOUT"] = "REQUEST_TIMEOUT";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["GONE"] = "GONE";
    ErrorCode["LENGTH_REQUIRED"] = "LENGTH_REQUIRED";
    ErrorCode["PRECONDITION_FAILED"] = "PRECONDITION_FAILED";
    ErrorCode["PAYLOAD_TOO_LARGE"] = "PAYLOAD_TOO_LARGE";
    ErrorCode["URI_TOO_LONG"] = "URI_TOO_LONG";
    ErrorCode["UNSUPPORTED_MEDIA_TYPE"] = "UNSUPPORTED_MEDIA_TYPE";
    ErrorCode["RANGE_NOT_SATISFIABLE"] = "RANGE_NOT_SATISFIABLE";
    ErrorCode["EXPECTATION_FAILED"] = "EXPECTATION_FAILED";
    ErrorCode["IM_A_TEAPOT"] = "IM_A_TEAPOT";
    ErrorCode["MISDIRECTED_REQUEST"] = "MISDIRECTED_REQUEST";
    ErrorCode["UNPROCESSABLE_ENTITY"] = "UNPROCESSABLE_ENTITY";
    ErrorCode["LOCKED"] = "LOCKED";
    ErrorCode["FAILED_DEPENDENCY"] = "FAILED_DEPENDENCY";
    ErrorCode["TOO_MANY_REQUESTS"] = "TOO_MANY_REQUESTS";
    ErrorCode["REQUEST_HEADER_FIELDS_TOO_LARGE"] = "REQUEST_HEADER_FIELDS_TOO_LARGE";
    ErrorCode["UNAVAILABLE_FOR_LEGAL_REASONS"] = "UNAVAILABLE_FOR_LEGAL_REASONS";
    // Server errors
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
    ErrorCode["BAD_GATEWAY"] = "BAD_GATEWAY";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["GATEWAY_TIMEOUT"] = "GATEWAY_TIMEOUT";
    ErrorCode["HTTP_VERSION_NOT_SUPPORTED"] = "HTTP_VERSION_NOT_SUPPORTED";
    ErrorCode["VARIANT_ALSO_NEGOTIATES"] = "VARIANT_ALSO_NEGOTIATES";
    ErrorCode["INSUFFICIENT_STORAGE"] = "INSUFFICIENT_STORAGE";
    ErrorCode["LOOP_DETECTED"] = "LOOP_DETECTED";
    ErrorCode["NOT_EXTENDED"] = "NOT_EXTENDED";
    ErrorCode["NETWORK_AUTHENTICATION_REQUIRED"] = "NETWORK_AUTHENTICATION_REQUIRED";
    // Custom errors
    ErrorCode["INVALID_FIELD_VALUE"] = "INVALID_FIELD_VALUE";
    ErrorCode["DUPLICATE_ENTRY"] = "DUPLICATE_ENTRY";
    ErrorCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorCode["INVALID_TOKEN"] = "INVALID_TOKEN";
    ErrorCode["EXPIRED_TOKEN"] = "EXPIRED_TOKEN";
    ErrorCode["INVALID_REFRESH_TOKEN"] = "INVALID_REFRESH_TOKEN";
    ErrorCode["INVALID_RESET_TOKEN"] = "INVALID_RESET_TOKEN";
    ErrorCode["INVALID_VERIFICATION_TOKEN"] = "INVALID_VERIFICATION_TOKEN";
    ErrorCode["EXPIRED_RESET_TOKEN"] = "EXPIRED_RESET_TOKEN";
    ErrorCode["EXPIRED_VERIFICATION_TOKEN"] = "EXPIRED_VERIFICATION_TOKEN";
    ErrorCode["INVALID_STATE"] = "INVALID_STATE";
    ErrorCode["INVALID_OPERATION"] = "INVALID_OPERATION";
    ErrorCode["INVALID_FORMAT"] = "INVALID_FORMAT";
    ErrorCode["INVALID_PERMISSION"] = "INVALID_PERMISSION";
    ErrorCode["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    ErrorCode["RESOURCE_ALREADY_EXISTS"] = "RESOURCE_ALREADY_EXISTS";
    ErrorCode["RESOURCE_LOCKED"] = "RESOURCE_LOCKED";
    ErrorCode["INVALID_PASSWORD"] = "INVALID_PASSWORD";
    ErrorCode["WEAK_PASSWORD"] = "WEAK_PASSWORD";
    ErrorCode["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    ErrorCode["USER_ALREADY_EXISTS"] = "USER_ALREADY_EXISTS";
    ErrorCode["EMAIL_ALREADY_EXISTS"] = "EMAIL_ALREADY_EXISTS";
    ErrorCode["EMAIL_NOT_VERIFIED"] = "EMAIL_NOT_VERIFIED";
    ErrorCode["EMAIL_VERIFICATION_FAILED"] = "EMAIL_VERIFICATION_FAILED";
    ErrorCode["PASSWORD_RESET_FAILED"] = "PASSWORD_RESET_FAILED";
    ErrorCode["PASSWORD_CHANGE_FAILED"] = "PASSWORD_CHANGE_FAILED";
    ErrorCode["EMAIL_CHANGE_FAILED"] = "EMAIL_CHANGE_FAILED";
    ErrorCode["EMAIL_CHANGE_UNAUTHORIZED"] = "EMAIL_CHANGE_UNAUTHORIZED";
    ErrorCode["EMAIL_CHANGE_ALREADY_EXISTS"] = "EMAIL_CHANGE_ALREADY_EXISTS";
    ErrorCode["EMAIL_CHANGE_VERIFICATION_FAILED"] = "EMAIL_CHANGE_VERIFICATION_FAILED";
    ErrorCode["EMAIL_CHANGE_EXPIRED"] = "EMAIL_CHANGE_EXPIRED";
    ErrorCode["EMAIL_CHANGE_INVALID"] = "EMAIL_CHANGE_INVALID";
    ErrorCode["EMAIL_CHANGE_NOT_REQUESTED"] = "EMAIL_CHANGE_NOT_REQUESTED";
    ErrorCode["EMAIL_CHANGE_TOO_FREQUENT"] = "EMAIL_CHANGE_TOO_FREQUENT";
    ErrorCode["EMAIL_CHANGE_RATE_LIMIT"] = "EMAIL_CHANGE_RATE_LIMIT";
    ErrorCode["EMAIL_CHANGE_MAX_ATTEMPTS"] = "EMAIL_CHANGE_MAX_ATTEMPTS";
    ErrorCode["EMAIL_CHANGE_LOCKED"] = "EMAIL_CHANGE_LOCKED";
    ErrorCode["EMAIL_CHANGE_PENDING"] = "EMAIL_CHANGE_PENDING";
    ErrorCode["EMAIL_CHANGE_SUCCESS"] = "EMAIL_CHANGE_SUCCESS";
    ErrorCode["EMAIL_CHANGE_REQUESTED"] = "EMAIL_CHANGE_REQUESTED";
    ErrorCode["EMAIL_CHANGE_VERIFIED"] = "EMAIL_CHANGE_VERIFIED";
    ErrorCode["EMAIL_CHANGE_CANCELLED"] = "EMAIL_CHANGE_CANCELLED";
    ErrorCode["IMPORT_FAILED"] = "IMPORT_FAILED";
    ErrorCode["EXPORT_FAILED"] = "EXPORT_FAILED";
    ErrorCode["INVALID_IMPORT_FILE"] = "INVALID_IMPORT_FILE";
    ErrorCode["INVALID_EXPORT_FILE"] = "INVALID_EXPORT_FILE";
    ErrorCode["IMPORT_ALREADY_IN_PROGRESS"] = "IMPORT_ALREADY_IN_PROGRESS";
    ErrorCode["EXPORT_ALREADY_IN_PROGRESS"] = "EXPORT_ALREADY_IN_PROGRESS";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["FOREIGN_KEY_CONSTRAINT_VIOLATION"] = "FOREIGN_KEY_CONSTRAINT_VIOLATION";
    // Additional error codes referenced in the codebase
    ErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    ErrorCode["REQUIRED_FIELD_MISSING"] = "REQUIRED_FIELD_MISSING";
    ErrorCode["INVALID_FILE"] = "INVALID_FILE";
    ErrorCode["PROCESSING_ERROR"] = "PROCESSING_ERROR";
    ErrorCode["EXPORT_ERROR"] = "EXPORT_ERROR";
    ErrorCode["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCode["INVALID_REQUEST"] = "INVALID_REQUEST";
    ErrorCode["CONFIGURATION_ERROR"] = "CONFIGURATION_ERROR";
    ErrorCode["TEMPORARY_UNAVAILABLE"] = "TEMPORARY_UNAVAILABLE";
    ErrorCode["INSUFFICIENT_STOCK"] = "INSUFFICIENT_STOCK";
    ErrorCode["INSUFFICIENT_BALANCE"] = "INSUFFICIENT_BALANCE";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class AppError extends Error {
    constructor(message, category, code, details, statusCode, retryable, retryAfter, validationErrors) {
        super(message);
        this.code = code;
        this.category = category;
        this.details = details;
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.retryAfter = retryAfter;
        this.validationErrors = validationErrors;
    }
    static fromZodError(error) {
        return new AppError('Validation failed', ErrorCategory.VALIDATION, ErrorCode.VALIDATION_ERROR, {
            validationErrors: error.errors.map((issue) => ({
                path: issue.path,
                message: issue.message,
                type: issue.code
            }))
        });
    }
    static isValidationError(error) {
        return error.name === 'ValidationError' && 'errors' in error;
    }
    static isMongoError(error) {
        return error.name === 'MongoError' && 'code' in error;
    }
    static fromDatabaseError(error) {
        if (AppError.isValidationError(error)) {
            return new AppError('Database validation failed', ErrorCategory.VALIDATION, ErrorCode.INVALID_FIELD_VALUE, {
                errors: error.errors
            });
        }
        if (AppError.isMongoError(error)) {
            if (error.code === 11000) {
                return new AppError('Duplicate entry', ErrorCategory.DATABASE, ErrorCode.DUPLICATE_ENTRY, {
                    keyValue: error.keyValue
                });
            }
            // Handle other MongoDB error codes
            if (error.code === 11001 || error.code === 11002) {
                return new AppError('Duplicate entry', ErrorCategory.DATABASE, ErrorCode.DUPLICATE_ENTRY, {
                    keyValue: error.keyValue
                });
            }
            // Handle foreign key constraint violation
            if (error.code === 11003) {
                return new AppError('Foreign key constraint violation', ErrorCategory.DATABASE, ErrorCode.FOREIGN_KEY_CONSTRAINT_VIOLATION, {
                    keyValue: error.keyValue
                });
            }
            // Handle other database errors
            return new AppError('Database error', ErrorCategory.DATABASE, ErrorCode.DATABASE_ERROR, {
                message: error.message
            });
        }
        // Handle other database errors
        return new AppError('Database error', ErrorCategory.DATABASE, ErrorCode.DATABASE_ERROR, {
            message: error.message
        });
    }
    static fromAuthenticationError(error) {
        return new AppError('Authentication error', ErrorCategory.AUTHENTICATION, ErrorCode.UNAUTHORIZED, {
            message: error.message
        });
    }
    static fromResourceError(error) {
        return new AppError('Resource error', ErrorCategory.RESOURCE, ErrorCode.NOT_FOUND, {
            message: error.message
        });
    }
    static fromBusinessError(error) {
        return new AppError('Business error', ErrorCategory.BUSINESS, ErrorCode.BAD_REQUEST, {
            message: error.message
        });
    }
    static fromSystemError(error) {
        return new AppError('System error', ErrorCategory.SYSTEM, ErrorCode.INTERNAL_SERVER_ERROR, {
            message: error.message
        });
    }
    static fromImportExportError(error) {
        return new AppError('Import/export error', ErrorCategory.IMPORT_EXPORT, ErrorCode.BAD_REQUEST, {
            message: error.message
        });
    }
    static fromProcessingError(error) {
        return new AppError('Processing error', ErrorCategory.PROCESSING, ErrorCode.INTERNAL_SERVER_ERROR, {
            message: error.message
        });
    }
    static fromInvalidFormatError(error) {
        return new AppError('Invalid format error', ErrorCategory.INVALID_FORMAT, ErrorCode.BAD_REQUEST, {
            message: error.message
        });
    }
    static fromExportError(error) {
        return new AppError('Export error', ErrorCategory.EXPORT_ERROR, ErrorCode.INTERNAL_SERVER_ERROR, {
            message: error.message
        });
    }
    static fromRetryableError(error) {
        return new AppError('Retryable error', ErrorCategory.SYSTEM, ErrorCode.INTERNAL_SERVER_ERROR, {
            message: error.message
        });
    }
    get status() {
        switch (this.code) {
            case ErrorCode.INVALID_FIELD_VALUE:
            case ErrorCode.INVALID_FORMAT:
            case ErrorCode.INVALID_PERMISSION:
                return 400;
            case ErrorCode.UNAUTHORIZED:
            case ErrorCode.EXPIRED_TOKEN:
                return 401;
            case ErrorCode.FORBIDDEN:
                return 403;
            case ErrorCode.NOT_FOUND:
                return 404;
            case ErrorCode.METHOD_NOT_ALLOWED:
                return 405;
            case ErrorCode.NOT_ACCEPTABLE:
                return 406;
            case ErrorCode.REQUEST_TIMEOUT:
                return 408;
            case ErrorCode.CONFLICT:
                return 409;
            case ErrorCode.GONE:
                return 410;
            case ErrorCode.LENGTH_REQUIRED:
                return 411;
            case ErrorCode.PRECONDITION_FAILED:
                return 412;
            case ErrorCode.PAYLOAD_TOO_LARGE:
                return 413;
            case ErrorCode.URI_TOO_LONG:
                return 414;
            case ErrorCode.UNSUPPORTED_MEDIA_TYPE:
                return 415;
            case ErrorCode.RANGE_NOT_SATISFIABLE:
                return 416;
            case ErrorCode.EXPECTATION_FAILED:
                return 417;
            case ErrorCode.IM_A_TEAPOT:
                return 418;
            case ErrorCode.MISDIRECTED_REQUEST:
                return 421;
            case ErrorCode.UNPROCESSABLE_ENTITY:
                return 422;
            case ErrorCode.LOCKED:
                return 423;
            case ErrorCode.FAILED_DEPENDENCY:
                return 424;
            case ErrorCode.TOO_MANY_REQUESTS:
                return 429;
            case ErrorCode.REQUEST_HEADER_FIELDS_TOO_LARGE:
                return 431;
            case ErrorCode.UNAVAILABLE_FOR_LEGAL_REASONS:
                return 451;
            case ErrorCode.FOREIGN_KEY_CONSTRAINT_VIOLATION:
            case ErrorCode.DUPLICATE_ENTRY:
                return 400;
            case ErrorCode.INTERNAL_SERVER_ERROR:
                return 500;
            case ErrorCode.NOT_IMPLEMENTED:
                return 501;
            case ErrorCode.BAD_GATEWAY:
                return 502;
            case ErrorCode.SERVICE_UNAVAILABLE:
                return 503;
            case ErrorCode.GATEWAY_TIMEOUT:
                return 504;
            case ErrorCode.HTTP_VERSION_NOT_SUPPORTED:
                return 505;
            case ErrorCode.VARIANT_ALSO_NEGOTIATES:
                return 506;
            case ErrorCode.INSUFFICIENT_STORAGE:
                return 507;
            case ErrorCode.LOOP_DETECTED:
                return 508;
            case ErrorCode.NOT_EXTENDED:
                return 510;
            case ErrorCode.NETWORK_AUTHENTICATION_REQUIRED:
                return 511;
            default:
                return 500;
        }
    }
}
exports.AppError = AppError;
