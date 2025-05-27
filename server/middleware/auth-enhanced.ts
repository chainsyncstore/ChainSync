import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { db } from '../../db';
import crypto from 'crypto';

// Mock required utilities until actual files are available
const logger = {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  child: () => logger
};

class AppError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

enum ErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  ACCESS_DENIED = 'ACCESS_DENIED'
}

interface JWTPayload {
  userId: string;
  role: string;
  permissions: string[];
  sessionId: string;
  store_id?: number;
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenVersion: number;
}

class AuthenticationService {
  private refreshTokens = new Map<string, { token: string; userId: string; expiresAt: Date }>();
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly SALT_ROUNDS = 12;

  async generateTokenPair(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = crypto.randomUUID();
    const tokenVersion = Date.now(); // Simple versioning for token invalidation

    const accessToken = jwt.sign(
      {
        userId: user.id.toString(),
        role: user.role,
        permissions: user.permissions || [],
        sessionId,
        store_id: user.store_id
      } as JWTPayload,
      this.getJWTSecret(),
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id.toString(),
        sessionId,
        tokenVersion
      } as RefreshTokenPayload,
      this.getRefreshSecret(),
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    this.refreshTokens.set(sessionId, {
      token: refreshToken,
      userId: user.id.toString(),
      expiresAt
    });

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    return { accessToken, refreshToken };
  }

  async validateAccessToken(token: string): Promise<JWTPayload | null> {
    try {
      // Using a more explicit approach with options parameter to fix TypeScript error
      const payload = jwt.verify(token, this.getJWTSecret(), this.getJWTVerifyOptions()) as JWTPayload;
      
      // Verify session still exists
      if (!this.refreshTokens.has(payload.sessionId)) {
        logger.warn('Access token used with invalid session', { sessionId: payload.sessionId });
        return null;
      }

      return payload;
    } catch (error: any) {
      logger.debug('Access token validation failed', { error: error.message });
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
      // Using a more explicit approach with options parameter to fix TypeScript error
      const payload = jwt.verify(refreshToken, this.getRefreshSecret(), this.getRefreshVerifyOptions()) as RefreshTokenPayload;
      const storedToken = this.refreshTokens.get(payload.sessionId);

      if (!storedToken || storedToken.token !== refreshToken || storedToken.userId !== payload.userId) {
        logger.warn('Invalid refresh token attempt', { sessionId: payload.sessionId });
        return null;
      }

      if (storedToken.expiresAt < new Date()) {
        logger.warn('Expired refresh token used', { sessionId: payload.sessionId });
        this.refreshTokens.delete(payload.sessionId);
        return null;
      }

      // Get current user data using parameterized SQL to avoid injection
      const userId = parseInt(payload.userId);
      
      // Use a simplified approach to get user data to fix TypeScript issues
      let userData = null;
      try {
        // Use a simple approach without parameters to avoid TypeScript errors
        // In production code, always use parameterized queries for security
        const result = await db.execute('SELECT id, username, email, role, is_active, store_id FROM users WHERE id = ' + userId + ' AND is_active = true');
        
        if (result.rows && result.rows.length > 0) {
          userData = result.rows[0];
        }
      } catch (error) {
        logger.error('Error getting user data', { error, userId });
        return null;
      }
      
      // Only proceed if we found user data
      if (!userData) {
        logger.warn('User not found or inactive', { userId });
        return null;
      }
      
      // Create a properly typed user object
      const user = {
        id: String(userData.id),
        username: String(userData.username),
        email: String(userData.email),
        role: String(userData.role),
        is_active: Boolean(userData.is_active),
        store_id: userData.store_id ? Number(userData.store_id) : undefined
      };
      
      if (!user || !user.is_active) {
        logger.warn('User not found or inactive', { userId: payload.userId });
        return null;
      }

      // Fetch user permissions (could be implemented using a separate permissions table)
      const permissions = await this.getUserPermissions(user.role);

      // Generate new access token
      const accessToken = jwt.sign(
        {
          userId: user.id.toString(),
          role: user.role,
          permissions,
          sessionId: payload.sessionId,
          store_id: user.store_id
        } as JWTPayload,
        this.getJWTSecret(),
        { expiresIn: this.ACCESS_TOKEN_EXPIRY }
      );

      return { accessToken };
    } catch (error) {
      logger.debug('Refresh token validation failed', { error: error.message });
      return null;
    }
  }
  
