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
const logger = getLogger().child({ component: 'security-middleware' });

// Password policy configuration
const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
  preventReuse: 5, // Prevent reuse of last 5 passwords
  lockoutThreshold: 5, // Lock account after 5 failed attempts
  lockoutDuration: 15 * 60 * 1000, // 15 minutes in milliseconds
};

// MFA configuration
const MFA_CONFIG = {
  issuer: 'ChainSync',
  algorithm: 'sha1',
  digits: 6,
  period: 30, // 30 seconds
  window: 2, // Allow 2 time steps for clock skew
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
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"], // Add any CDNs you need
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "cdn.jsdelivr.net"],
      connectSrc: ["'self'", "api.chainsync.com", "localhost:*"],
      fontSrc: ["'self'", "fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"], // Restricts base URIs that can be used
      formAction: ["'self'"], // Restricts where forms can submit to
      frameAncestors: ["'none'"], // Prevents embedding in iframes (alternative to X-Frame-Options)
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"], // For web workers
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: [],
    },
    reportOnly: process.env.NODE_ENV === 'development' // Use CSP in report-only mode during development
  },
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production' ? true : false, // Stricter in production
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' }, // Prevent clickjacking
  hsts: {
    maxAge: 63072000, // 2 years in seconds
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true, // Prevent MIME type sniffing
  originAgentCluster: true, // Improves isolation between sites
  permittedCrossDomainPolicies: { permittedPolicies: 'none' }, // Restricts Adobe Flash and Acrobat
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, // More secure referrer policy
  xssFilter: true, // Provides basic XSS protection
});

/**
 * Password validation middleware
 * Enforces strong password policies
 */
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
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
    isValid: errors.length === 0,
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
    return crypto.randomBytes(20).toString('base32');
  }
  
  /**
   * Generate QR code URL for MFA setup
   */
  static generateQRUrl(email: string, secret: string): string {
    const otpauth = `otpauth://totp/${encodeURIComponent(MFA_CONFIG.issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(MFA_CONFIG.issuer)}&algorithm=${MFA_CONFIG.algorithm}&digits=${MFA_CONFIG.digits}&period=${MFA_CONFIG.period}`;
    return `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpauth)}`;
  }
  
  /**
   * Validate MFA token
   */
  static validateToken(token: string, secret: string): boolean {
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
export const accountLockoutMiddleware = (req: Request, res: Response, next: NextFunction) => {
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
        userId: session.userId,
        remainingMinutes: remainingTime,
        ip: req.ip
      });
      
      return res.status(423).json({
        error: 'Account temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED',
        remainingMinutes: remainingTime
      });
    } else {
      // Reset lockout after duration expires
      session.loginAttempts = 0;
      session.lastLoginAttempt = undefined;
    }
  }
  
  next();
};

/**
 * MFA verification middleware
 * Ensures MFA is completed for sensitive operations
 */
export const requireMFA = (req: Request, res: Response, next: NextFunction) => {
  const session = req.session as SessionWithCsrf;
  const reqLogger = (req as any).logger || logger;
  
  if (!session.userId) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }
  
  if (session.mfaRequired && !session.mfaVerified) {
    reqLogger.warn('MFA verification required', {
      userId: session.userId,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(403).json({
      error: 'Multi-factor authentication required',
      code: 'MFA_REQUIRED'
    });
  }
  
  next();
};

/**
 * Security event logging middleware
 * Logs security-relevant events for monitoring and compliance
 */
export const securityEventLogger = (eventType: string, details: any) => {
  logger.info('Security event', {
    eventType,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Enhanced CSRF protection middleware
 * Protects against Cross-Site Request Forgery attacks
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const reqLogger = (req as any).logger || logger;
  
  // Skip CSRF check for API endpoints that use token auth instead of cookies
  // or for specific endpoints like webhooks
  if (
    req.path.startsWith('/api/public/') ||
    req.path.startsWith('/api/webhooks/') ||
    req.method === 'GET'
  ) {
    return next();
  }
  
  // Extract CSRF token from header or request body
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  
  // Compare with session token
  if (!csrfToken || csrfToken !== (req.session as any).csrfToken) {
    securityEventLogger('CSRF_ATTEMPT', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      hasSessionToken: !!(req.session as any).csrfToken,
      hasRequestToken: !!csrfToken,
      userAgent: req.headers['user-agent']
    });
    
    reqLogger.warn('CSRF validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      hasSessionToken: !!(req.session as any).csrfToken,
      hasRequestToken: !!csrfToken
    });
    
    return res.status(403).json({
      message: 'CSRF validation failed. Please refresh the page and try again.',
      code: 'CSRF_ERROR'
    });
  }
  
  next();
};

/**
 * Generate CSRF token and add it to the response
 * This is called on login and when serving the frontend
 */
export const generateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
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
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const reqLogger = (req as any).logger || logger;
  
  // Extract and validate API key using secure utility
  const { isValid, keyPrefix, keySource } = extractAndValidateApiKey(req);
  
  if (!keyPrefix) {
    reqLogger.warn('API request missing API key', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(401).json({
      message: 'API key is required',
      code: 'API_KEY_MISSING'
    });
  }
  
  if (!isValid) {
    reqLogger.warn('Invalid API key used', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      keyPrefix, // Log just prefix for debugging
      keySource  // Log where the key was found (header, query, body)
    });
    
    return res.status(403).json({
      message: 'Invalid API key',
      code: 'API_KEY_INVALID'
    });
  }
  
  // Add API client info to request for downstream use
  (req as any).apiClient = {
    keyPrefix,
    keySource,
    isAuthorized: true,
    timestamp: new Date().toISOString()
  };
  
  // Log successful API key validation
  reqLogger.info('API key validated successfully', {
    path: req.path,
    method: req.method,
    keyPrefix,
    keySource
  });
  
  next();
};

/**
 * Content type validation middleware
 * Ensures that requests have the appropriate content type
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for GET, HEAD, OPTIONS requests that don't typically have a body
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      return res.status(415).json({
        message: 'Content-Type header is missing',
        code: 'CONTENT_TYPE_MISSING'
      });
    }
    
    // Check if content type matches any of the allowed types
    const isValidContentType = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isValidContentType) {
      return res.status(415).json({
        message: `Unsupported Content-Type. Supported types: ${allowedTypes.join(', ')}`,
        code: 'CONTENT_TYPE_UNSUPPORTED'
      });
    }
    
    next();
  };
};
