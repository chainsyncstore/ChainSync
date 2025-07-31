// server/services/gdpr.ts
// GDPR compliance service for data protection and privacy
import { getLogger } from '../../src/logging/index.js';
import { encryptionService } from './encryption.js';
import { Pool } from 'pg';

const logger = getLogger().child({ component: 'gdpr-service' });

// GDPR configuration
const GDPR_CONFIG = {
  // Data retention periods (in days)
  retention: {
    userData: 2555, // 7 years for business records
    auditLogs: 1825, // 5 years for compliance
    sessionData: 30, // 30 days for session data
    backupData: 2555, // 7 years for backups
    temporaryData: 7, // 7 days for temporary data
  },
  
  // Data categories for processing
  dataCategories: {
    personal: ['name', 'email', 'phone', 'address', 'date_of_birth'],
    sensitive: ['password', 'credit_card', 'ssn', 'health_data'],
    business: ['transaction_history', 'purchase_preferences', 'loyalty_points'],
    technical: ['ip_address', 'user_agent', 'session_id', 'device_id']
  },
  
  // User rights
  userRights: {
    access: 'RIGHT_TO_ACCESS',
    rectification: 'RIGHT_TO_RECTIFICATION',
    erasure: 'RIGHT_TO_ERASURE',
    portability: 'RIGHT_TO_PORTABILITY',
    restriction: 'RIGHT_TO_RESTRICTION',
    objection: 'RIGHT_TO_OBJECT'
  }
};

/**
 * GDPR compliance service
 * Handles data protection, retention, and user rights
 */
export class GDPRService {
  private db: Pool;
  
  constructor(db: Pool) {
    this.db = db;
  }
  
  /**
   * Process data access request (Right to Access)
   * @param userId - User ID requesting access
   * @returns User's personal data
   */
  async processAccessRequest(userId: string): Promise<any> {
    try {
      logger.info('Processing data access request', { userId });
      
      // Collect all user data
      const userData = await this.collectUserData(userId);
      
      // Anonymize sensitive data for export
      const anonymizedData = this.anonymizeData(userData);
      
      // Log the access request
      await this.logDataRequest(userId, 'access', anonymizedData);
      
      return {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        data: anonymizedData,
        format: 'json'
      };
    } catch (error) {
      logger.error('Failed to process access request', { userId, error });
      throw new Error('Failed to process data access request');
    }
  }
  
  /**
   * Process data erasure request (Right to be Forgotten)
   * @param userId - User ID requesting erasure
   * @param reason - Reason for erasure
   * @returns Erasure confirmation
   */
  async processErasureRequest(userId: string, reason?: string): Promise<any> {
    try {
      logger.info('Processing data erasure request', { userId, reason });
      
      // Check if erasure is allowed (e.g., no pending transactions)
      const canErase = await this.canEraseUserData(userId);
      
      if (!canErase.allowed) {
        return {
          requestId: this.generateRequestId(),
          status: 'denied',
          reason: canErase.reason,
          timestamp: new Date().toISOString()
        };
      }
      
      // Anonymize user data instead of complete deletion
      await this.anonymizeUserData(userId);
      
      // Log the erasure request
      await this.logDataRequest(userId, 'erasure', { reason });
      
      return {
        requestId: this.generateRequestId(),
        status: 'completed',
        timestamp: new Date().toISOString(),
        message: 'User data has been anonymized'
      };
    } catch (error) {
      logger.error('Failed to process erasure request', { userId, error });
      throw new Error('Failed to process data erasure request');
    }
  }
  
  /**
   * Process data portability request (Right to Portability)
   * @param userId - User ID requesting portability
   * @returns Portable data format
   */
  async processPortabilityRequest(userId: string): Promise<any> {
    try {
      logger.info('Processing data portability request', { userId });
      
      // Collect user data in portable format
      const userData = await this.collectUserData(userId);
      
      // Convert to portable format (JSON)
      const portableData = this.formatForPortability(userData);
      
      // Log the portability request
      await this.logDataRequest(userId, 'portability', portableData);
      
      return {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        data: portableData,
        format: 'json',
        encoding: 'utf-8'
      };
    } catch (error) {
      logger.error('Failed to process portability request', { userId, error });
      throw new Error('Failed to process data portability request');
    }
  }
  
  /**
   * Clean up expired data based on retention policies
   * @returns Cleanup summary
   */
  async cleanupExpiredData(): Promise<any> {
    try {
      logger.info('Starting GDPR data cleanup');
      
      const cleanupResults = {
        sessionData: 0,
        auditLogs: 0,
        temporaryData: 0,
        backupData: 0
      };
      
      // Clean up expired session data
      const sessionCutoff = new Date(Date.now() - GDPR_CONFIG.retention.sessionData * 24 * 60 * 60 * 1000);
      const sessionResult = await this.db.query(
        'DELETE FROM sessions WHERE created_at < $1',
        [sessionCutoff]
      );
      cleanupResults.sessionData = sessionResult.rowCount;
      
      // Clean up expired audit logs
      const auditCutoff = new Date(Date.now() - GDPR_CONFIG.retention.auditLogs * 24 * 60 * 60 * 1000);
      const auditResult = await this.db.query(
        'DELETE FROM audit_logs WHERE created_at < $1',
        [auditCutoff]
      );
      cleanupResults.auditLogs = auditResult.rowCount;
      
      // Clean up temporary data
      const tempCutoff = new Date(Date.now() - GDPR_CONFIG.retention.temporaryData * 24 * 60 * 60 * 1000);
      const tempResult = await this.db.query(
        'DELETE FROM temporary_data WHERE created_at < $1',
        [tempCutoff]
      );
      cleanupResults.temporaryData = tempResult.rowCount;
      
      logger.info('GDPR data cleanup completed', cleanupResults);
      
      return {
        timestamp: new Date().toISOString(),
        results: cleanupResults
      };
    } catch (error) {
      logger.error('Failed to cleanup expired data', { error });
      throw new Error('Failed to cleanup expired data');
    }
  }
  
