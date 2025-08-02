// server/routes/security.ts
// Security management routes for Phase 2 security features
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getLogger } from '../../shared/logging.js';
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
const logger = getLogger('security-routes');

// Validation schemas
const mfaSetupSchema = z.object({
  _token: z.string().length(6),
  _secret: z.string().optional()
});

const passwordChangeSchema = z.object({
  _currentPassword: z.string().min(1),
  _newPassword: z.string().min(12),
  _confirmPassword: z.string().min(12)
});

const gdprRequestSchema = z.object({
  _requestType: z.enum(['access', 'erasure', 'portability']),
  _reason: z.string().optional()
});

// Initialize services
let _gdprService: GDPRService;
let _securityMonitoring: SecurityMonitoringService;

export const initializeSecurityRoutes = (_db: Pool) => {
  gdprService = new GDPRService(db);
  securityMonitoring = new SecurityMonitoringService(db);
};

/**
 * GET /api/v1/security/mfa/setup
 * Generate MFA setup QR code and secret
 */
router.get('/mfa/setup',
  isAuthenticated,
  async(_req: Request, _res: Response) => {
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
        { userId, _setupInitiated: true },
        SecurityRiskLevel.LOW
      );

      res.json({
        _success: true,
        _data: {
          secret,
          qrUrl,
          _setupComplete: false
        }
      });
    } catch (error) {
      logger.error('MFA setup failed', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to setup MFA'
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
  async(_req: Request, _res: Response): Promise<void> => {
    try {
      const { token } = req.body;
      const userId = (req.session as any).userId;
      const secret = (req.session as any).mfaSetupSecret;

      if (!secret) {
        res.status(400).json({
          _success: false,
          _error: 'MFA setup not initiated'
        });
        return;
      }

      // Verify token
      const isValid = MFAService.validateToken(token, secret);

      if (!isValid) {
        await securityMonitoring.logSecurityEvent(
          SecurityEventType.LOGIN_FAILURE,
          { userId, _reason: 'Invalid MFA token' },
          SecurityRiskLevel.MEDIUM
        );

        res.status(400).json({
          _success: false,
          _error: 'Invalid MFA token'
        });
        return;
      }

      // Enable MFA for user
      (req.session as any).mfaVerified = true;
      (req.session as any).mfaRequired = true;
      delete (req.session as any).mfaSetupSecret;

      // Log successful MFA setup
      await securityMonitoring.logSecurityEvent(
        SecurityEventType.MFA_ENABLED,
        { userId, _setupComplete: true },
        SecurityRiskLevel.LOW
      );

      res.json({
        _success: true,
        _message: 'MFA setup completed successfully'
      });
    } catch (error) {
      logger.error('MFA verification failed', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to verify MFA'
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
  async(_req: Request, _res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = (req.session as any).userId;

      // Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
                  res.status(400).json({
            _success: false,
            _error: 'Password does not meet requirements',
            _details: passwordValidation.errors
          });
          return;
      }

      // Confirm password match
      if (newPassword !== confirmPassword) {
        res.status(400).json({
          _success: false,
          _error: 'Passwords do not match'
        });
        return;
      }

      // _TODO: Verify current password against database
      // For now, just log the change

      // Log password change
      await securityMonitoring.logSecurityEvent(
        SecurityEventType.PASSWORD_CHANGE,
        { userId, _passwordChanged: true },
        SecurityRiskLevel.MEDIUM
      );

      res.json({
        _success: true,
        _message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Password change failed', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to change password'
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
  async(_req: Request, _res: Response): Promise<void> => {
    try {
      const password = generateToken(16); // Generate 16-character password

      res.json({
        _success: true,
        _data: {
          password,
          _strength: 'high'
        }
      });
    } catch (error) {
      logger.error('Password generation failed', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to generate password'
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
  async(_req: Request, _res: Response): Promise<void> => {
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
        res.status(400).json({
            _success: false,
            _error: 'Invalid request type'
          });
          return;
      }

      // Log GDPR request
      await securityMonitoring.logSecurityEvent(
        SecurityEventType.DATA_EXPORT,
        { userId, requestType, reason },
        SecurityRiskLevel.LOW
      );

      res.json({
        _success: true,
        _data: result
      });
    } catch (error) {
      logger.error('GDPR request failed', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to process GDPR request'
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
  async(_req: Request, _res: Response): Promise<void> => {
    try {
      const { timeframe = '24', limit = '50' } = req.query;

      const report = await securityMonitoring.generateSecurityReport(
        parseInt(timeframe as string)
      );

      res.json({
        _success: true,
        _data: report
      });
    } catch (error) {
      logger.error('Failed to get security events', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to retrieve security events'
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
  async(_req: Request, _res: Response): Promise<void> => {
    try {
      const analysis = securityMonitoring.analyzeRequest(req);

      if (analysis.isThreat) {
        await securityMonitoring.logSecurityEvent(
          SecurityEventType.SUSPICIOUS_ACTIVITY,
          {
            _threatType: analysis.threatType,
            _riskLevel: analysis.riskLevel,
            _details: analysis.details,
            _ip: req.ip,
            _userId: (req.session as any).userId
          },
          analysis.riskLevel
        );
      }

      res.json({
        _success: true,
        _data: analysis
      });
    } catch (error) {
      logger.error('Security analysis failed', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to analyze request'
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
  async(_req: Request, _res: Response): Promise<void> => {
    try {
      const userId = (req.session as any).userId;

      // Check for suspicious activity
      const suspiciousActivity = await securityMonitoring.detectSuspiciousActivity(userId);

      const status = {
        _mfaEnabled: !!(req.session as any).mfaRequired,
        _mfaVerified: !!(req.session as any).mfaVerified,
        _accountLocked: ((req.session as any).loginAttempts || 0) >= 5,
        _suspiciousActivity: suspiciousActivity.isSuspicious,
        _riskScore: suspiciousActivity.riskScore,
        _lastLogin: (req.session as any).lastLogin || null
      };

      res.json({
        _success: true,
        _data: status
      });
    } catch (error) {
      logger.error('Failed to get security status', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to get security status'
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
  async(_req: Request, _res: Response): Promise<void> => {
    try {
      const { data, context } = req.body;

      if (!data) {
        res.status(400).json({
          _success: false,
          _error: 'Data is required'
        });
        return;
      }

      const encrypted = encryptionService.encrypt(data, context);

      res.json({
        _success: true,
        _data: {
          encrypted,
          _algorithm: 'AES-256-GCM'
        }
      });
    } catch (error) {
      logger.error('Encryption failed', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to encrypt data'
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
  async(_req: Request, _res: Response): Promise<void> => {
    try {
      const { encryptedData, context } = req.body;

      if (!encryptedData) {
        res.status(400).json({
          _success: false,
          _error: 'Encrypted data is required'
        });
        return;
      }

      const decrypted = encryptionService.decrypt(encryptedData, context);

      res.json({
        _success: true,
        _data: {
          decrypted
        }
      });
    } catch (error) {
      logger.error('Decryption failed', { error });
      res.status(500).json({
        _success: false,
        _error: 'Failed to decrypt data'
      });
    }
  }
);

export default router;
