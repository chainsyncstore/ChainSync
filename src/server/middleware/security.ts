import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from 'csurf';
import { Request, Response, NextFunction, Application } from 'express';
import { getLogger } from '../../logging/index.js';

const logger = getLogger().child({ component: 'security-middleware' });

export const setupSecurity = (app: Application) => {
  // Add security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "https:"],
        mediaSrc: ["'self'", "https:"],
        frameSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false
  }));

  // Add CORS protection
  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || process.env.ALLOWED_ORIGINS?.split(',').includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }));

  // Add rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.'
        }
      });
    }
  }));

  // Add CSRF protection
  app.use(csrf({ cookie: true, ignoreMethods: ['HEAD', 'OPTIONS'] }));

  // Add request validation middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PUT') {
      if (!req.body) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request body is required'
          }
        });
      }
    }
    next();
  });

  // Add error handling for security middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Security middleware error:', {
      error: err.message,
      method: req.method,
      path: req.path,
      ip: req.ip
    });

    if (err.message === 'invalid csrf token') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_CSRF_TOKEN',
          message: 'Invalid CSRF token',
          details: 'The CSRF token provided in the request does not match the one stored in the session.'
        }
      });
    }

    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CORS_ERROR',
          message: 'Request origin not allowed',
          details: 'The request origin is not in the allowed origins list.'
        }
      });
    }

    if (err instanceof Error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: err.message
        }
      });
    }
    
    next(err);
  });
};
