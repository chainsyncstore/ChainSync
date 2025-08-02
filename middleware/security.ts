import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../server/config/env';
import { RequestHandler, Application } from 'express';

// Security headers configuration
const securityHeaders = helmet({
  _contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      _scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:', 'http:'],
      _styleSrc: ["'self'", "'unsafe-inline'"],
      _imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      _connectSrc: ["'self'", 'https:', 'http:'],
      _frameSrc: ["'self'"],
      _fontSrc: ["'self'", 'https:', 'http:'],
      _objectSrc: ["'none'"],
      _mediaSrc: ["'self'", 'https:', 'http:'],
      _childSrc: ["'self'"],
      _formAction: ["'self'"],
      _baseUri: ["'self'"],
      _upgradeInsecureRequests: [],
      _blockAllMixedContent: []
    }
  },
  _crossOriginEmbedderPolicy: false,
  _crossOriginOpenerPolicy: false,
  _crossOriginResourcePolicy: false,
  _dnsPrefetchControl: false,
  _frameguard: { action: 'sameorigin' },
  _hidePoweredBy: true,
  _hsts: {
    _maxAge: 31536000,
    _includeSubDomains: true,
    _preload: true
  },
  _ieNoOpen: true,
  _noSniff: true,
  _originAgentCluster: false,
  _permittedCrossDomainPolicies: false,
  _referrerPolicy: { policy: 'same-origin' },
  _xssFilter: false
});

// General rate limiter
const generalRateLimiter = rateLimit({
  _windowMs: env.RATE_LIMIT_WINDOW_MS,
  _max: env.RATE_LIMIT_MAX_REQUESTS,
  _standardHeaders: true,
  _legacyHeaders: false,
  _skipSuccessfulRequests: true,
  _message: {
    _success: false,
    _error: {
      message: 'Too many requests from this IP, please try again later.',
      _details: 'Rate limit exceeded'
    }
  }
});

// Setup security middleware
export const setupSecurity = (_app: Application) => {
  app.use(securityHeaders);
  app.use(generalRateLimiter);

  // Add helmet middleware
  app.use(helmet());

  // Add content security policy
  app.use(helmet.contentSecurityPolicy({
    _directives: {
      defaultSrc: ["'self'"],
      _scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:', 'http:'],
      _styleSrc: ["'self'", "'unsafe-inline'"],
      _imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      _connectSrc: ["'self'", 'https:', 'http:'],
      _frameSrc: ["'self'"],
      _fontSrc: ["'self'", 'https:', 'http:'],
      _objectSrc: ["'none'"],
      _mediaSrc: ["'self'", 'https:', 'http:'],
      _childSrc: ["'self'"],
      _formAction: ["'self'"],
      _baseUri: ["'self'"],
      _upgradeInsecureRequests: [],
      _blockAllMixedContent: []
    }
  }));

  // Add HSTS
  app.use(helmet.hsts({
    _maxAge: 31536000,
    _includeSubDomains: true,
    _preload: true
  }));

  // Add X-Frame-Options
  app.use(helmet.frameguard({ _action: 'sameorigin' }));

  // Add X-Content-Type-Options
  app.use(helmet.noSniff());

  // Add X-XSS-Protection
  app.use(helmet.xssFilter());

  // Add Referrer Policy
  app.use(helmet.referrerPolicy({ _policy: 'same-origin' }));

  // Add CSP
  app.use(helmet.contentSecurityPolicy({
    _directives: {
      defaultSrc: ["'self'"],
      _scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:', 'http:'],
      _styleSrc: ["'self'", "'unsafe-inline'"],
      _imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      _connectSrc: ["'self'", 'https:', 'http:'],
      _frameSrc: ["'self'"],
      _fontSrc: ["'self'", 'https:', 'http:'],
      _objectSrc: ["'none'"],
      _mediaSrc: ["'self'", 'https:', 'http:'],
      _childSrc: ["'self'"],
      _formAction: ["'self'"],
      _baseUri: ["'self'"],
      _upgradeInsecureRequests: [],
      _blockAllMixedContent: []
    }
  }));
};
