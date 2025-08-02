import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ component: 'jwt-middleware' });

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        storeId?: number;
        name?: string;
        email?: string;
      };
    }
  }
}

/**
 * JWT token validation middleware
 */
export const validateJWT = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!env.JWT_SECRET) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR'
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;

      // Validate required claims
      if (!decoded.id || !decoded.role) {
        res.status(401).json({
          error: 'Invalid token claims',
          code: 'INVALID_TOKEN'
        });
        return;
      }

      // Add user info to request
      req.user = {
        id: decoded.id,
        role: decoded.role,
        storeId: decoded.storeId,
        name: decoded.name,
        email: decoded.email
      };

      next();
    } catch (jwtError) {
      logger.warn('JWT validation failed', { error: jwtError });
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
      return;
    }
  } catch (error) {
    logger.error('JWT middleware error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
    return;
  }
};

/**
 * Generate JWT token for user
 */
export const generateJWT = (user: {
  id: string | number;
  role: string;
  storeId?: number;
  name?: string;
  email?: string;
}): string => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload = {
    id: user.id.toString(),
    role: user.role,
    storeId: user.storeId,
    name: user.name,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  };

  return jwt.sign(payload, env.JWT_SECRET);
};

/**
 * Role-based access control middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        code: 'FORBIDDEN'
      });
      return;
    }

    next();
  };
};

/**
 * Admin-only access middleware
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  requireRole(['admin'])(req, res, next);
};

/**
 * Manager or Admin access middleware
 */
export const requireManagerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  requireRole(['admin', 'manager'])(req, res, next);
};
