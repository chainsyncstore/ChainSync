import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../../src/logging';
import { parse as parseContentSecurityPolicy } from 'content-security-policy-parser';
import { UAParser } from 'ua-parser-js';
import ipRangeCheck from 'ip-range-check';
import { randomBytes } from 'crypto';

const logger = getLogger().child({ component: 'advanced-security' });

/**
 * Configuration options for Content Security Policy
 */
export interface CSPOptions {
  /** Enable report-only mode (doesn't block, only reports violations) */
  reportOnly?: boolean;
  
  /** URL to send CSP violation reports to */
  reportUri?: string;
  
  /** Default source directives */
  defaultSrc?: string[];
  
  /** Script source directives */
  scriptSrc?: string[];
  
  /** Style source directives */
  styleSrc?: string[];
  
  /** Image source directives */
  imgSrc?: string[];
  
  /** Font source directives */
  fontSrc?: string[];
  
  /** Connect source directives */
  connectSrc?: string[];
  
  /** Frame source directives */
  frameSrc?: string[];
  
  /** Object source directives */
  objectSrc?: string[];
  
  /** Media source directives */
  mediaSrc?: string[];
  
  /** Worker source directives */
  workerSrc?: string[];
  
  /** Manifest source directives */
  manifestSrc?: string[];
  
  /** Base URI directives */
  baseUri?: string[];
  
  /** Form action directives */
  formAction?: string[];
  
  /** Frame ancestors directives */
  frameAncestors?: string[];
  
  /** Block all mixed content */
  blockAllMixedContent?: boolean;
  
  /** Upgrade insecure requests */
  upgradeInsecureRequests?: boolean;
}

/**
 * Default CSP configuration for production environments
 */
const DEFAULT_CSP_CONFIG: CSPOptions = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  imgSrc: ["'self'", "data:", "https://secure.gravatar.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  connectSrc: ["'self'"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  blockAllMixedContent: true,
  upgradeInsecureRequests: true
};

/**
 * Build Content Security Policy header value from options
 */
function buildCSPHeader(options: CSPOptions): string {
  const directives: string[] = [];
  
  // Add default-src
  if (options.defaultSrc) {
    directives.push(`default-src ${options.defaultSrc.join(' ')}`);
  }
  
  // Add script-src
  if (options.scriptSrc) {
    directives.push(`script-src ${options.scriptSrc.join(' ')}`);
  }
  
  // Add style-src
  if (options.styleSrc) {
    directives.push(`style-src ${options.styleSrc.join(' ')}`);
  }
  
  // Add img-src
  if (options.imgSrc) {
    directives.push(`img-src ${options.imgSrc.join(' ')}`);
  }
  
  // Add font-src
  if (options.fontSrc) {
    directives.push(`font-src ${options.fontSrc.join(' ')}`);
  }
  
  // Add connect-src
  if (options.connectSrc) {
    directives.push(`connect-src ${options.connectSrc.join(' ')}`);
  }
  
  // Add frame-src
  if (options.frameSrc) {
    directives.push(`frame-src ${options.frameSrc.join(' ')}`);
  }
  
  // Add object-src
  if (options.objectSrc) {
    directives.push(`object-src ${options.objectSrc.join(' ')}`);
  }
  
  // Add media-src
  if (options.mediaSrc) {
    directives.push(`media-src ${options.mediaSrc.join(' ')}`);
  }
  
  // Add worker-src
  if (options.workerSrc) {
    directives.push(`worker-src ${options.workerSrc.join(' ')}`);
  }
  
  // Add manifest-src
  if (options.manifestSrc) {
    directives.push(`manifest-src ${options.manifestSrc.join(' ')}`);
  }
  
  // Add base-uri
  if (options.baseUri) {
    directives.push(`base-uri ${options.baseUri.join(' ')}`);
  }
  
  // Add form-action
  if (options.formAction) {
    directives.push(`form-action ${options.formAction.join(' ')}`);
  }
  
  // Add frame-ancestors
  if (options.frameAncestors) {
    directives.push(`frame-ancestors ${options.frameAncestors.join(' ')}`);
  }
  
  // Add block-all-mixed-content
  if (options.blockAllMixedContent) {
    directives.push('block-all-mixed-content');
  }
  
  // Add upgrade-insecure-requests
  if (options.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }
  
  // Add report-uri
  if (options.reportUri) {
    directives.push(`report-uri ${options.reportUri}`);
  }
  
  return directives.join('; ');
}

