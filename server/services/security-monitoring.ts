// server/services/security-monitoring.ts
// Security monitoring and intrusion detection service
import { getLogger } from '../../src/logging/index.js';
import { Pool } from 'pg';
import { Request } from 'express';

const logger = getLogger().child({ component: 'security-monitoring' });

// Security event types
export enum SecurityEventType {
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_ATTEMPT = 'CSRF_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  FILE_UPLOAD_ATTEMPT = 'FILE_UPLOAD_ATTEMPT',
  ADMIN_ACTION = 'ADMIN_ACTION',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_DELETION = 'DATA_DELETION'
}

// Security risk levels
export enum SecurityRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Intrusion detection patterns
const INTRUSION_PATTERNS = {
  sqlInjection: [
    /(\b(union|select|insert|update|delete|drop|create|alter)\b.*\b(from|into|where|table|database)\b)/i,
    /(\b(exec|execute|sp_|xp_)\b)/i,
    /(\b(script|javascript|vbscript|onload|onerror)\b)/i,
    /(\b(union.*select|select.*union)\b)/i
  ],
  xss: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi
  ],
  pathTraversal: [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi
  ],
  commandInjection: [
    /(\b(cmd|command|exec|system|shell)\b)/i,
    /(\b(ping|nslookup|traceroute|netstat)\b)/i,
    /(\b(rm|del|erase|format)\b)/i
  ]
};

/**
 * Security monitoring service
 * Detects and logs security events and potential intrusions
 */
export class SecurityMonitoringService {
  private db: Pool;
  private alertThresholds: Map<string, number>;
  private suspiciousIPs: Map<string, { count: number; lastSeen: number }>;
  
  constructor(db: Pool) {
    this.db = db;
    this.alertThresholds = new Map();
    this.suspiciousIPs = new Map();
    
    // Set default alert thresholds
    this.alertThresholds.set('login_failures', 5);
    this.alertThresholds.set('rate_limit_violations', 10);
    this.alertThresholds.set('suspicious_patterns', 3);
  }
  
