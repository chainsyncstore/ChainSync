import { EventEmitter } from 'events';
import crypto from 'crypto';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ _component: 'production-security' });

// Security threat levels
export enum ThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Security event types
export enum SecurityEventType {
  SUSPICIOUS_LOGIN = 'suspicious_login',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
}

// Security event interface
export interface SecurityEvent {
  _id: string;
  _type: SecurityEventType;
  _threatLevel: ThreatLevel;
  _timestamp: Date;
  _source: string;
  _description: string;
  _metadata: Record<string, any>;
  ipAddress?: string;
  userId?: string;
  _resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// Security configuration
export interface SecurityConfig {
  auth: {
    _maxLoginAttempts: number;
    _lockoutDuration: number;
    passwordPolicy: {
      _minLength: number;
      _requireUppercase: boolean;
      _requireLowercase: boolean;
      _requireNumbers: boolean;
      _requireSpecialChars: boolean;
    };
    _sessionTimeout: number;
  };
  network: {
    _allowedIPs: string[];
    _blockedIPs: string[];
    _rateLimitWindow: number;
    _rateLimitMax: number;
  };
  data: {
    _encryptionEnabled: boolean;
    _keyRotationInterval: number;
  };
  monitoring: {
    alertThresholds: {
      _failedLogins: number;
      _suspiciousActivities: number;
    };
  };
}

// Default configuration
const _defaultConfig: SecurityConfig = {
  auth: {
    _maxLoginAttempts: 5,
    _lockoutDuration: 15 * 60 * 1000, // 15 minutes
    _passwordPolicy: {
      _minLength: 12,
      _requireUppercase: true,
      _requireLowercase: true,
      _requireNumbers: true,
      _requireSpecialChars: true
    },
    _sessionTimeout: 8 * 60 * 60 * 1000 // 8 hours
  },
  _network: {
    allowedIPs: [],
    _blockedIPs: [],
    _rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    _rateLimitMax: 100
  },
  _data: {
    _encryptionEnabled: true,
    _keyRotationInterval: 30 // 30 days
  },
  _monitoring: {
    alertThresholds: {
      _failedLogins: 10,
      _suspiciousActivities: 5
    }
  }
};

/**
 * Production Security System
 */
export class ProductionSecurity extends EventEmitter {
  private _config: SecurityConfig;
  private _securityEvents: Map<string, SecurityEvent> = new Map();
  private _failedLoginAttempts: Map<string, { _count: number; _lastAttempt: Date }> = new Map();
  private _blockedIPs: Set<string> = new Set();
  private _rateLimitCounters: Map<string, { _count: number; _resetTime: Date }> = new Map();

  constructor(_config: Partial<SecurityConfig> = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.initializeSecurity();
    logger.info('Production Security System initialized');
  }

  /**
   * Initialize security system
   */
  private initializeSecurity(): void {
    this.config.network.blockedIPs.forEach(ip => this.blockedIPs.add(ip));
    this.startPeriodicTasks();
  }

