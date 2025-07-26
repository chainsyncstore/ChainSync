"use strict";
/**
 * Shared Logging Utility
 *
 * Provides a consistent logging interface across the application
 * with structured logging and context tracking.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = getLogger;
exports.createRequestLogger = createRequestLogger;
exports.createTransactionLogger = createTransactionLogger;
exports.logPerformance = logPerformance;
exports.measureAndLog = measureAndLog;
const pino_1 = __importDefault(require("pino"));
// Default log level based on environment
const defaultLogLevel = process.env.NODE_ENV === 'production'
    ? 'info'
    : process.env.NODE_ENV === 'test'
        ? 'warn'
        : 'debug';
// Base logger configuration
const baseLoggerConfig = {
    level: process.env.LOG_LEVEL || defaultLogLevel,
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label }),
    },
    redact: {
        paths: [
            'password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'authorization', 'cookie',
            '*.password', '*.passwordHash', '*.token', '*.accessToken', '*.refreshToken', '*.authorization', '*.cookie',
        ],
        censor: '[REDACTED]',
    },
    serializers: pino_1.default.stdSerializers,
};
// Only add transport if not SKIP_LOGGER and not production
if (!process.env.SKIP_LOGGER && process.env.NODE_ENV !== 'production') {
    baseLoggerConfig.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    };
}
const baseLoggerInstance = (0, pino_1.default)(baseLoggerConfig);
/**
 * Get a logger instance
 * Optionally provide context that will be included with all log entries
 */
function getLogger(moduleName, bindings = {} // Changed 'options' to 'bindings' for clarity
) {
    return baseLogger.child({
        module: moduleName, // Add moduleName as a specific binding
        ...bindings, // Spread other bindings
    });
}
/**
 * Create a request-scoped logger with trace ID
 */
function createRequestLogger(requestId, path, method) {
    return baseLogger.child({
        requestId,
        path,
        method,
    });
}
/**
 * Create a transaction logger for tracking database operations
 */
function createTransactionLogger(transactionId) {
    return baseLogger.child({
        transactionId,
        component: 'database',
    });
}
/**
 * Utility to log performance metrics
 */
function logPerformance(operation, durationMs, metadata) {
    const performanceLogger = baseLogger.child({
        component: 'performance',
        ...metadata,
    });
    performanceLogger.info({ operation, durationMs }, `Completed ${operation} in ${durationMs}ms`);
    // Log warning for slow operations
    if (durationMs > 1000) {
        performanceLogger.warn({ operation, durationMs }, `Slow operation: ${operation} took ${durationMs}ms`);
    }
}
/**
 * Measure execution time of a function and log it
 */
async function measureAndLog(operation, fn, metadata) {
    const start = performance.now();
    try {
        const result = await fn();
        const durationMs = Math.round(performance.now() - start);
        logPerformance(operation, durationMs, metadata);
        return result;
    }
    catch (error) {
        const durationMs = Math.round(performance.now() - start);
        const logger = baseLogger.child({
            component: 'performance',
            operation,
            durationMs,
            ...(metadata || {}), // Ensure metadata is an object
        });
        // Use Pino's 'err' binding for better error serialization
        if (error instanceof Error) {
            logger.error({ err: error }, `Error in ${operation} after ${durationMs}ms`);
        }
        else {
            logger.error({ errorDetail: error }, `Error in ${operation} after ${durationMs}ms`);
        }
        throw error;
    }
}
const baseLogger = baseLoggerInstance;
exports.default = baseLogger;