  /**
   * Log a security event
   * @param eventType - Type of security event
   * @param details - Event details
   * @param riskLevel - Risk level of the event
   */
  async logSecurityEvent(
    eventType: SecurityEventType,
    details: any,
    riskLevel: SecurityRiskLevel = SecurityRiskLevel.LOW
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO security_events (event_type, details, risk_level, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [eventType, JSON.stringify(details), riskLevel]
      );
      
      logger.info('Security event logged', {
        eventType,
        riskLevel,
        details
      });
      
      // Check if alert should be triggered
      await this.checkAlertThresholds(eventType, details);
      
    } catch (error) {
      logger.error('Failed to log security event', { eventType, error });
    }
  }
  
  /**
   * Analyze request for security threats
   * @param req - Express request object
   * @returns Analysis result
   */
  analyzeRequest(req: Request): {
    isThreat: boolean;
    threatType?: string;
    riskLevel: SecurityRiskLevel;
    details: any;
  } {
    const analysis = {
      isThreat: false,
      threatType: undefined as string | undefined,
      riskLevel: SecurityRiskLevel.LOW,
      details: {}
    };
    
    // Check for SQL injection patterns
    if (this.detectSQLInjection(req)) {
      analysis.isThreat = true;
      analysis.threatType = 'SQL_INJECTION';
      analysis.riskLevel = SecurityRiskLevel.HIGH;
      analysis.details = { patterns: this.extractSuspiciousPatterns(req, 'sqlInjection') };
    }
    
    // Check for XSS patterns
    if (this.detectXSS(req)) {
      analysis.isThreat = true;
      analysis.threatType = 'XSS';
      analysis.riskLevel = SecurityRiskLevel.HIGH;
      analysis.details = { patterns: this.extractSuspiciousPatterns(req, 'xss') };
    }
    
    // Check for path traversal
    if (this.detectPathTraversal(req)) {
      analysis.isThreat = true;
      analysis.threatType = 'PATH_TRAVERSAL';
      analysis.riskLevel = SecurityRiskLevel.MEDIUM;
      analysis.details = { patterns: this.extractSuspiciousPatterns(req, 'pathTraversal') };
    }
    
    // Check for command injection
    if (this.detectCommandInjection(req)) {
      analysis.isThreat = true;
      analysis.threatType = 'COMMAND_INJECTION';
      analysis.riskLevel = SecurityRiskLevel.CRITICAL;
      analysis.details = { patterns: this.extractSuspiciousPatterns(req, 'commandInjection') };
    }
    
    return analysis;
  }
  
  /**
   * Detect suspicious activity patterns
   * @param userId - User ID to analyze
   * @returns Suspicious activity report
   */
  async detectSuspiciousActivity(userId: string): Promise<{
    isSuspicious: boolean;
    patterns: string[];
    riskScore: number;
  }> {
    try {
      // Get recent activity for user
      const recentEvents = await this.db.query(
        `SELECT event_type, details, created_at 
         FROM security_events 
         WHERE details->>'userId' = $1 
         AND created_at > NOW() - INTERVAL '1 hour'
         ORDER BY created_at DESC`,
        [userId]
      );
      
      const patterns: string[] = [];
      let riskScore = 0;
      
      // Analyze patterns
      const eventCounts = new Map<string, number>();
      recentEvents.rows.forEach(event => {
        const count = eventCounts.get(event.event_type) || 0;
        eventCounts.set(event.event_type, count + 1);
      });
      
      // Check for multiple failed logins
      if (eventCounts.get(SecurityEventType.LOGIN_FAILURE) > 3) {
        patterns.push('Multiple failed login attempts');
        riskScore += 30;
      }
      
      // Check for rapid requests
      if (eventCounts.get(SecurityEventType.RATE_LIMIT_EXCEEDED) > 2) {
        patterns.push('Rate limit violations');
        riskScore += 25;
      }
      
      // Check for suspicious patterns
      if (eventCounts.get(SecurityEventType.SUSPICIOUS_ACTIVITY) > 1) {
        patterns.push('Suspicious activity patterns');
        riskScore += 40;
      }
      
      return {
        isSuspicious: riskScore > 50,
        patterns,
        riskScore
      };
      
    } catch (error) {
      logger.error('Failed to detect suspicious activity', { userId, error });
      return {
        isSuspicious: false,
        patterns: [],
        riskScore: 0
      };
    }
  }
  
  /**
   * Generate security report
   * @param timeframe - Timeframe for report (in hours)
   * @returns Security report
   */
  async generateSecurityReport(timeframe: number = 24): Promise<any> {
    try {
      const cutoff = new Date(Date.now() - timeframe * 60 * 60 * 1000);
      
      // Get event counts by type
      const eventCounts = await this.db.query(
        `SELECT event_type, COUNT(*) as count, risk_level
         FROM security_events 
         WHERE created_at > $1
         GROUP BY event_type, risk_level
         ORDER BY count DESC`,
        [cutoff]
      );
      
      // Get high-risk events
      const highRiskEvents = await this.db.query(
        `SELECT event_type, details, created_at
         FROM security_events 
         WHERE created_at > $1 AND risk_level IN ($2, $3)
         ORDER BY created_at DESC
         LIMIT 50`,
        [cutoff, SecurityRiskLevel.HIGH, SecurityRiskLevel.CRITICAL]
      );
      
      // Get unique IP addresses
      const uniqueIPs = await this.db.query(
        `SELECT COUNT(DISTINCT details->>'ip') as unique_ips
         FROM security_events 
         WHERE created_at > $1`,
        [cutoff]
      );
      
      return {
        timeframe: `${timeframe} hours`,
        generatedAt: new Date().toISOString(),
        summary: {
          totalEvents: eventCounts.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
          uniqueIPs: parseInt(uniqueIPs.rows[0].unique_ips),
          highRiskEvents: highRiskEvents.rows.length
        },
        eventBreakdown: eventCounts.rows,
        highRiskEvents: highRiskEvents.rows
      };
      
    } catch (error) {
      logger.error('Failed to generate security report', { error });
      throw new Error('Failed to generate security report');
    }
  }
  
  /**
   * Check alert thresholds and trigger alerts if needed
   * @param eventType - Type of event
   * @param details - Event details
   */
  private async checkAlertThresholds(eventType: SecurityEventType, details: any): Promise<void> {
    const ip = details.ip;
    if (!ip) return;
    
    // Update suspicious IP tracking
    const current = this.suspiciousIPs.get(ip) || { count: 0, lastSeen: 0 };
    current.count++;
    current.lastSeen = Date.now();
    this.suspiciousIPs.set(ip, current);
    
    // Check thresholds
    const threshold = this.alertThresholds.get('suspicious_patterns') || 3;
    
    if (current.count >= threshold) {
      await this.triggerAlert('SUSPICIOUS_IP', {
        ip,
        eventCount: current.count,
        lastEvent: eventType,
        details
      });
    }
  }
  
  /**
   * Trigger security alert
   * @param alertType - Type of alert
   * @param details - Alert details
   */
  private async triggerAlert(alertType: string, details: any): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO security_alerts (alert_type, details, created_at)
         VALUES ($1, $2, NOW())`,
        [alertType, JSON.stringify(details)]
      );
      
      logger.warn('Security alert triggered', {
        alertType,
        details
      });
      
      // TODO: Send notifications (email, Slack, etc.)
      
    } catch (error) {
      logger.error('Failed to trigger security alert', { alertType, error });
    }
  }
  
  // Detection methods
  private detectSQLInjection(req: Request): boolean {
    return this.checkPatterns(req, INTRUSION_PATTERNS.sqlInjection);
  }
  
  private detectXSS(req: Request): boolean {
    return this.checkPatterns(req, INTRUSION_PATTERNS.xss);
  }
  
  private detectPathTraversal(req: Request): boolean {
    return this.checkPatterns(req, INTRUSION_PATTERNS.pathTraversal);
  }
  
  private detectCommandInjection(req: Request): boolean {
    return this.checkPatterns(req, INTRUSION_PATTERNS.commandInjection);
  }
  
  private checkPatterns(req: Request, patterns: RegExp[]): boolean {
    const dataToCheck = [
      req.url,
      JSON.stringify(req.query),
      JSON.stringify(req.body),
      JSON.stringify(req.headers)
    ].join(' ');
    
    return patterns.some(pattern => pattern.test(dataToCheck));
  }
  
  private extractSuspiciousPatterns(req: Request, patternType: keyof typeof INTRUSION_PATTERNS): string[] {
    const patterns = INTRUSION_PATTERNS[patternType];
    const dataToCheck = [
      req.url,
      JSON.stringify(req.query),
      JSON.stringify(req.body),
      JSON.stringify(req.headers)
    ].join(' ');
    
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const found = dataToCheck.match(pattern);
      if (found) {
        matches.push(...found);
      }
    });
    
    return matches;
  }
}

// Export enums and patterns for external use
export { SecurityEventType, SecurityRiskLevel, INTRUSION_PATTERNS }; 