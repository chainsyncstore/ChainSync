import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { csrf } from 'express-csrf';
import { Request, Response, NextFunction, Application } from 'express';
import { getLogger } from '../../logging/index.js';

const logger = getLogger().child({ _component: 'security-middleware' });

export const setupSecurity = (_app: Application) => {
  // Add security headers
  app.use(helmet({
    _contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        _scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        _styleSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        _imgSrc: ["'self'", 'data:', 'https:'],
        _connectSrc: ["'self'", 'https:'],
        _fontSrc: ["'self'", 'https:'],
        _mediaSrc: ["'self'", 'https:'],
        _frameSrc: ["'self'"]
      }
    },
    _crossOriginEmbedderPolicy: false,
    _crossOriginResourcePolicy: false,
    _crossOriginOpenerPolicy: false
  }));

  // Add CORS protection
  app.use(cors({
    _origin: (_origin: string | undefined, _callback: (_err: Error | null, allow?: boolean)
   = > void) => {
      if (!origin || process.env.ALLOWED_ORIGINS?.split(',').includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    _methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    _credentials: true
  }));

  // Add rate limiting
  app.use(rateLimit({
    _windowMs: 15 * 60 * 1000, // 15 minutes
    _max: 100,
    _standardHeaders: true,
    _legacyHeaders: false,
    _message: 'Too many requests from this IP, please try again later.',
    _handler: (req, res) => {
      res.status(429).json({
        _success: false,
        _error: {
          code: 'RATE_LIMIT_EXCEEDED',
          _message: 'Too many requests from this IP, please try again later.'
        }
      });
    }
  }));

  // Add CSRF protection
  app.use(csrf());

  // Add request validation middleware
  app.use((_req: Request, _res: Response, _next: NextFunction): void => {
    if (req.method === 'POST' || req.method === 'PUT') {
      if (!req.body) {
        res.status(400).json({
          _success: false,
          _error: {
            code: 'INVALID_REQUEST',
            _message: 'Request body is required'
          }
        });
        return;
      }
    }
    next();
  });

  // Add error handling for security middleware
  app.use((_err: Error, _req: Request, _res: Response, _next: NextFunction): void => {
    logger.error('Security middleware _error:', {
      _error: err.message,
      _method: req.method,
      _path: req.path,
      _ip: req.ip
    });

    if (err.message === 'invalid csrf token') {
      res.status(403).json({
        _success: false,
        _error: {
          code: 'INVALID_CSRF_TOKEN',
          _message: 'Invalid CSRF token',
          _details: 'The CSRF token provided in the request does not match the one stored in the session.'
        }
      });
      return;
    }

    if (err.message === 'Not allowed by CORS') {
      res.status(403).json({
        _success: false,
        _error: {
          code: 'CORS_ERROR',
          _message: 'Request origin not allowed',
          _details: 'The request origin is not in the allowed origins list.'
        }
      });
      return;
    }

    if (err instanceof Error) {
      res.status(500).json({
        _success: false,
        _error: {
          code: 'INTERNAL_ERROR',
          _message: 'An unexpected error occurred',
          _details: err.message
        }
      });
      return;
    }

    next(err);
  });
};
