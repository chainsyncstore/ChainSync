// src/monitoring/sentryIntegration.ts
import * as Sentry from '@sentry/node';
import { Express, Request, Response, NextFunction } from 'express';
import { getLogger } from '../logging';

const logger = getLogger().child({ component: 'sentry-integration' });

/**
 * Initialize Sentry monitoring
 */
export function initializeSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('Sentry DSN not configured, error reporting disabled');
    return;
  }
  
  try {
    // Initialize Sentry with basic configuration
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      beforeSend(event) {
        // Don't send events in development mode unless forced
        if (process.env.NODE_ENV === 'development' && !process.env.FORCE_SENTRY) {
          return null;
        }
        
        // Sanitize sensitive data
        if (event.request && event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        
        return event;
      }
    });
    
    logger.info('Sentry monitoring initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error });
  }
}

/**
 * Create Sentry request handler middleware
 */
export function createRequestHandler(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Set transaction name
      const transaction = `${req.method} ${req.path}`;
      
      // Add user context if available
      if (req.session && req.session.userId) {
        Sentry.setUser({
          id: String(req.session.userId),
          username: req.session.fullName || 'unknown',
          role: req.session.userRole || 'unknown'
        });
      } else {
        Sentry.setUser(null);
      }
      
      // Add request context
      Sentry.setContext('request', {
        url: req.url,
        method: req.method,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Add transaction name as a tag
      Sentry.setTag('transaction', transaction);
      
      // Add response status code when response completes
      res.on('finish', () => {
        try {
          // Add status code as a tag
          Sentry.setTag('http.status_code', String(res.statusCode));
          
          // Add transaction outcome
          Sentry.setTag('transaction.outcome', res.statusCode < 500 ? 'success' : 'failure');
        } catch (err) {
          // Ignore errors in tagging
        }
      });
    } catch (error) {
      logger.error('Error in Sentry request handler', { error });
    }
    
    next();
  };
}

/**
 * Create Sentry error handler middleware
 */
export function createErrorHandler(): (err: any, req: Request, res: Response, next: NextFunction) => void {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    try {
      // Only capture server errors (5xx)
      const statusCode = err.status || err.statusCode || 500;
      
      if (statusCode >= 500) {
        Sentry.captureException(err);
      }
    } catch (error) {
      logger.error('Error in Sentry error handler', { error });
    }
    
    next(err);
  };
}

/**
 * Configure Sentry for Express application
 */
export function configureSentry(app: Express): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  
  try {
    // Initialize Sentry
    initializeSentry();
    
    // Add request handler
    app.use(createRequestHandler());
    
    // Add error handler (should be used after routes and before custom error handlers)
    app.use(createErrorHandler());
    
    logger.info('Sentry middleware configured successfully');
  } catch (error) {
    logger.error('Failed to configure Sentry middleware', { error });
  }
}
