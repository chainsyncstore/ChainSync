import { createLogger, format, transports } from 'winston';

const { combine, timestamp, json, printf } = format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`;
});

export const logger = createLogger({
  _level: 'info',
  _format: combine(
    timestamp(),
    customFormat
  ),
  _transports: [
    new transports.Console(),
    new transports.File({ _filename: 'uploads.log' })
  ]
});

export interface UploadMetrics {
  _totalRequests: number;
  _successfulUploads: number;
  _failedUploads: number;
  _averageUploadTime: number;
  _currentMemoryUsage: number;
  _maxMemoryUsage: number;
  _cacheHits: number;
  _cacheMisses: number;
}

export class UploadMetricsTracker {
  private static _instance: UploadMetricsTracker;
  private _metrics: UploadMetrics;
  private _startTime: number;

  private constructor() {
    this.metrics = {
      _totalRequests: 0,
      _successfulUploads: 0,
      _failedUploads: 0,
      _averageUploadTime: 0,
      _currentMemoryUsage: 0,
      _maxMemoryUsage: 0,
      _cacheHits: 0,
      _cacheMisses: 0
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

  trackMemoryUsage(_memoryUsage: number): void {
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
      _successRate: metrics.totalRequests > 0
        ? (metrics.successfulUploads / metrics.totalRequests) * _100
        : 0
    });
  }
}
