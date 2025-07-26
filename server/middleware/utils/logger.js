"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadMetricsTracker = exports.logger = void 0;
const winston_1 = require("winston");
const { combine, timestamp, json, printf } = winston_1.format;
const customFormat = printf(({ level, message, timestamp, ...meta }) => {
    return `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`;
});
exports.logger = (0, winston_1.createLogger)({
    level: 'info',
    format: combine(timestamp(), customFormat),
    transports: [
        new winston_1.transports.Console(),
        new winston_1.transports.File({ filename: 'uploads.log' })
    ]
});
class UploadMetricsTracker {
    constructor() {
        this.metrics = {
            totalRequests: 0,
            successfulUploads: 0,
            failedUploads: 0,
            averageUploadTime: 0,
            currentMemoryUsage: 0,
            maxMemoryUsage: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        this.startTime = Date.now();
    }
    static getInstance() {
        if (!UploadMetricsTracker.instance) {
            UploadMetricsTracker.instance = new UploadMetricsTracker();
        }
        return UploadMetricsTracker.instance;
    }
    trackRequest() {
        this.metrics.totalRequests++;
    }
    trackSuccess() {
        this.metrics.successfulUploads++;
    }
    trackFailure() {
        this.metrics.failedUploads++;
    }
    trackMemoryUsage(memoryUsage) {
        this.metrics.currentMemoryUsage = memoryUsage;
        this.metrics.maxMemoryUsage = Math.max(this.metrics.maxMemoryUsage, memoryUsage);
    }
    trackCacheHit() {
        this.metrics.cacheHits++;
    }
    trackCacheMiss() {
        this.metrics.cacheMisses++;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    logMetrics() {
        const uptime = (Date.now() - this.startTime) / 1000;
        const metrics = this.getMetrics();
        exports.logger.info('Upload Metrics Report', {
            uptime,
            ...metrics,
            successRate: metrics.totalRequests > 0
                ? (metrics.successfulUploads / metrics.totalRequests) * 100
                : 0
        });
    }
}
exports.UploadMetricsTracker = UploadMetricsTracker;
