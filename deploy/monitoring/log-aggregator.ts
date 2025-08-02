import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ _component: 'log-aggregator' });

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

// Log entry interface
export interface LogEntry {
  _timestamp: Date;
  _level: LogLevel;
  _message: string;
  _service: string;
  component?: string;
  traceId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  error?: {
    _name: string;
    _message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    _duration: number;
    _memoryUsage: number;
    _cpuUsage: number;
  };
}

// Log filter interface
export interface LogFilter {
  level?: LogLevel;
  service?: string;
  component?: string;
  timeRange?: {
    _start: Date;
    _end: Date;
  };
  keywords?: string[];
  excludeKeywords?: string[];
  userId?: string;
  traceId?: string;
}

// Log aggregation configuration
export interface LogAggregatorConfig {
  storage: {
    type: 'file' | 'database' | 'elasticsearch';
    path?: string;
    _maxFileSize: number;
    _maxFiles: number;
    _retentionDays: number;
  };
  processing: {
    _batchSize: number;
    _batchTimeout: number;
    _enableCompression: boolean;
    _enableEncryption: boolean;
  };
  alerting: {
    _enabled: boolean;
    _errorThreshold: number;
    _errorWindow: number;
    _alertChannels: string[];
  };
  performance: {
    _maxConcurrentProcessors: number;
    _bufferSize: number;
    _flushInterval: number;
  };
}

// Default configuration
const _defaultConfig: LogAggregatorConfig = {
  storage: {
    type: 'file',
    _path: './logs',
    _maxFileSize: 10 * 1024 * 1024, // 10MB
    _maxFiles: 100,
    _retentionDays: 30
  },
  _processing: {
    _batchSize: 1000,
    _batchTimeout: 5000, // 5 seconds
    _enableCompression: true,
    _enableEncryption: false
  },
  _alerting: {
    _enabled: true,
    _errorThreshold: 10,
    _errorWindow: 60000, // 1 minute
    _alertChannels: ['email', 'slack']
  },
  _performance: {
    _maxConcurrentProcessors: 4,
    _bufferSize: 10000,
    _flushInterval: 1000 // 1 second
  }
};

/**
 * Log Aggregator System
 */
export class LogAggregator extends EventEmitter {
  private _config: LogAggregatorConfig;
  private _buffer: LogEntry[] = [];
  private _isProcessing: boolean = false;
  private _errorCount: number = 0;
  private _lastErrorTime: Date = new Date();
  private _currentFile: string = '';
  private _currentFileSize: number = 0;

  constructor(_config: Partial<LogAggregatorConfig> = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.initializeStorage();
    this.startProcessing();
    this.startCleanup();
  }

  /**
   * Initialize storage directory
   */
  private async initializeStorage(): Promise<void> {
    if (this.config.storage.type === 'file' && this.config.storage.path) {
      try {
        await fs.mkdir(this.config.storage.path, { _recursive: true });
        this.currentFile = this.generateFileName();
        logger.info('Log storage initialized', { _path: this.config.storage.path });
      } catch (error) {
        logger.error('Failed to initialize log storage', { error });
        throw error;
      }
    }
  }

