import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { getLogger } from '../../src/logging';
import { UnifiedAuthService } from '../services/auth/unified-auth-service';
import { AppError, ErrorCode, ErrorCategory } from '../../shared/types/errors';
import { UserPayload } from '../types/user';
import { JWTPayload } from '../services/auth/unified-auth-service';

// Initialize logger
const logger = {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

// Attempt to use the getLogger if available
try {
  const loggerInstance = getLogger();
  if (typeof loggerInstance?.child === 'function') {
    Object.assign(logger, loggerInstance.child({ component: 'secure-auth-middleware' }));
  }
} catch (e: unknown) {
  console.warn('Could not initialize logger, using fallback', e);
}

// Import required dependencies
import { db } from '../../db';
import { getRedisClient } from '../../src/cache/redis';
import Redis from 'ioredis';

// Create singleton instance of auth service with required dependencies
let redis;
try {
  redis = getRedisClient();
  if (!redis) {
    // If Redis client is null, create a mock implementation for fallback
    logger.warn('Redis client is null, using in-memory fallback');
    redis = {
      // Implement minimal Redis interface needed by the auth service
      get: async () => null,
      set: async () => 'OK',
      del: async () => 1,
      expire: async () => 1,
      scan: async () => ['0', []],
      quit: async () => 'OK'
    } as unknown as Redis;
  }
} catch (e: unknown) {
  logger.error('Error initializing Redis client, using in-memory fallback', e);
  // Create mock Redis implementation
  redis = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
    expire: async () => 1,
    scan: async () => ['0', []],
    quit: async () => 'OK'
  } as unknown as Redis;
}

const authService = new UnifiedAuthService(
  db, 
  redis, 
  process.env.JWT_SECRET, 
  process.env.JWT_REFRESH_SECRET
);

// Rate limiting for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip, 
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    
    const error = new AppError( // Constructor order: message, category, code, details, statusCode
      'Too many authentication attempts, please try again later',
      ErrorCategory.AUTHENTICATION,
      ErrorCode.AUTHENTICATION, // This now exists in shared/types/errors.ts
      { retryAfter: '15 minutes' },
      429
    );
    
    res.status(429).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        retryAfter: '15 minutes'
      }
    });
  }
});

/**
 * Enhanced JWT authentication middleware using UnifiedAuthService
 */
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }
    
    // Validate token
    const payload = await authService.validateAccessToken(token);
    
    if (!payload) {
      return next();
    }
    
    // Set user data on request using centralized UserPayload interface
    req.user = {
      id: payload.userId,
      role: payload.role,
      storeId: payload.storeId,
      name: payload.email || 'Unknown User', // name is optional in UserPayload
      email: payload.email, // email is optional in UserPayload
      permissions: payload.permissions,
      sessionId: payload.sessionId
    } as UserPayload; // Cast to UserPayload
    
    next();
  } catch (error: unknown) {
    logger.error('Authentication error', { error });
    next();
  }
};

/**
 * Middleware to require authentication
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: ErrorCode.AUTHENTICATION,
        message: 'Authentication required'
      }
    });
  }
  
  next();
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: 'Authentication required'
        }
      });
    }
    
    // Create a partial JWT payload with the necessary fields for role checking
    if (!authService.hasRole(req.user.role, roles)) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: 'Insufficient permissions'
        }
      });
    }
    
    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: 'Authentication required'
        }
      });
    }
    
    // Check permission directly
    if (!(req.user as UserPayload).permissions?.includes(permission) && (req.user as UserPayload).role !== 'admin') { // Cast req.user
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: `Required permission: ${permission}`
        }
      });
    }
    
    next();
  };
};

/**
 * Store access control middleware
 * Validates that the user has access to the store specified in the request
 */
export const requireStoreAccess = (storeIdParam = 'storeId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: 'Authentication required'
        }
      });
    }
    
    // Admin users can access any store
    if ((req.user as UserPayload).role === 'admin') { // Cast req.user
      return next();
    }
    
    // Get store ID from request parameters, query, or body
    const requestStoreId = 
      req.params[storeIdParam] || 
      req.query[storeIdParam] || 
      (req.body && req.body[storeIdParam]);
    
    // Convert to number for comparison
    const storeIdToCheck = requestStoreId ? Number(requestStoreId) : undefined;
    
    // If no store ID is specified in the request, continue
    if (!storeIdToCheck) {
      return next();
    }
    
    // Check if user has access to the requested store
    if ((req.user as UserPayload).storeId && (req.user as UserPayload).storeId !== storeIdToCheck) { // Cast req.user
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: 'You do not have access to this store'
        }
      });
    }
    
    next();
  };
};

// Refresh token endpoint handler
export const handleTokenRefresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.BAD_REQUEST,
          message: 'Refresh token is required'
        }
      });
    }
    
    const result = await authService.refreshAccessToken(refreshToken);
    
    if (!result) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: 'Invalid or expired refresh token'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken
      }
    });
  } catch (error: unknown) {
    logger.error('Error refreshing token', { error });
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Failed to refresh token'
      }
    });
  }
};

// Logout endpoint handler
export const handleLogout = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: 'Authentication required'
        }
      });
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.BAD_REQUEST,
          message: 'Invalid token format'
        }
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      // Validate and decode the token to get the session ID
      const payload = await authService.validateAccessToken(token);
      
      if (payload && payload.sessionId) {
        // Invalidate the session
        await authService.logout(payload.sessionId);
      }
    } catch (error: unknown) {
      // Even if token validation fails, we consider the user logged out
      logger.warn('Error during logout token validation', { error });
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: unknown) {
    logger.error('Error during logout', { error });
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Failed to process logout'
      }
    });
  }
};

// Logout all sessions endpoint handler
export const handleLogoutAll = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION,
          message: 'Authentication required'
        }
      });
    }
    
    await authService.logoutAllSessions((req.user as UserPayload).id.toString()); // Cast req.user
    
    res.json({
      success: true,
      message: 'Logged out of all sessions successfully'
    });
  } catch (error: unknown) {
    logger.error('Error during logout all sessions', { error });
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Failed to process logout for all sessions'
      }
    });
  }
};

// No need to extend Express Request interface here
// It's now centralized in server/types/user.ts
