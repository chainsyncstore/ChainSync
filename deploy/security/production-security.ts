import { EventEmitter } from 'events';
import crypto from 'crypto';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'production-security' });

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
  id: string;
  type: SecurityEventType;
  threatLevel: ThreatLevel;
  timestamp: Date;
  source: string;
  description: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userId?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// Security configuration
export interface SecurityConfig {
  auth: {
    maxLoginAttempts: number;
    lockoutDuration: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
    sessionTimeout: number;
  };
  network: {
    allowedIPs: string[];
    blockedIPs: string[];
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  data: {
    encryptionEnabled: boolean;
    keyRotationInterval: number;
  };
  monitoring: {
    alertThresholds: {
      failedLogins: number;
      suspiciousActivities: number;
    };
  };
}

// Default configuration
const defaultConfig: SecurityConfig = {
  auth: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
  },
  network: {
    allowedIPs: [],
    blockedIPs: [],
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100,
  },
  data: {
    encryptionEnabled: true,
    keyRotationInterval: 30, // 30 days
  },
  monitoring: {
    alertThresholds: {
      failedLogins: 10,
      suspiciousActivities: 5,
    },
  },
};

/**
 * Production Security System
 */
export class ProductionSecurity extends EventEmitter {
  private config: SecurityConfig;
  private securityEvents: Map<string, SecurityEvent> = new Map();
  private failedLoginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();
  private blockedIPs: Set<string> = new Set();
  private rateLimitCounters: Map<string, { count: number; resetTime: Date }> = new Map();

  constructor(config: Partial<SecurityConfig> = {}) {
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
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
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

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Block IP address
   */
  blockIP(ipAddress: string, reason?: string): void {
    this.blockedIPs.add(ipAddress);
    
    this.createSecurityEvent({
      type: SecurityEventType.UNAUTHORIZED_ACCESS,
      threatLevel: ThreatLevel.MEDIUM,
      source: 'security-system',
      description: `IP address ${ipAddress} blocked${reason ? `: ${reason}` : ''}`,
      metadata: { ipAddress, reason },
    });

    logger.warn('IP address blocked', { ipAddress, reason });
  }

  /**
   * Check rate limit for IP
   */
  checkRateLimit(ipAddress: string): { allowed: boolean; remaining: number; resetTime: Date } {
    const now = new Date();
    const counter = this.rateLimitCounters.get(ipAddress);

    if (!counter || now > counter.resetTime) {
      const resetTime = new Date(now.getTime() + this.config.network.rateLimitWindow);
      this.rateLimitCounters.set(ipAddress, { count: 1, resetTime });
      return { allowed: true, remaining: this.config.network.rateLimitMax - 1, resetTime };
    }

    if (counter.count >= this.config.network.rateLimitMax) {
      this.createSecurityEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        threatLevel: ThreatLevel.MEDIUM,
        source: 'rate-limiter',
        description: `Rate limit exceeded for IP ${ipAddress}`,
        metadata: { ipAddress, count: counter.count, limit: this.config.network.rateLimitMax },
        ipAddress,
      });

      return { allowed: false, remaining: 0, resetTime: counter.resetTime };
    }