/**
 * Enhanced Content Security Policy middleware
 */
export function contentSecurityPolicy(options: CSPOptions = DEFAULT_CSP_CONFIG) {
  // Merge options with defaults
  const config = { ...DEFAULT_CSP_CONFIG, ...options };
  
  // Build CSP header
  const headerValue = buildCSPHeader(config);
  const headerName = config.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Set CSP header
    res.setHeader(headerName, headerValue);
    next();
  };
}

/**
 * Permissions Policy (formerly Feature Policy) middleware
 * Restricts which browser features can be used
 */
export function permissionsPolicy() {
  const policy = [
    'camera=self',
    'microphone=self',
    'geolocation=self',
    'accelerometer=self',
    'autoplay=self',
    'gyroscope=self',
    'magnetometer=self',
    'midi=self',
    'payment=self',
    'picture-in-picture=self',
    'usb=self'
  ].join(', ');
  
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', policy);
    next();
  };
}

/**
 * Trust Tokens (Privacy Budget) middleware
 * Implements Privacy Budget API headers
 */
export function trustTokens() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Trustworthy-Token', 'always');
    res.setHeader('Privacy-Budget', 'default');
    next();
  };
}

/**
 * IP filtering middleware for restricted endpoints
 */
export function ipFilter(
  allowedIPs: string[] = [], 
  blockedIPs: string[] = [],
  options: { 
    allowLocalhost?: boolean,
    allowPrivateNetworks?: boolean,
    statusCode?: number, 
    message?: string 
  } = {}
) {
  const defaultOptions = {
    allowLocalhost: true,
    allowPrivateNetworks: true,
    statusCode: 403,
    message: 'Access denied by IP filter'
  };
  
  const config = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    const ipAddress = (
      req.headers['x-forwarded-for'] as string || 
      req.connection.remoteAddress || 
      ''
    ).split(',')[0].trim();
    
    // Always allow localhost if configured
    if (config.allowLocalhost && (ipAddress === '127.0.0.1' || ipAddress === '::1')) {
      return next();
    }
    
    // Allow private networks if configured
    const privateNetworks = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      'fc00::/7'
    ];
    
    if (config.allowPrivateNetworks && privateNetworks.some(range => ipRangeCheck(ipAddress, range))) {
      return next();
    }
    
    // Check blocked IPs first
    if (blockedIPs.length > 0 && blockedIPs.some(ip => ipRangeCheck(ipAddress, ip))) {
      logger.warn('IP address blocked by filter', { ipAddress });
      return res.status(config.statusCode).json({ error: config.message });
    }
    
    // If allowed IPs are specified, check if the IP is allowed
    if (allowedIPs.length > 0 && !allowedIPs.some(ip => ipRangeCheck(ipAddress, ip))) {
      logger.warn('IP address not in allowed list', { ipAddress });
      return res.status(config.statusCode).json({ error: config.message });
    }
    
    next();
  };
}

/**
 * Device fingerprinting middleware for fraud detection
 */
export function deviceFingerprinting() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse user agent
      const userAgent = req.headers['user-agent'] || '';
      const parser = new UAParser(userAgent);
      const result = parser.getResult();
      
      // Generate fingerprint from available data
      const fingerprintData = {
        userAgent,
        browser: result.browser,
        engine: result.engine,
        os: result.os,
        device: result.device,
        cpu: result.cpu,
        ip: req.ip,
        acceptLanguage: req.headers['accept-language'],
        acceptEncoding: req.headers['accept-encoding'],
        acceptCharset: req.headers['accept-charset']
      };
      
      // Attach fingerprint to request for fraud detection
      (req as any).deviceFingerprint = fingerprintData;
      
      next();
    } catch (error) {
      logger.error('Error in device fingerprinting middleware', { error });
      next();
    }
  };
}

