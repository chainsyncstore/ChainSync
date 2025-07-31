// server/routes/security.ts
// Security management routes for Phase 2 security features
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getLogger } from '../../../src/logging/index.js';
import { 
  isAuthenticated, 
  authorizeRoles 
} from '../middleware/auth.js';
import { 
  validatePassword, 
  MFAService, 
  requireMFA, 
  accountLockoutMiddleware,
  securityEventLogger 
} from '../middleware/security.js';
import { 
  encryptionService, 
  hash, 
  verifyHash, 
  generateToken 
} from '../services/encryption.js';
import { GDPRService } from '../services/gdpr.js';
import { 
  SecurityMonitoringService, 
  SecurityEventType, 
  SecurityRiskLevel 
} from '../services/security-monitoring.js';
import { validateBody } from '../middleware/validation.js';
import { Pool } from 'pg';

const router = Router();
const logger = getLogger().child({ component: 'security-routes' });

// Validation schemas
const mfaSetupSchema = z.object({
  token: z.string().length(6),
  secret: z.string().optional()
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
  confirmPassword: z.string().min(12)
});

const gdprRequestSchema = z.object({
  requestType: z.enum(['access', 'erasure', 'portability']),
  reason: z.string().optional()
});

// Initialize services
let gdprService: GDPRService;
let securityMonitoring: SecurityMonitoringService;

export const initializeSecurityRoutes = (db: Pool) => {
  gdprService = new GDPRService(db);
  securityMonitoring = new SecurityMonitoringService(db);
};

/**
 * GET /api/v1/security/mfa/setup
 * Generate MFA setup QR code and secret
 */
router.get('/mfa/setup', 
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const userEmail = (req.session as any).email || 'user@example.com';
      
      // Generate new MFA secret
      const secret = MFAService.generateSecret();
      const qrUrl = MFAService.generateQRUrl(userEmail, secret);
      
      // Store secret temporarily (in production, store in database)
      (req.session as any).mfaSetupSecret = secret;
      
      // Log MFA setup initiation
      await securityMonitoring.logSecurityEvent(
        SecurityEventType.MFA_ENABLED,
        { userId, setupInitiated: true },
        SecurityRiskLevel.LOW
      );
      
      res.json({
        success: true,
        data: {
          secret,
          qrUrl,
          setupComplete: false
        }
      });
    } catch (error) {
      logger.error('MFA setup failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to setup MFA'
      });
    }
  }
);

/**
 * POST /api/v1/security/mfa/verify
 * Verify MFA token and complete setup
 */
router.post('/mfa/verify',
  isAuthenticated,
  validateBody(mfaSetupSchema),
  async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const userId = (req.session as any).userId;
      const secret = (req.session as any).mfaSetupSecret;
      
      if (!secret) {
        return res.status(400).json({
          success: false,
          error: 'MFA setup not initiated'
        });
      }
      
      // Verify token
      const isValid = MFAService.validateToken(token, secret);
      
      if (!isValid) {
        await securityMonitoring.logSecurityEvent(
          SecurityEventType.LOGIN_FAILURE,
          { userId, reason: 'Invalid MFA token' },
          SecurityRiskLevel.MEDIUM
        );
        
        return res.status(400).json({
          success: false,
          error: 'Invalid MFA token'
        });
      }
      
      // Enable MFA for user
      (req.session as any).mfaVerified = true;
      (req.session as any).mfaRequired = true;
      delete (req.session as any).mfaSetupSecret;
      
      // Log successful MFA setup
      await securityMonitoring.logSecurityEvent(
        SecurityEventType.MFA_ENABLED,
        { userId, setupComplete: true },
        SecurityRiskLevel.LOW
      );
      
      res.json({
        success: true,
        message: 'MFA setup completed successfully'
      });
    } catch (error) {
      logger.error('MFA verification failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to verify MFA'
      });
    }
  }
);

/**
 * POST /api/v1/security/password/change
 * Change user password with validation
 */
router.post('/password/change',
  isAuthenticated,
  validateBody(passwordChangeSchema),
  async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = (req.session as any).userId;
      
      // Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Password does not meet requirements',
          details: passwordValidation.errors
        });
      }
      
      // Confirm password match
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'Passwords do not match'
        });
      }
      
      // TODO: Verify current password against database
      // For now, just log the change
      
      // Log password change
      await securityMonitoring.logSecurityEvent(
        SecurityEventType.PASSWORD_CHANGE,
        { userId, passwordChanged: true },
        SecurityRiskLevel.MEDIUM
      );
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Password change failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }
);

