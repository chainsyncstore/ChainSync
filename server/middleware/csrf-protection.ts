import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Enhanced CSRF Protection Middleware
 * Provides comprehensive CSRF protection with token validation
 */

interface CSRFOptions {
  secret?: string;
  tokenLength?: number;
  cookieName?: string;
  headerName?: string;
  ignoreMethods?: string[];
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
}

const defaultOptions: Required<CSRFOptions> = {
  secret: process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
  tokenLength: 32,
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: false, // Must be false so client can read it
  maxAge: 3600000 // 1 hour
};

/**
 * Generate a CSRF token
 */
function generateToken(secret: string, length: number): string {
  const randomBytes = crypto.randomBytes(length);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(randomBytes);
  const signature = hmac.digest('hex').substring(0, 16);
  return randomBytes.toString('hex') + signature;
}

/**
 * Verify a CSRF token
 */
function verifyToken(token: string, secret: string): boolean {
  if (!token || token.length < 32) {
    return false;
  }
  
  try {
    const tokenData = token.substring(0, token.length - 16);
    const signature = token.substring(token.length - 16);
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(Buffer.from(tokenData, 'hex'));
    const expectedSignature = hmac.digest('hex').substring(0, 16);
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

/**
 * CSRF Protection Middleware
 */
export function csrfProtection(options: CSRFOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF protection for safe methods
    if (opts.ignoreMethods.includes(req.method)) {
      // Generate and set token for safe methods
      const token = generateToken(opts.secret, opts.tokenLength);
      
      // Set CSRF token in cookie
      res.cookie(opts.cookieName, token, {
        httpOnly: opts.httpOnly,
        secure: opts.secure,
        sameSite: opts.sameSite,
        maxAge: opts.maxAge
      });
      
      // Make token available to templates/client
      res.locals.csrfToken = token;
      
      return next();
    }
    
    // For unsafe methods, verify the token
    const cookieToken = req.cookies[opts.cookieName];
    const headerToken = req.headers[opts.headerName] as string;
    const bodyToken = req.body?._csrf;
    
    // Get token from header, body, or query
    const submittedToken = headerToken || bodyToken || req.query._csrf;
    
    if (!cookieToken) {
      return res.status(403).json({
        error: 'CSRF token missing',
        message: 'CSRF protection requires a valid token'
      });
    }
    
    if (!submittedToken) {
      return res.status(403).json({
        error: 'CSRF token required',
        message: 'CSRF token must be provided in header, body, or query parameter'
      });
    }
    
    // Verify both tokens match and are valid
    if (cookieToken !== submittedToken || !verifyToken(cookieToken, opts.secret)) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed'
      });
    }
    
    // Token is valid, proceed
    res.locals.csrfToken = cookieToken;
    next();
  };
}

/**
 * Middleware to generate CSRF token for API responses
 */
export function csrfTokenGenerator(options: CSRFOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    const token = generateToken(opts.secret, opts.tokenLength);
    res.locals.csrfToken = token;
    
    // Add token to response headers for API clients
    res.setHeader('X-CSRF-Token', token);
    
    next();
  };
}

/**
 * Express route handler to get CSRF token
 */
export function csrfTokenRoute(options: CSRFOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response) => {
    const token = generateToken(opts.secret, opts.tokenLength);
    
    // Set token in cookie
    res.cookie(opts.cookieName, token, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      maxAge: opts.maxAge
    });
    
    res.json({
      csrfToken: token,
      cookieName: opts.cookieName,
      headerName: opts.headerName
    });
  };
}

/**
 * Double Submit Cookie CSRF Protection
 * Alternative implementation using double submit pattern
 */
export function doubleSubmitCSRF(options: CSRFOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for safe methods
    if (opts.ignoreMethods.includes(req.method)) {
      const token = crypto.randomBytes(opts.tokenLength).toString('hex');
      
      res.cookie(opts.cookieName, token, {
        httpOnly: false, // Client needs to read this
        secure: opts.secure,
        sameSite: opts.sameSite,
        maxAge: opts.maxAge
      });
      
      res.locals.csrfToken = token;
      return next();
    }
    
    // For unsafe methods, verify double submit
    const cookieToken = req.cookies[opts.cookieName];
    const headerToken = req.headers[opts.headerName] as string;
    const bodyToken = req.body?._csrf;
    
    const submittedToken = headerToken || bodyToken || req.query._csrf;
    
    if (!cookieToken || !submittedToken) {
      return res.status(403).json({
        error: 'CSRF protection failed',
        message: 'CSRF token required in both cookie and request'
      });
    }
    
    // Verify tokens match (timing-safe comparison)
    if (!crypto.timingSafeEqual(
      Buffer.from(cookieToken, 'hex'),
      Buffer.from(submittedToken, 'hex')
    )) {
      return res.status(403).json({
        error: 'CSRF token mismatch',
        message: 'CSRF tokens do not match'
      });
    }
    
    res.locals.csrfToken = cookieToken;
    next();
  };
}

/**
 * CSRF protection for API endpoints with custom validation
 */
export function apiCSRFProtection(options: CSRFOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for safe methods and preflight requests
    if (opts.ignoreMethods.includes(req.method) || req.method === 'OPTIONS') {
      return next();
    }
    
    // Check for CSRF token in various locations
    const token = req.headers[opts.headerName] as string ||
                  req.headers['x-xsrf-token'] as string ||
                  req.body?._csrf ||
                  req.query._csrf;
    
    if (!token) {
      return res.status(403).json({
        error: 'CSRF token required',
        message: `CSRF token must be provided in ${opts.headerName} header`
      });
    }
    
    // Verify token format and signature
    if (!verifyToken(token, opts.secret)) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'CSRF token is invalid or expired'
      });
    }
    
    next();
  };
}

export default csrfProtection;