/**
 * Trusted Types middleware for preventing DOM XSS
 */
export function trustedTypes(options: {
  reportOnly?: boolean;
  reportUri?: string;
} = {}) {
  const policy = [
    "default 'none'",
    "script 'self'"
  ].join('; ');
  
  const headerName = options.reportOnly 
    ? 'Content-Security-Policy-Report-Only' 
    : 'Content-Security-Policy';
  
  return (req: Request, res: Response, next: NextFunction) => {
    let headerValue = `trusted-types ${policy}`;
    
    if (options.reportUri) {
      headerValue += `; report-uri ${options.reportUri}`;
    }
    
    res.setHeader(headerName, headerValue);
    next();
  };
}

/**
 * CORS Preflight Cache middleware
 * Optimizes CORS preflight requests with caching
 */
export function corsPreflightCache(maxAge: number = 3600) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only set cache for preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', maxAge.toString());
    }
    next();
  };
}

/**
 * Security headers middleware
 * Combines multiple security headers into a single middleware
 */
export function enhancedSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set X-XSS-Protection header
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Set X-Content-Type-Options header
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Set X-Frame-Options header
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Set Referrer-Policy header
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Set Cache-Control for security-sensitive pages
    if (req.path.includes('/api/auth/') || req.path.includes('/api/admin/')) {
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Set Clear-Site-Data header for logout endpoints
    if (req.path === '/api/auth/logout') {
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    }
    
    next();
  };
}

/**
 * Secure cookie middleware
 * Ensures cookies are secure by default
 */
export function secureCookies() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Override res.cookie method to add secure attributes
    const originalCookie = res.cookie;
    res.cookie = function(name, value, options = {}) {
      const secureOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        ...options
      };
      
      return originalCookie.call(this, name, value, secureOptions);
    };
    
    next();
  };
}

/**
 * Security nonce middleware
 * Adds a unique nonce to requests for use in CSP
 */
export function securityNonce() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate a random nonce
    const nonce = randomBytes(16).toString('base64');
    
    // Attach to request
    (req as any).cspNonce = nonce;
    
    // Modify CSP header to include nonce if present
    const cspHeader = res.getHeader('Content-Security-Policy');
    if (cspHeader) {
      const csp = parseContentSecurityPolicy(cspHeader.toString());
      
      // Add nonce to script-src and style-src
      if (csp['script-src']) {
        csp['script-src'].push(`'nonce-${nonce}'`);
      }
      
      if (csp['style-src']) {
        csp['style-src'].push(`'nonce-${nonce}'`);
      }
      
      // Rebuild CSP header
      const updatedCsp = Object.entries(csp)
        .map(([key, values]) => `${key} ${values.join(' ')}`)
        .join('; ');
      
      res.setHeader('Content-Security-Policy', updatedCsp);
    }
    
    next();
  };
}

/**
 * Apply all enhanced security middleware in the recommended order
 */
export function applyAdvancedSecurity(app: any) {
  // Apply security headers first
  app.use(enhancedSecurityHeaders());
  
  // Apply Content Security Policy
  app.use(contentSecurityPolicy());
  
  // Apply Permissions Policy
  app.use(permissionsPolicy());
  
  // Apply security nonce
  app.use(securityNonce());
  
  // Apply secure cookies
  app.use(secureCookies());
  
  // Apply CORS preflight cache
  app.use(corsPreflightCache());
  
  // Apply device fingerprinting for fraud detection
  app.use(deviceFingerprinting());
  
  // Apply Trusted Types (for modern browsers)
  app.use(trustedTypes());
  
  logger.info('Advanced security middleware applied');
}
