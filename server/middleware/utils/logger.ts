import { createLogger, format, transports } from 'winston';
import { FileUploadProgress } from '../types/index';
// Removed unused and broken import: import { ErrorCategory, ErrorCode } from '../types/error';

const { combine, timestamp, json, printf } = format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`;
});

export const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    customFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'uploads.log' })
  ]
});

export interface UploadMetrics {
  totalRequests: number;
  successfulUploads: number;
  failedUploads: number;
  averageUploadTime: number;
  currentMemoryUsage: number;
  maxMemoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
}

export class UploadMetricsTracker {
  private static instance: UploadMetricsTracker;
  private metrics: UploadMetrics;
  private startTime: number;

  private constructor() {
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

  public static getInstance(): UploadMetricsTracker {
    if (!UploadMetricsTracker.instance) {
      UploadMetricsTracker.instance = new UploadMetricsTracker();
    }
    return UploadMetricsTracker.instance;
  }

  trackRequest(): void {
    this.metrics.totalRequests++;
  }

  trackSuccess(): void {
    this.metrics.successfulUploads++;
  }

  trackFailure(): void {
    this.metrics.failedUploads++;
  }

  trackMemoryUsage(memoryUsage: number): void {
    this.metrics.currentMemoryUsage = memoryUsage;
    this.metrics.maxMemoryUsage = Math.max(this.metrics.maxMemoryUsage, memoryUsage);
  }

  trackCacheHit(): void {
    this.metrics.cacheHits++;
  }

  trackCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  getMetrics(): UploadMetrics {
    return { ...this.metrics };
  }

  logMetrics(): void {
    const uptime = (Date.now() - this.startTime) / 1000;
    const metrics = this.getMetrics();
    logger.info('Upload Metrics Report', {
      uptime,
      ...metrics,
      successRate: metrics.totalRequests > 0 
        ? (metrics.successfulUploads / metrics.totalRequests) * 100
        : 0
    });
  }
}