  /**
   * Anonymize user data for privacy protection
   * @param userId - User ID to anonymize
   */
  async anonymizeUserData(userId: string): Promise<void> {
    try {
      // Anonymize personal data
      await this.db.query(
        `UPDATE users SET 
          name = 'ANONYMIZED_' || id,
          email = 'anonymized_' || id || '@deleted.local',
          phone = NULL,
          address = NULL,
          date_of_birth = NULL,
          anonymized_at = NOW()
        WHERE id = $1`,
        [userId]
      );
      
      // Anonymize transaction data
      await this.db.query(
        `UPDATE transactions SET 
          customer_name = 'ANONYMIZED',
          customer_email = 'anonymized@deleted.local',
          anonymized_at = NOW()
        WHERE user_id = $1`,
        [userId]
      );
      
      logger.info('User data anonymized', { userId });
    } catch (error) {
      logger.error('Failed to anonymize user data', { userId, error });
      throw new Error('Failed to anonymize user data');
    }
  }
  
  /**
   * Check if user data can be erased
   * @param userId - User ID to check
   * @returns Erasure eligibility
   */
  private async canEraseUserData(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check for pending transactions
      const pendingTransactions = await this.db.query(
        'SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND status = $2',
        [userId, 'pending']
      );
      
      if (parseInt(pendingTransactions.rows[0].count) > 0) {
        return {
          allowed: false,
          reason: 'User has pending transactions that must be completed first'
        };
      }
      
      // Check for active subscriptions
      const activeSubscriptions = await this.db.query(
        'SELECT COUNT(*) FROM subscriptions WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );
      
      if (parseInt(activeSubscriptions.rows[0].count) > 0) {
        return {
          allowed: false,
          reason: 'User has active subscriptions that must be cancelled first'
        };
      }
      
      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check erasure eligibility', { userId, error });
      return { allowed: false, reason: 'Unable to verify erasure eligibility' };
    }
  }
  
  /**
   * Collect all user data for access/portability requests
   * @param userId - User ID
   * @returns User data
   */
  private async collectUserData(userId: string): Promise<any> {
    try {
      // Get user profile
      const userResult = await this.db.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      // Get transaction history
      const transactionResult = await this.db.query(
        'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      // Get loyalty data
      const loyaltyResult = await this.db.query(
        'SELECT * FROM loyalty_points WHERE user_id = $1',
        [userId]
      );
      
      // Get preferences
      const preferencesResult = await this.db.query(
        'SELECT * FROM user_preferences WHERE user_id = $1',
        [userId]
      );
      
      return {
        profile: userResult.rows[0] || null,
        transactions: transactionResult.rows,
        loyalty: loyaltyResult.rows,
        preferences: preferencesResult.rows
      };
    } catch (error) {
      logger.error('Failed to collect user data', { userId, error });
      throw new Error('Failed to collect user data');
    }
  }
  
  /**
   * Anonymize sensitive data for export
   * @param data - Data to anonymize
   * @returns Anonymized data
   */
  private anonymizeData(data: any): any {
    const anonymized = JSON.parse(JSON.stringify(data));
    
    // Anonymize sensitive fields
    if (anonymized.profile) {
      anonymized.profile.password = '[REDACTED]';
      anonymized.profile.credit_card = '[REDACTED]';
      anonymized.profile.ssn = '[REDACTED]';
    }
    
    // Anonymize transaction data
    if (anonymized.transactions) {
      anonymized.transactions.forEach((transaction: any) => {
        transaction.customer_name = '[REDACTED]';
        transaction.customer_email = '[REDACTED]';
        transaction.credit_card = '[REDACTED]';
      });
    }
    
    return anonymized;
  }
  
  /**
   * Format data for portability
   * @param data - Data to format
   * @returns Portable format
   */
  private formatForPortability(data: any): any {
    return {
      exportDate: new Date().toISOString(),
      format: 'GDPR-Portable-Format-v1.0',
      data: data
    };
  }
  
  /**
   * Log data request for audit trail
   * @param userId - User ID
   * @param requestType - Type of request
   * @param details - Request details
   */
  private async logDataRequest(userId: string, requestType: string, details: any): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO gdpr_requests (user_id, request_type, details, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, requestType, JSON.stringify(details)]
      );
    } catch (error) {
      logger.error('Failed to log GDPR request', { userId, requestType, error });
    }
  }
  
  /**
   * Generate unique request ID
   * @returns Request ID
   */
  private generateRequestId(): string {
    return `GDPR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export utility functions
export const GDPR_CONFIG_EXPORT = GDPR_CONFIG; 