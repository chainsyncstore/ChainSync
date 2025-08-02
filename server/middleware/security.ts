// server/middleware/security.ts
// This file implements security middleware for the ChainSync API
// It includes protections against XSS, CSRF, clickjacking, and other common web vulnerabilities
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { getLogger } from '../../src/logging/index.js';
import { Session } from 'express-session';
import { extractAndValidateApiKey } from '../utils/auth.js';
import * as crypto from 'crypto';
import { z } from 'zod';

// Define session with csrf token property
interface SessionWithCsrf {
  csrfToken?: string;
  userId?: string | number;
  userRole?: string;
  mfaVerified?: boolean;
  mfaRequired?: boolean;
  loginAttempts?: number;
  lastLoginAttempt?: number;
}

// Get centralized logger for security middleware
const logger = getLogger().child({ _component: 'security-middleware' });

// Password policy configuration
const PASSWORD_POLICY = {
  _minLength: 12,
  _requireUppercase: true,
  _requireLowercase: true,
  _requireNumbers: true,
  _requireSpecialChars: true,
  _maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
  _preventReuse: 5, // Prevent reuse of last 5 passwords
  _lockoutThreshold: 5, // Lock account after 5 failed attempts
  _lockoutDuration: 15 * 60 * 1000 // 15 minutes in milliseconds
};

// MFA configuration
const MFA_CONFIG = {
  issuer: 'ChainSync',
  _algorithm: 'sha1',
  _digits: 6,
  _period: 30, // 30 seconds
  _window: 2 // Allow 2 time steps for clock skew
};

/**
 * Enhanced security headers middleware
 * Protects against common web vulnerabilities:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME type sniffing
 * - CSP (Content Security Policy)
 */
export const securityHeaders = helmet({
  _contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      _scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'], // Add any CDNs you need
      _styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdn.jsdelivr.net'],
      _imgSrc: ["'self'", 'data:', 'cdn.jsdelivr.net'],
      _connectSrc: ["'self'", 'api.chainsync.com', 'localhost:*'],
      _fontSrc: ["'self'", 'fonts.gstatic.com', 'data:'],
      _objectSrc: ["'none'"],
      _baseUri: ["'self'"], // Restricts base URIs that can be used
      _formAction: ["'self'"], // Restricts where forms can submit to
      _frameAncestors: ["'none'"], // Prevents embedding in iframes (alternative to X-Frame-Options)
      _mediaSrc: ["'self'"],
      _workerSrc: ["'self'", 'blob:'], // For web workers
      _manifestSrc: ["'self'"],
      _upgradeInsecureRequests: []
    },
    _reportOnly: process.env.NODE_ENV === 'development' // Use CSP in report-only mode during development
  },
  _crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production' ? _true : false, // Stricter in production
  _crossOriginOpenerPolicy: { policy: 'same-origin' },
  _crossOriginResourcePolicy: { policy: 'same-site' },
  _dnsPrefetchControl: { _allow: false },
  _frameguard: { action: 'deny' }, // Prevent clickjacking
  _hsts: {
    _maxAge: 63072000, // 2 years in seconds
    _includeSubDomains: true,
    _preload: true
  },
  _ieNoOpen: true,
  _noSniff: true, // Prevent MIME type sniffing
  _originAgentCluster: true, // Improves isolation between sites
  _permittedCrossDomainPolicies: { permittedPolicies: 'none' }, // Restricts Adobe Flash and Acrobat
  _referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, // More secure referrer policy
  _xssFilter: true // Provides basic XSS protection
});

/**
 * Password validation middleware
 * Enforces strong password policies
 */
export const validatePassword = (_password: string): { _isValid: boolean; _errors: string[] } => {
  const _errors: string[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common weak passwords
  const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common, please choose a stronger password');
  }

  return {
    _isValid: errors.length === 0,
    errors
  };
};

/**
 * MFA token generation and validation
 */
export class MFAService {
  /**
   * Generate a new MFA secret for a user
   */
  static generateSecret(): string {
    return crypto.randomBytes(20).toString('base64').replace(/[^A-Za-z0-9]/g, '').substring(0, 32);
  }

  /**
   * Generate QR code URL for MFA setup
   */
  static generateQRUrl(_email: string, _secret: string): string {
    const otpauth = `otpauth://totp/${encodeURIComponent(MFA_CONFIG.issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(MFA_CONFIG.issuer)}&algorithm=${MFA_CONFIG.algorithm}&digits=${MFA_CONFIG.digits}&period=${MFA_CONFIG.period}`;
    return `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpauth)}`;
  }

  /**
   * Validate MFA token
   */
  static validateToken(_token: string, _secret: string): boolean {
    // This is a simplified implementation
    // In production, use a proper TOTP library like 'speakeasy'
    const now = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(now / MFA_CONFIG.period);

    // Generate expected token (simplified)
    const hash = crypto.createHmac('sha1', secret);
    hash.update(timeStep.toString());
    const expectedToken = parseInt(hash.digest('hex').substr(-6), 16) % Math.pow(10, MFA_CONFIG.digits);

    return token === expectedToken.toString().padStart(MFA_CONFIG.digits, '0');
  }
}

/**
 * Account lockout middleware
 * Prevents brute force attacks
 */