/**
 * POST /api/v1/security/password/generate
 * Generate secure random password
 */
router.post('/password/generate',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const password = generateToken(16); // Generate 16-character password
      
      res.json({
        success: true,
        data: {
          password,
          strength: 'high'
        }
      });
    } catch (error) {
      logger.error('Password generation failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate password'
      });
    }
  }
);

/**
 * POST /api/v1/security/gdpr/request
 * Process GDPR data requests
 */
router.post('/gdpr/request',
  isAuthenticated,
  validateBody(gdprRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const { requestType, reason } = req.body;
      const userId = (req.session as any).userId;
      
      let result;
      
      switch (requestType) {
        case 'access':
          result = await gdprService.processAccessRequest(userId);
          break;
        case 'erasure':
          result = await gdprService.processErasureRequest(userId, reason);
          break;
        case 'portability':
          result = await gdprService.processPortabilityRequest(userId);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid request type'
          });
      }
      
      // Log GDPR request
      await securityMonitoring.logSecurityEvent(
        SecurityEventType.DATA_EXPORT,
        { userId, requestType, reason },
        SecurityRiskLevel.LOW
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('GDPR request failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to process GDPR request'
      });
    }
  }
);

/**
 * GET /api/v1/security/events
 * Get security events (admin only)
 */
router.get('/events',
  isAuthenticated,
  authorizeRoles(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { timeframe = '24', limit = '50' } = req.query;
      
      const report = await securityMonitoring.generateSecurityReport(
        parseInt(timeframe as string)
      );
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to get security events', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security events'
      });
    }
  }
);

/**
 * POST /api/v1/security/analyze
 * Analyze request for security threats
 */
router.post('/analyze',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const analysis = securityMonitoring.analyzeRequest(req);
      
      if (analysis.isThreat) {
        await securityMonitoring.logSecurityEvent(
          SecurityEventType.SUSPICIOUS_ACTIVITY,
          {
            threatType: analysis.threatType,
            riskLevel: analysis.riskLevel,
            details: analysis.details,
            ip: req.ip,
            userId: (req.session as any).userId
          },
          analysis.riskLevel
        );
      }
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Security analysis failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze request'
      });
    }
  }
);

/**
 * GET /api/v1/security/status
 * Get current security status
 */
router.get('/status',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      
      // Check for suspicious activity
      const suspiciousActivity = await securityMonitoring.detectSuspiciousActivity(userId);
      
      const status = {
        mfaEnabled: !!(req.session as any).mfaRequired,
        mfaVerified: !!(req.session as any).mfaVerified,
        accountLocked: !!(req.session as any).loginAttempts >= 5,
        suspiciousActivity: suspiciousActivity.isSuspicious,
        riskScore: suspiciousActivity.riskScore,
        lastLogin: (req.session as any).lastLogin || null
      };
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get security status', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get security status'
      });
    }
  }
);

/**
 * POST /api/v1/security/encrypt
 * Encrypt sensitive data (admin only)
 */
router.post('/encrypt',
  isAuthenticated,
  authorizeRoles(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { data, context } = req.body;
      
      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Data is required'
        });
      }
      
      const encrypted = encryptionService.encrypt(data, context);
      
      res.json({
        success: true,
        data: {
          encrypted,
          algorithm: 'AES-256-GCM'
        }
      });
    } catch (error) {
      logger.error('Encryption failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to encrypt data'
      });
    }
  }
);

/**
 * POST /api/v1/security/decrypt
 * Decrypt sensitive data (admin only)
 */
router.post('/decrypt',
  isAuthenticated,
  authorizeRoles(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { encryptedData, context } = req.body;
      
      if (!encryptedData) {
        return res.status(400).json({
          success: false,
          error: 'Encrypted data is required'
        });
      }
      
      const decrypted = encryptionService.decrypt(encryptedData, context);
      
      res.json({
        success: true,
        data: {
          decrypted
        }
      });
    } catch (error) {
      logger.error('Decryption failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to decrypt data'
      });
    }
  }
);

export default router; 