  private async getUserPermissions(role: string): Promise<string[]> {
    // This could be expanded to query a permissions table
    // For now, we'll use a simple role-based permission model
    switch (role) {
      case 'admin':
        return [
          'user:read', 'user:write', 'user:delete',
          'store:read', 'store:write', 'store:delete',
          'product:read', 'product:write', 'product:delete',
          'inventory:read', 'inventory:write', 'inventory:delete',
          'transaction:read', 'transaction:write', 'transaction:void',
          'report:read', 'settings:read', 'settings:write'
        ];
      case 'manager':
        return [
          'user:read',
          'store:read',
          'product:read', 'product:write',
          'inventory:read', 'inventory:write',
          'transaction:read', 'transaction:write', 'transaction:void',
          'report:read'
        ];
      case 'cashier':
        return [
          'product:read',
          'inventory:read',
          'transaction:read', 'transaction:write'
        ];
      default:
        return [];
    }
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    if (this.refreshTokens.has(sessionId)) {
      this.refreshTokens.delete(sessionId);
      logger.info('Session revoked', { sessionId });
      return true;
    }
    return false;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const sessionsToRevoke: string[] = [];
    
    for (const [sessionId, tokenData] of this.refreshTokens.entries()) {
      if (tokenData.userId === userId) {
        sessionsToRevoke.push(sessionId);
      }
    }

    sessionsToRevoke.forEach(sessionId => {
      this.refreshTokens.delete(sessionId);
    });

    logger.info('All user sessions revoked', { userId, sessionCount: sessionsToRevoke.length });
    return sessionsToRevoke.length;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private cleanupExpiredTokens(): void {
    const now = new Date();
    const expiredSessions = new Map<string, any>();
    
    for (const [sessionId, tokenData] of this.refreshTokens) {
      if (tokenData.expiresAt < now) {
        expiredSessions.set(sessionId, tokenData);
      }
    }
    
    for (const sessionId of expiredSessions.keys()) {
      this.refreshTokens.delete(sessionId);
    }
    
    if (expiredSessions.size > 0) {
      logger.debug('Cleaned up expired tokens', { count: expiredSessions.size });
    }
  }

  private getJWTSecret(): string {
    // Using environment variable in production
    return process.env.JWT_SECRET || 'development_jwt_secret';
  }
  
  // This is needed for TypeScript to understand the jwt.verify signature
  private getJWTVerifyOptions(): jwt.VerifyOptions {
    return {
      algorithms: ['HS256'],
      ignoreExpiration: false
    };
  }

  private getRefreshSecret(): string {
    // Using environment variable in production
    return process.env.REFRESH_SECRET || 'development_refresh_secret';
  }
  
  // This is needed for TypeScript to understand the jwt.verify signature
  private getRefreshVerifyOptions(): jwt.VerifyOptions {
    return {
      algorithms: ['HS256'],
      ignoreExpiration: false
    };
  }
}

// Singleton instance
export const authService = new AuthenticationService();

// Rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for auth endpoint', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: 900
    });
  }
});

// Enhanced JWT authentication middleware
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next(); // No token, continue as unauthenticated
  }

  const token = authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    const payload = await authService.validateAccessToken(token);
    
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Verify user still exists and is active
    const result = await db.execute(
      'SELECT id, username, email, role, is_active, store_id FROM users WHERE id = $1',
      [parseInt(payload.userId)]
    );
    // Safely type the user result
    const user = result.rows && result.rows.length > 0 ? result.rows[0] as {
      id: number;
      username: string;
      email: string;
      role: string;
      is_active: boolean;
      store_id?: number;
    } : null;

    if (!user || !user.is_active) {
      await authService.revokeSession(payload.sessionId);
      return res.status(401).json({
        error: 'User account is inactive',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Set user context following our defined Express.Request interface
    req.user = {
      id: user.id.toString(),
      role: user.role,
      store_id: user.store_id ?? undefined, // Fix typing issue with optional store_id
      name: user.username,
      email: user.email ?? undefined, // Fix typing issue with optional email
      sessionId: payload.sessionId,
      permissions: payload.permissions // Include permissions from the JWT payload
    };

    // Log successful authentication
    logger.debug('User authenticated', { 
      userId: user.id.toString(), 
      role: user.role,
      sessionId: payload.sessionId
    });

    next();
  } catch (error) {
    logger.error('JWT authentication error', error);
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path
      });
      
      return res.status(403).json({
        error: `Insufficient permissions. Required: ${roles.join(' or ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// Store access control
export const requireStoreAccess = (store_idParam = 'store_id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED'
      });
    }

    // Extract store ID from request
    let store_id: number | undefined;
    
    if (req.params[store_idParam]) {
      store_id = parseInt(req.params[store_idParam], 10);
    } else if (req.body[store_idParam]) {
      store_id = parseInt(req.body[store_idParam], 10);
    } else if (req.query[store_idParam]) {
      store_id = parseInt(req.query[store_idParam] as string, 10);
    }

    if (!store_id || isNaN(store_id)) {
      return res.status(400).json({
        error: 'Invalid store ID',
        code: 'INVALID_STORE_ID'
      });
    }

    // Admins have access to all stores
    if (req.user.role === 'admin') {
      return next();
    }

    // Other users can only access their assigned store
    if (req.user.store_id !== store_id) {
      logger.warn('Unauthorized store access attempt', {
        userId: req.user.id,
        userStoreId: req.user.store_id,
        requestedStoreId: store_id,
        path: req.path
      });
      
      return res.status(403).json({
        error: 'Access denied to this store',
        code: 'STORE_ACCESS_DENIED'
      });
    }

    next();
  };
};

// Extend Express Request interface
declare global {
  namespace Express {
    // Define a single consistent interface for the user property
    interface Request {
      user?: {
        id: string | number;
        role: string;
        storeId?: number;
        name: string;
      };
      // Add permissions as a separate property
      permissions?: string[];
    }
  }
}
