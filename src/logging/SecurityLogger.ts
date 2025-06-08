// src/logging/SecurityLogger.ts

import { BaseLogger, LogLevel, LogMeta, LoggableError, Logger, ConsoleLogger } from './Logger';

/**
 * Security event types for categorizing security logs
 */
export enum SecurityEventType {
  AUTHENTICATION = 'AUTHENTICATION', // Login attempts, password resets
  AUTHORIZATION = 'AUTHORIZATION', // Permission checks, access control
  DATA_ACCESS = 'DATA_ACCESS', // Access to sensitive data
  DATA_MODIFICATION = 'DATA_MODIFICATION', // Changes to important data
  CONFIGURATION = 'CONFIGURATION', // System configuration changes
  SYSTEM = 'SYSTEM', // System-level security events
  THREAT = 'THREAT', // Detected security threats
}

/**
 * Security event severity levels
 */
export enum SecuritySeverity {
  INFORMATIONAL = 'INFORMATIONAL', // Normal operations, successful auth
  LOW = 'LOW', // Minor policy violations
  MEDIUM = 'MEDIUM', // Suspicious activities
  HIGH = 'HIGH', // Significant security concerns
  CRITICAL = 'CRITICAL', // Immediate attention required
}

/**
 * Security event metadata structure for consistent logging
 */
export interface SecurityLogMeta extends LogMeta {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string | number; // User who performed the action
  targetId?: string | number; // Target of the action (resource ID)
  resourceType?: string; // Type of resource affected
  outcome: 'SUCCESS' | 'FAILURE'; // Result of the action
  ip?: string; // Source IP address
  userAgent?: string; // User agent
  sessionId?: string; // Session identifier
  details?: Record<string, any>; // Additional security event details
}

/**
 * Enhanced security logger that ensures consistent security event logging
 */
export class SecurityLogger implements Logger {
  private baseLogger: Logger;

  constructor(baseLogger: Logger) {
    this.baseLogger = baseLogger;
  }

  // Implement required Logger interface methods
  setLevel(level: LogLevel): void {
    this.baseLogger.setLevel(level);
  }

  getLevel(): LogLevel {
    return this.baseLogger.getLevel();
  }

  addContext(context: LogMeta): void {
    this.baseLogger.addContext(context);
  }

  child(context: LogMeta): Logger {
    const childLogger = this.baseLogger.child(context);
    return new SecurityLogger(childLogger);
  }

  /**
   * Log a security event with consistent formatting
   */
  logSecurityEvent(message: string, meta: SecurityLogMeta): void {
    // Add standardized prefix to make security events easily searchable
    const securityMessage = `[SECURITY:${meta.eventType}] ${message}`;
    const securityMetadata = { securityEvent: true, ...meta };

    // Log based on security severity directly, without converting to LogLevel enum first
    // This avoids TypeScript comparison issues with enums
    switch (meta.severity) {
      case SecuritySeverity.INFORMATIONAL:
      case SecuritySeverity.LOW:
        this.baseLogger.info(securityMessage, securityMetadata);
        break;
      case SecuritySeverity.MEDIUM:
        this.baseLogger.warn(securityMessage, securityMetadata);
        break;
      case SecuritySeverity.HIGH:
        this.baseLogger.error(securityMessage, securityMetadata);
        break;
      case SecuritySeverity.CRITICAL:
        this.baseLogger.fatal(securityMessage, securityMetadata);
        break;
      default:
        this.baseLogger.info(securityMessage, securityMetadata);
        break;
    }
  }

  /**
   * Log authentication events (login attempts, password resets, etc.)
   */
  logAuthentication(
    message: string,
    outcome: 'SUCCESS' | 'FAILURE',
    severity: SecuritySeverity = SecuritySeverity.INFORMATIONAL,
    meta: Omit<SecurityLogMeta, 'eventType' | 'severity' | 'outcome'> = {}
  ): void {
    this.logSecurityEvent(message, {
      eventType: SecurityEventType.AUTHENTICATION,
      severity,
      outcome,
      ...meta,
    });
  }

