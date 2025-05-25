// server/middleware/security.ts
// This file implements security middleware for the ChainSync API
// It includes protections against XSS, CSRF, clickjacking, and other common web vulnerabilities
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { getLogger } from '../../src/logging';
import { Session } from 'express-session';
import { extractAndValidateApiKey } from '../utils/auth';

// Define session with csrf token property
interface SessionWithCsrf {
  csrfToken?: string;
  userId?: string | number;
  userRole?: string;
}

// Get centralized logger for security middleware
const logger = getLogger().child({ component: 'security-middleware' });

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
      imgSrc: ["'self'", "data:", "cdn.jsdelivr.net", "*.amazonaws.com"], // For storage bucket images
      connectSrc: ["'self'", "api.chainsync.com", "*.amazonaws.com", "localhost:*"],
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
 * CSRF protection middleware
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
