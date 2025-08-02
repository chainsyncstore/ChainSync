import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ _component: 'jwt-middleware' });

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        _role: string;
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
export const validateJWT = (_req: Request, _res: Response, _next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        _error: 'Access token required',
        _code: 'MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!env.JWT_SECRET) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({
        _error: 'Server configuration error',
        _code: 'CONFIG_ERROR'
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;

      // Validate required claims
      if (!decoded.id || !decoded.role) {
        res.status(401).json({
          _error: 'Invalid token claims',
          _code: 'INVALID_TOKEN'
        });
        return;
      }

      // Add user info to request
      req.user = {
        _id: decoded.id,
        _role: decoded.role,
        _storeId: decoded.storeId,
        _name: decoded.name,
        _email: decoded.email
      };

      next();
    } catch (jwtError) {
      logger.warn('JWT validation failed', { _error: jwtError });
      res.status(401).json({
        _error: 'Invalid or expired token',
        _code: 'INVALID_TOKEN'
      });
      return;
    }
  } catch (error) {
    logger.error('JWT middleware error', { _error: error instanceof Error ? error._message : String(error) });
    res.status(500).json({
      _error: 'Authentication error',
      _code: 'AUTH_ERROR'
    });
    return;
  }
};

/**
 * Generate JWT token for user
 */
export const generateJWT = (user: {
  _id: string | number;
  _role: string;
  storeId?: number;
  name?: string;
  email?: string;
}): string => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload = {
    _id: user.id.toString(),
    _role: user.role,
    _storeId: user.storeId,
    _name: user.name,
    _email: user.email,
    _iat: Math.floor(Date.now() / 1000),
    _exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  };

  return jwt.sign(payload, env.JWT_SECRET);
};

/**
 * Role-based access control middleware
 */
export const requireRole = (_allowedRoles: string[]) => {
  return (_req: Request, _res: Response, _next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        _error: 'Authentication required',
        _code: 'UNAUTHORIZED'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        _error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        _code: 'FORBIDDEN'
      });
      return;
    }

    next();
  };
};

/**
 * Admin-only access middleware
 */
export const requireAdmin = (_req: Request, _res: Response, _next: NextFunction) => {
  requireRole(['admin'])(req, res, next);
};

/**
 * Manager or Admin access middleware
 */
export const requireManagerOrAdmin = (_req: Request, _res: Response, _next: NextFunction) => {
  requireRole(['admin', 'manager'])(req, res, next);
};
