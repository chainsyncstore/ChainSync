import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { RequestHandler, Application } from 'express';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:"],
      frameSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "http:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:", "http:"],
      childSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
      blockAllMixedContent: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  dnsPrefetchControl: false,
  frameguard: { action: 'sameorigin' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: false,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'same-origin' },
  xssFilter: false
});

// General rate limiter
const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      details: 'Rate limit exceeded'
    }
  }
});

// CSRF Protection setup
const csrfProtection = csurf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Setup security middleware
export const setupSecurity = (app: Application) => {
  // Parse cookies (required for CSRF)
  app.use(cookieParser());
  
  // Apply basic security headers once
  app.use(securityHeaders);
  
  // Apply rate limiting
  app.use(generalRateLimiter);
  
  // Add CSRF protection to routes that modify state
  // Skip CSRF for API routes when needed (e.g., webhook endpoints)
  app.use((req, res, next) => {
    // Skip CSRF for webhook endpoints and public API routes
    if (
      req.path.startsWith('/api/webhooks') || 
      req.path.startsWith('/api/public') ||
      (req.method === 'GET' && !req.path.includes('/admin'))
    ) {
      next();
    } else {
      csrfProtection(req, res, next);
    }
  });
  
  // Apply additional headers for all responses
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Disable caching for authenticated routes
    if (req.path.startsWith('/api/') && req.path !== '/api/public') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    next();
  });
}