  /**
   * Generate log file name with timestamp
   */
  private generateFileName(): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return path.join(this.config.storage.path!, `logs-${timestamp}.jsonl`);
  }

  /**
   * Collect a log entry
   */
  async collect(_entry: LogEntry): Promise<void> {
    try {
      this.buffer.push(entry);

      if (this.buffer.length >= this.config.processing.batchSize) {
        await this.processBatch();
      }

      this.emit('log-collected', entry);

      if (entry.level === LogLevel.ERROR) {
        this.errorCount++;
        this.lastErrorTime = new Date();
        await this.checkErrorThreshold();
      }
    } catch (error) {
      logger.error('Failed to collect log entry', { error, entry });
    }
  }

  /**
   * Process a batch of log entries
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.buffer.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = this.buffer.splice(0, this.config.processing.batchSize);

    try {
      await this.storeLogs(batch);
      this.emit('batch-processed', batch);

      logger.debug('Log batch processed', {
        _originalSize: batch.length,
        _processedSize: batch.length
      });
    } catch (error) {
      logger.error('Failed to process log batch', { error });
      this.buffer.unshift(...batch);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Store logs to storage
   */
  private async storeLogs(_logs: LogEntry[]): Promise<void> {
    if (this.config.storage.type === 'file') {
      await this.storeToFile(logs);
    }
  }

  /**
   * Store logs to file
   */
  private async storeToFile(_logs: LogEntry[]): Promise<void> {
    try {
      if (this.currentFileSize >= this.config.storage.maxFileSize) {
        await this.rotateLogFile();
      }

      const logLines = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
      await fs.appendFile(this.currentFile, logLines);
      this.currentFileSize += Buffer.byteLength(logLines, 'utf8');

      logger.debug('Logs stored to file', {
        _file: this.currentFile,
        _count: logs.length,
        _size: this.currentFileSize
      });
    } catch (error) {
      logger.error('Failed to store logs to file', { error });
      throw error;
    }
  }

  /**
   * Rotate log file
   */
  private async rotateLogFile(): Promise<void> {
    const newFile = this.generateFileName();
    this.currentFile = newFile;
    this.currentFileSize = 0;
    logger.info('Log file rotated', { newFile });
  }

  /**
   * Start background processing
   */
  private startProcessing(): void {
    setInterval(async() => {
      if (this.buffer.length > 0) {
        await this.processBatch();
      }
    }, this.config.processing.batchTimeout);
  }

  /**
   * Start cleanup process
   */
  private startCleanup(): void {
    setInterval(async() => {
      await this.cleanupOldLogs();
    }, 24 * 60 * 60 * 1000); // Run daily
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    if (this.config.storage.type !== 'file' || !this.config.storage.path) {
      return;
    }

    try {
      const files = await fs.readdir(this.config.storage.path);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.storage.retentionDays);

      for (const file of files) {
        if (file.startsWith('logs-') && file.endsWith('.jsonl')) {
          const filePath = path.join(this.config.storage.path!, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            logger.info('Deleted old log file', { file });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old logs', { error });
    }
  }

  /**
   * Check error threshold for alerting
   */
  private async checkErrorThreshold(): Promise<void> {
    const timeSinceLastError = Date.now() - this.lastErrorTime.getTime();

    if (
      this.config.alerting.enabled &&
      this.errorCount >= this.config.alerting.errorThreshold &&
      timeSinceLastError <= this.config.alerting.errorWindow
    ) {
      await this.sendAlert({
        _type: 'error_threshold_exceeded',
        _severity: 'high',
        _title: 'High Error Rate Detected',
        _message: `Error threshold exceeded: ${this.errorCount} errors in ${this.config.alerting.errorWindow}ms`,
        _metadata: {
          _errorCount: this.errorCount,
          _timeWindow: this.config.alerting.errorWindow,
          _threshold: this.config.alerting.errorThreshold
        }
      });

      this.errorCount = 0;
    }
  }

  /**
   * Send alert
   */
  private async sendAlert(_alert: any): Promise<void> {
    this.emit('alert', alert);

    for (const channel of this.config.alerting.alertChannels) {
      try {
        await this.sendAlertToChannel(channel, alert);
      } catch (error) {
        logger.error('Failed to send alert', { channel, error });
      }
    }
  }

  /**
   * Send alert to specific channel
   */
  private async sendAlertToChannel(_channel: string, _alert: any): Promise<void> {
    switch (channel) {
      case 'email':
        logger.info('Email alert sent', { alert });
        break;
      case 'slack':
        logger.info('Slack alert sent', { alert });
        break;
      logger.warn('Unknown alert channel', { channel });
    }
  }

  /**
   * Get buffer status
   */
  getBufferStatus(): { _size: number; _isProcessing: boolean } {
    return {
      _size: this.buffer.length,
      _isProcessing: this.isProcessing
    };
  }

  /**
   * Flush buffer immediately
   */
  async flush(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Shutdown the aggregator
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down log aggregator');
    await this.flush();
    this.removeAllListeners();
  }
}

// Export default instance
export const logAggregator = new LogAggregator();