    counter.count++;
    return { allowed: true, remaining: this.config.network.rateLimitMax - counter.count, resetTime: counter.resetTime };
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(ipAddress: string, userId?: string): void {
    const key = `${ipAddress}:${userId || 'unknown'}`;
    const attempt = this.failedLoginAttempts.get(key) || { count: 0, lastAttempt: new Date() };

    attempt.count++;
    attempt.lastAttempt = new Date();
    this.failedLoginAttempts.set(key, attempt);

    if (attempt.count >= this.config.auth.maxLoginAttempts) {
      this.blockIP(ipAddress, `Too many failed login attempts: ${attempt.count}`);
      
      this.createSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        threatLevel: ThreatLevel.HIGH,
        source: 'auth-system',
        description: `Brute force attempt detected for ${userId || 'unknown user'} from ${ipAddress}`,
        metadata: { ipAddress, userId, attemptCount: attempt.count },
        ipAddress,
        userId: userId || '',
      });
    }
  }

  /**
   * Reset failed login attempts
   */
  resetFailedLoginAttempts(ipAddress: string, userId?: string): void {
    const key = `${ipAddress}:${userId || 'unknown'}`;
    this.failedLoginAttempts.delete(key);
  }

  /**
   * Check if login is locked out
   */
  isLoginLockedOut(ipAddress: string, userId?: string): boolean {
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
  detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /(--|\/\*|\*\/|;)/,
      /(\b(and|or)\b\s+\d+\s*=\s*\d+)/i,
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect XSS attempt
   */
  detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate input for security threats
   */
  validateInput(input: string, context: string): { valid: boolean; threats: string[] } {
    const threats: string[] = [];

    if (this.detectSQLInjection(input)) {
      threats.push('SQL_INJECTION');
    }

    if (this.detectXSS(input)) {
      threats.push('XSS');
    }

    if (threats.length > 0) {
      this.createSecurityEvent({
        type: threats.includes('SQL_INJECTION') ? SecurityEventType.SQL_INJECTION_ATTEMPT : SecurityEventType.XSS_ATTEMPT,
        threatLevel: ThreatLevel.HIGH,
        source: 'input-validation',
        description: `Security threat detected in ${context}: ${threats.join(', ')}`,
        metadata: { input: input.substring(0, 100), context, threats },
      });
    }

    return { valid: threats.length === 0, threats };
  }

  /**
   * Create security event
   */
  createSecurityEvent(eventData: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): SecurityEvent {
    const event: SecurityEvent = {
      ...eventData,
      id: this.generateEventId(),
      timestamp: new Date(),
      resolved: false,
    };

    this.securityEvents.set(event.id, event);
    this.emit('security-event', event);
    this.checkAlertThresholds(event);

    logger.warn('Security event created', { 
      eventId: event.id, 
      type: event.type, 
      threatLevel: event.threatLevel 
    });

    return event;
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(event: SecurityEvent): void {
    const recentEvents = this.getRecentEvents(15 * 60 * 1000); // Last 15 minutes
    const thresholds = this.config.monitoring.alertThresholds;

    const failedLogins = recentEvents.filter(e => e.type === SecurityEventType.BRUTE_FORCE_ATTEMPT).length;
    if (failedLogins >= thresholds.failedLogins) {
      this.emit('security-alert', {
        type: 'failed_logins_threshold',
        message: `High number of failed login attempts: ${failedLogins}`,
      });
    }

    const suspiciousActivities = recentEvents.filter(e => 
      e.type === SecurityEventType.SQL_INJECTION_ATTEMPT || 
      e.type === SecurityEventType.XSS_ATTEMPT
    ).length;
    if (suspiciousActivities >= thresholds.suspiciousActivities) {
      this.emit('security-alert', {
        type: 'suspicious_activities_threshold',
        message: `High number of suspicious activities: ${suspiciousActivities}`,
      });
    }
  }

  /**
   * Get recent security events
   */
  getRecentEvents(timeWindow: number): SecurityEvent[] {
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
      totalEvents: events.length,
      eventsLast24Hours: events.filter(e => e.timestamp > last24Hours).length,
      byType: Object.values(SecurityEventType).reduce((acc, type) => {
        acc[type] = events.filter(e => e.type === type).length;
        return acc;
      }, {} as Record<SecurityEventType, number>),
      byThreatLevel: Object.values(ThreatLevel).reduce((acc, level) => {
        acc[level] = events.filter(e => e.threatLevel === level).length;
        return acc;
      }, {} as Record<ThreatLevel, number>),
      blockedIPs: this.blockedIPs.size,
      activeRateLimits: this.rateLimitCounters.size,
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