  /**
   * Log authorization events (permission checks, access control)
   */
  logAuthorization(
    message: string,
    outcome: 'SUCCESS' | 'FAILURE',
    severity: SecuritySeverity = SecuritySeverity.INFORMATIONAL,
    meta: Omit<SecurityLogMeta, 'eventType' | 'severity' | 'outcome'> = {}
  ): void {
    this.logSecurityEvent(message, {
      eventType: SecurityEventType.AUTHORIZATION,
      severity,
      outcome,
      ...meta,
    });
  }

  /**
   * Log sensitive data access events
   */
  logDataAccess(
    message: string,
    outcome: 'SUCCESS' | 'FAILURE',
    severity: SecuritySeverity = SecuritySeverity.INFORMATIONAL,
    meta: Omit<SecurityLogMeta, 'eventType' | 'severity' | 'outcome'> = {}
  ): void {
    this.logSecurityEvent(message, {
      eventType: SecurityEventType.DATA_ACCESS,
      severity,
      outcome,
      ...meta,
    });
  }

  /**
   * Log data modification events
   */
  logDataModification(
    message: string,
    outcome: 'SUCCESS' | 'FAILURE',
    severity: SecuritySeverity = SecuritySeverity.INFORMATIONAL,
    meta: Omit<SecurityLogMeta, 'eventType' | 'severity' | 'outcome'> = {}
  ): void {
    this.logSecurityEvent(message, {
      eventType: SecurityEventType.DATA_MODIFICATION,
      severity,
      outcome,
      ...meta,
    });
  }

  /**
   * Log configuration change events
   */
  logConfiguration(
    message: string,
    outcome: 'SUCCESS' | 'FAILURE',
    severity: SecuritySeverity = SecuritySeverity.INFORMATIONAL,
    meta: Omit<SecurityLogMeta, 'eventType' | 'severity' | 'outcome'> = {}
  ): void {
    this.logSecurityEvent(message, {
      eventType: SecurityEventType.CONFIGURATION,
      severity,
      outcome,
      ...meta,
    });
  }

  /**
   * Log system-level security events
   */
  logSystem(
    message: string,
    outcome: 'SUCCESS' | 'FAILURE',
    severity: SecuritySeverity = SecuritySeverity.INFORMATIONAL,
    meta: Omit<SecurityLogMeta, 'eventType' | 'severity' | 'outcome'> = {}
  ): void {
    this.logSecurityEvent(message, {
      eventType: SecurityEventType.SYSTEM,
      severity,
      outcome,
      ...meta,
    });
  }

  /**
   * Log detected security threats
   */
  logThreat(
    message: string,
    severity: SecuritySeverity = SecuritySeverity.HIGH,
    meta: Omit<SecurityLogMeta, 'eventType' | 'severity' | 'outcome'> = {}
  ): void {
    this.logSecurityEvent(message, {
      eventType: SecurityEventType.THREAT,
      severity,
      outcome: 'FAILURE', // Threats are always treated as failures
      ...meta,
    });
  }

  // Forward standard logging methods to the base logger
  trace(message: string, meta?: LogMeta): void {
    this.baseLogger.trace(message, meta);
  }

  debug(message: string, meta?: LogMeta): void {
    this.baseLogger.debug(message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.baseLogger.info(message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.baseLogger.warn(message, meta);
  }

  error(message: string, errorOrMeta?: Error | LoggableError | LogMeta, meta?: LogMeta): void {
    if (errorOrMeta instanceof Error) {
      // Handle error object
      this.baseLogger.error(message, errorOrMeta, meta);
    } else {
      // Handle metadata only
      this.baseLogger.error(message, errorOrMeta);
    }
  }

  fatal(message: string, errorOrMeta?: Error | LoggableError | LogMeta, meta?: LogMeta): void {
    if (errorOrMeta instanceof Error) {
      // Handle error object
      this.baseLogger.fatal(message, errorOrMeta, meta);
    } else {
      // Handle metadata only
      this.baseLogger.fatal(message, errorOrMeta);
    }
  }

  // This is an additional helper method beyond the Logger interface
  createChildLogger(): SecurityLogger {
    return new SecurityLogger(this.baseLogger.child({}));
  }
}

/**
 * Create a security logger instance with the provided base logger
 */
export function createSecurityLogger(baseLogger: Logger = new ConsoleLogger()): SecurityLogger {
  return new SecurityLogger(baseLogger);
}

// Default export for convenience
export default createSecurityLogger();