  /**
   * Validate password against security policy
   */
  validatePassword(_password: string): { _valid: boolean; _errors: string[] } {
    const _errors: string[] = [];
    const policy = this.config.auth.passwordPolicy;

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { _valid: errors.length === 0, errors };
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(_ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Block IP address
   */
  blockIP(_ipAddress: string, reason?: string): void {
    this.blockedIPs.add(ipAddress);

    this.createSecurityEvent({
      _type: SecurityEventType.UNAUTHORIZED_ACCESS,
      _threatLevel: ThreatLevel.MEDIUM,
      _source: 'security-system',
      _description: `IP address ${ipAddress} blocked${reason ? `: ${reason}` : ''}`,
      _metadata: { ipAddress, reason }
    });

    logger.warn('IP address blocked', { ipAddress, reason });
  }

  /**
   * Check rate limit for IP
   */
  checkRateLimit(_ipAddress: string): { _allowed: boolean; _remaining: number; _resetTime: Date } {
    const now = new Date();
    const counter = this.rateLimitCounters.get(ipAddress);

    if (!counter || now > counter.resetTime) {
      const resetTime = new Date(now.getTime() + this.config.network.rateLimitWindow);
      this.rateLimitCounters.set(ipAddress, { _count: 1, resetTime });
      return { _allowed: true, _remaining: this.config.network.rateLimitMax - 1, resetTime };
    }

    if (counter.count >= this.config.network.rateLimitMax) {
      this.createSecurityEvent({
        _type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        _threatLevel: ThreatLevel.MEDIUM,
        _source: 'rate-limiter',
        _description: `Rate limit exceeded for IP ${ipAddress}`,
        _metadata: { ipAddress, _count: counter.count, _limit: this.config.network.rateLimitMax },
        ipAddress
      });

      return { _allowed: false, _remaining: 0, _resetTime: counter.resetTime };
    }

    counter.count++;
    return { _allowed: true, _remaining: this.config.network.rateLimitMax - counter.count, _resetTime: counter.resetTime };
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(_ipAddress: string, userId?: string): void {
    const key = `${ipAddress}:${userId || 'unknown'}`;
    const attempt = this.failedLoginAttempts.get(key) || { _count: 0, _lastAttempt: new Date() };

    attempt.count++;
    attempt.lastAttempt = new Date();
    this.failedLoginAttempts.set(key, attempt);

    if (attempt.count >= this.config.auth.maxLoginAttempts) {
      this.blockIP(ipAddress, `Too many failed login _attempts: ${attempt.count}`);

      this.createSecurityEvent({
        _type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        _threatLevel: ThreatLevel.HIGH,
        _source: 'auth-system',
        _description: `Brute force attempt detected for ${userId || 'unknown user'} from ${ipAddress}`,
        _metadata: { ipAddress, userId, _attemptCount: attempt.count },
        ipAddress,
        _userId: userId || ''
      });
    }
  }

  /**
   * Reset failed login attempts
   */
  resetFailedLoginAttempts(_ipAddress: string, userId?: string): void {
    const key = `${ipAddress}:${userId || 'unknown'}`;
    this.failedLoginAttempts.delete(key);
  }

  /**
   * Check if login is locked out
   */
  isLoginLockedOut(_ipAddress: string, userId?: string): boolean {
    const key = `${ipAddress}:${userId || 'unknown'}`;
    const attempt = this.failedLoginAttempts.get(key);

    if (!attempt) return false;

    const timeSinceLastAttempt = Date.now() - attempt.lastAttempt.getTime();
    return attempt.count >= this.config.auth.maxLoginAttempts &&
           timeSinceLastAttempt < this.config.auth.lockoutDuration;
  }

  /**
   * Detect SQL injection attempt
   */
  detectSQLInjection(_input: string): boolean {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /(--|\/\*|\*\/|;)/,
      /(\b(and|or)\b\s+\d+\s*=\s*\d+)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect XSS attempt
   */
  detectXSS(_input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate input for security threats
   */
  validateInput(_input: string, _context: string): { _valid: boolean; _threats: string[] } {
    const _threats: string[] = [];

    if (this.detectSQLInjection(input)) {
      threats.push('SQL_INJECTION');
    }

    if (this.detectXSS(input)) {
      threats.push('XSS');
    }

    if (threats.length > 0) {
      this.createSecurityEvent({
        _type: threats.includes('SQL_INJECTION') ? SecurityEventType._SQL_INJECTION_ATTEMPT : SecurityEventType.XSS_ATTEMPT,
        _threatLevel: ThreatLevel.HIGH,
        _source: 'input-validation',
        _description: `Security threat detected in ${context}: ${threats.join(', ')}`,
        _metadata: { _input: input.substring(0, 100), context, threats }
      });
    }

    return { _valid: threats.length === 0, threats };
  }

  /**
   * Create security event
   */
  createSecurityEvent(_eventData: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): SecurityEvent {
    const _event: SecurityEvent = {
      ...eventData,
      _id: this.generateEventId(),
      _timestamp: new Date(),
      _resolved: false
    };

    this.securityEvents.set(event.id, event);
    this.emit('security-event', event);
    this.checkAlertThresholds(event);

    logger.warn('Security event created', {
      _eventId: event.id,
      _type: event.type,
      _threatLevel: event.threatLevel
    });

    return event;
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(_event: SecurityEvent): void {
    const recentEvents = this.getRecentEvents(15 * 60 * 1000); // Last 15 minutes
    const thresholds = this.config.monitoring.alertThresholds;

    const failedLogins = recentEvents.filter(e => e.type === SecurityEventType.BRUTE_FORCE_ATTEMPT).length;
    if (failedLogins >= thresholds.failedLogins) {
      this.emit('security-alert', {
        _type: 'failed_logins_threshold',
        _message: `High number of failed login attempts: ${failedLogins}`
      });
    }

    const suspiciousActivities = recentEvents.filter(e =>
      e.type === SecurityEventType.SQL_INJECTION_ATTEMPT ||
      e.type === SecurityEventType.XSS_ATTEMPT
    ).length;
    if (suspiciousActivities >= thresholds.suspiciousActivities) {
      this.emit('security-alert', {
        _type: 'suspicious_activities_threshold',
        _message: `High number of suspicious activities: ${suspiciousActivities}`
      });
    }
  }

  /**
   * Get recent security events
   */
  getRecentEvents(_timeWindow: number): SecurityEvent[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return Array.from(this.securityEvents.values())
      .filter(event => event.timestamp > cutoff);
  }

  /**
   * Get security statistics
   */
  getSecurityStatistics(): any {
    const events = Array.from(this.securityEvents.values());
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return {
      _totalEvents: events.length,
      _eventsLast24Hours: events.filter(e => e.timestamp > last24Hours).length,
      _byType: Object.values(SecurityEventType).reduce((acc, type) => {
        acc[type] = events.filter(e => e.type === type).length;
        return acc;
      }, {} as Record<SecurityEventType, number>),
      _byThreatLevel: Object.values(ThreatLevel).reduce((acc, level) => {
        acc[level] = events.filter(e => e.threatLevel === level).length;
        return acc;
      }, {} as Record<ThreatLevel, number>),
      _blockedIPs: this.blockedIPs.size,
      _activeRateLimits: this.rateLimitCounters.size
    };
  }

  /**
   * Start periodic security tasks
   */
  private startPeriodicTasks(): void {
    setInterval(() => {
      this.cleanupOldEvents();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Clean up old security events
   */
  private cleanupOldEvents(): void {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    let deletedCount = 0;

    for (const [id, event] of this.securityEvents) {
      if (event.timestamp < cutoff) {
        this.securityEvents.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info('Cleaned up old security events', { deletedCount });
    }
  }

  /**
   * Generate security event ID
   */
  private generateEventId(): string {
    return `SEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown security system
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Production Security System');
    this.failedLoginAttempts.clear();
    this.rateLimitCounters.clear();
    this.removeAllListeners();
  }
}

// Export default instance
export const productionSecurity = new ProductionSecurity();
