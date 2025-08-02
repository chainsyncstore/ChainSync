'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.validateContentType = exports.validateApiKey = exports.generateCsrfToken = exports.csrfProtection = exports.securityHeaders = void 0;
const helmet_1 = __importDefault(require('helmet'));
const index_js_1 = require('../../src/logging/index.js');
const auth_js_1 = require('../utils/auth.js');
// Get centralized logger for security middleware
const logger = (0, index_js_1.getLogger)().child({ _component: 'security-middleware' });
/**
 * Enhanced security headers middleware
 * Protects against common web _vulnerabilities:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME type sniffing
 * - CSP (Content Security Policy)
 */
exports.securityHeaders = (0, helmet_1.default)({
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
 * CSRF protection middleware
 * Protects against Cross-Site Request Forgery attacks
 */
const csrfProtection = (req, res, next) => {
  const reqLogger = req.logger || logger;
  // Skip CSRF check for API endpoints that use token auth instead of cookies
  // or for specific endpoints like webhooks
  if (req.path.startsWith('/api/public/') ||
        req.path.startsWith('/api/webhooks/') ||
        req.method === 'GET') {
    return next();
  }
  // Extract CSRF token from header or request body
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  // Compare with session token
  if (!csrfToken || csrfToken !== req.session.csrfToken) {
    reqLogger.warn('CSRF validation failed', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _hasSessionToken: !!req.session.csrfToken,
      _hasRequestToken: !!csrfToken
    });
    return res.status(403).json({
      _message: 'CSRF validation failed. Please refresh the page and try again.',
      _code: 'CSRF_ERROR'
    });
  }
  next();
};
exports.csrfProtection = csrfProtection;
/**
 * Generate CSRF token and add it to the response
 * This is called on login and when serving the frontend
 */
const generateCsrfToken = (req, res, next) => {
  // Generate random token if not already set
  if (!req.session.csrfToken) {
    const crypto = require('crypto');
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  // Expose CSRF token to frontend via safe response header
  res.set('X-CSRF-Token', req.session.csrfToken);
  // Set security-focused headers not covered by helmet
  res.set('Cache-Control', 'no-store, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
};
exports.generateCsrfToken = generateCsrfToken;
/**
 * Validate API keys for external service integrations
 * Used for webhook endpoints and external API access
 * Enhanced with timing-safe comparison to prevent timing attacks
 */
const validateApiKey = (req, res, next) => {
  const reqLogger = req.logger || logger;
  // Extract and validate API key using secure utility
  const { isValid, keyPrefix, keySource } = (0, auth_js_1.extractAndValidateApiKey)(req);
  if (!keyPrefix) {
    reqLogger.warn('API request missing API key', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip
    });
    return res.status(401).json({
      _message: 'API key is required',
      _code: 'API_KEY_MISSING'
    });
  }
  if (!isValid) {
    reqLogger.warn('Invalid API key used', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      keyPrefix, // Log just prefix for debugging
      keySource // Log where the key was found (header, query, body)
    });
    return res.status(403).json({
      _message: 'Invalid API key',
      _code: 'API_KEY_INVALID'
    });
  }
  // Add API client info to request for downstream use
  req.apiClient = {
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
exports.validateApiKey = validateApiKey;
/**
 * Content type validation middleware
 * Ensures that requests have the appropriate content type
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
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
    const isValidContentType = allowedTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()));
    if (!isValidContentType) {
      return res.status(415).json({
        _message: `Unsupported Content-Type. Supported types: ${allowedTypes.join(', ')}`,
        _code: 'CONTENT_TYPE_UNSUPPORTED'
      });
    }
    next();
  };
};
exports.validateContentType = validateContentType;
