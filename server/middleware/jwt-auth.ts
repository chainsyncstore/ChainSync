import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';

import { getLogger } from '../../src/logging'; // Import application logger
import { AuthService, JWTPayload } from '../services/auth/auth-service.js'; // Assuming .js is intentional or types are provided

const logger = getLogger().child({ component: 'jwt-auth-middleware' }); // Initialize logger for this module

// Extend Request interface for JWT auth
declare module 'express-serve-static-core' {
  interface Request {
    jwtUser?: JWTPayload;
  }
}

export class JWTAuthMiddleware {
  constructor(private authService: AuthService) {}

  // JWT Authentication middleware
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Access token required' });
        return;
      }

      const token = authHeader.substring(7);
      const payload = await this.authService.validateAccessToken(token);

      if (!payload) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      (req as any).jwtUser = payload;
      next();
    } catch (error: unknown) {
      logger.error(
        'Authentication error in JWTAuthMiddleware.authenticate',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  // Optional authentication (doesn't fail if no token)
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = await this.authService.validateAccessToken(token);
        if (payload) {
          (req as any).jwtUser = payload;
        }
      }

      next();
    } catch (error: unknown) {
      logger.error(
        'Error in optionalAuth, continuing without authentication',
        error instanceof Error ? error : new Error(String(error))
      );
      // Continue without authentication
      next();
    }
  };

  // Role-based access control
  requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!(req as any).jwtUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!roles.includes((req as any).jwtUser.role)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          required: roles,
          current: (req as any).jwtUser.role,
        });
        return;
      }

      next();
    };
  };

  // Permission-based access control
  requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!(req as any).jwtUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!this.authService.hasPermission((req as any).jwtUser, permission)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          required: permission,
        });
        return;
      }

      next();
    };
  };

  // Resource-based access control
  requireResourceAccess = (resource: string, action: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!(req as any).jwtUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!this.authService.canAccessResource((req as any).jwtUser, resource, action)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          required: `${resource}:${action}`,
        });
        return;
      }

      next();
    };
  };

  // Admin only access
  requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!(req as any).jwtUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if ((req as any).jwtUser.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  };
}

// Rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: {
    error: 'Too many authentication attempts',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: Math.ceil(15 * 60), // seconds
      message: 'Please try again later',
    });
  },
});

// Rate limiting for password reset
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour per IP
  message: {
    error: 'Too many password reset attempts',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for general API endpoints
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: {
    error: 'Too many requests',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for admin endpoints
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  message: {
    error: 'Too many admin requests',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Create auth middleware instance
export const createJWTAuthMiddleware = (db: Pool): JWTAuthMiddleware => {
  const authService = new AuthService(db);
  return new JWTAuthMiddleware(authService);
};