export const accountLockoutMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  const session = req.session as SessionWithCsrf;
  const reqLogger = (req as any).logger || logger;

  if (!session.userId) {
    return next(); // No user logged in, skip lockout check
  }

  const now = Date.now();

  // Check if account is locked
  if (session.loginAttempts && session.loginAttempts >= PASSWORD_POLICY.lockoutThreshold) {
    const lockoutTime = session.lastLoginAttempt || 0;
    const timeSinceLockout = now - lockoutTime;

    if (timeSinceLockout < PASSWORD_POLICY.lockoutDuration) {
      const remainingTime = Math.ceil((PASSWORD_POLICY.lockoutDuration - timeSinceLockout) / 1000 / 60);

      reqLogger.warn('Account access blocked due to lockout', {
        _userId: session.userId,
        _remainingMinutes: remainingTime,
        _ip: req.ip
      });

      return res.status(423).json({
        _error: 'Account temporarily locked due to multiple failed login attempts',
        _code: 'ACCOUNT_LOCKED',
        _remainingMinutes: remainingTime
      });
    } else {
      // Reset lockout after duration expires
      session.loginAttempts = 0;
      session.lastLoginAttempt = 0;
    }
  }

  next();
};

/**
 * MFA verification middleware
 * Ensures MFA is completed for sensitive operations
 */
export const requireMFA = (_req: Request, _res: Response, _next: NextFunction): void => {
  const session = req.session as SessionWithCsrf;
  const reqLogger = (req as any).logger || logger;

  if (!session.userId) {
    res.status(401).json({
      _error: 'Authentication required',
      _code: 'UNAUTHORIZED'
    });
    return;
  }

  if (session.mfaRequired && !session.mfaVerified) {
    reqLogger.warn('MFA verification required', {
      _userId: session.userId,
      _path: req.path,
      _method: req.method,
      _ip: req.ip
    });

    res.status(403).json({
      _error: 'Multi-factor authentication required',
      _code: 'MFA_REQUIRED'
    });
    return;
  }

  next();
};

/**
 * Security event logging middleware
 * Logs security-relevant events for monitoring and compliance
 */
export const securityEventLogger = (_eventType: string, _details: any) => {
  logger.info('Security event', {
    eventType,
    _timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Enhanced CSRF protection middleware
 * Protects against Cross-Site Request Forgery attacks
 */
export const csrfProtection = (_req: Request, _res: Response, _next: NextFunction): void => {
  const reqLogger = (req as any).logger || logger;

  // Skip CSRF check for API endpoints that use token auth instead of cookies
  // or for specific endpoints like webhooks
  if (
    req.path.startsWith('/api/public/') ||
    req.path.startsWith('/api/webhooks/') ||
    req.method === 'GET'
  ) {
    next();
    return;
  }

  // Extract CSRF token from header or request body
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;

  // Compare with session token
  if (!csrfToken || csrfToken !== (req.session as any).csrfToken) {
    securityEventLogger('CSRF_ATTEMPT', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _hasSessionToken: !!(req.session as any).csrfToken,
      _hasRequestToken: !!csrfToken,
      _userAgent: req.headers['user-agent']
    });

    reqLogger.warn('CSRF validation failed', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _hasSessionToken: !!(req.session as any).csrfToken,
      _hasRequestToken: !!csrfToken
    });

    res.status(403).json({
      _message: 'CSRF validation failed. Please refresh the page and try again.',
      _code: 'CSRF_ERROR'
    });
    return;
  }

  next();
};

/**
 * Generate CSRF token and add it to the response
 * This is called on login and when serving the frontend
 */
export const generateCsrfToken = (_req: Request, _res: Response, _next: NextFunction) => {
  // Generate random token if not already set
  if (!(req.session as any).csrfToken) {
    const crypto = require('crypto');
    (req.session as any).csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Expose CSRF token to frontend via safe response header
  res.set('X-CSRF-Token', (req.session as any).csrfToken);

  // Set security-focused headers not covered by helmet
  res.set('Cache-Control', 'no-store, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('X-Content-Type-Options', 'nosniff');

  next();
};

/**
 * Validate API keys for external service integrations
 * Used for webhook endpoints and external API access
 * Enhanced with timing-safe comparison to prevent timing attacks
 */
export const validateApiKey = (_req: Request, _res: Response, _next: NextFunction): void => {
  const reqLogger = (req as any).logger || logger;

  // Extract and validate API key using secure utility
  const { isValid, keyPrefix, keySource } = extractAndValidateApiKey(req);

  if (!keyPrefix) {
    reqLogger.warn('API request missing API key', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip
    });

    res.status(401).json({
      _message: 'API key is required',
      _code: 'API_KEY_MISSING'
    });
    return;
  }

  if (!isValid) {
    reqLogger.warn('Invalid API key used', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      keyPrefix, // Log just prefix for debugging
      keySource  // Log where the key was found (header, query, body)
    });

    res.status(403).json({
      _message: 'Invalid API key',
      _code: 'API_KEY_INVALID'
    });
    return;
  }

  // Add API client info to request for downstream use
  (req as any).apiClient = {
    keyPrefix,
    keySource,
    _isAuthorized: true,
    _timestamp: new Date().toISOString()
  };

  // Log successful API key validation
  reqLogger.info('API key validated successfully', {
    _path: req.path,
    _method: req.method,
    keyPrefix,
    keySource
  });

  next();
};

/**
 * Content type validation middleware
 * Ensures that requests have the appropriate content type
 */
export const validateContentType = (_allowedTypes: string[] = ['application/json']) => {
  return (_req: Request, _res: Response, _next: NextFunction) => {
    // Skip for GET, HEAD, OPTIONS requests that don't typically have a body
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const contentType = req.headers['content-type'];

    if (!contentType) {
      return res.status(415).json({
        _message: 'Content-Type header is missing',
        _code: 'CONTENT_TYPE_MISSING'
      });
    }

    // Check if content type matches any of the allowed types
    const isValidContentType = allowedTypes.some(type =>
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isValidContentType) {
      return res.status(415).json({
        _message: `Unsupported Content-Type. Supported types: ${allowedTypes.join(', ')}`,
        _code: 'CONTENT_TYPE_UNSUPPORTED'
      });
    }

    next();
  };
};
