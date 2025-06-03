import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { db } from '../../db';
import crypto from 'crypto';
import Redis from 'ioredis';
import { getRedisClient, initRedis } from '../../src/cache/redis';
import { UserPayload } from '../types/user'; // Corrected: Import UserPayload from ../types/user
// Removed incorrect import: import { UserPayload } from '../types/express'; 
import { sql } from 'drizzle-orm';
import { getLogger } from '../../src/logging'; // Import actual logger

const logger = getLogger().child({ component: 'auth-enhanced' }); // Use actual logger

// AppError and ErrorCode are now imported from the shared location
import { AppError, ErrorCode as SharedErrorCode, ErrorCategory } from '../../shared/types/errors';

// Define a type for the user object passed to generateTokenPair
interface UserForTokenGeneration {
  id: string | number;
  role: string;
  permissions?: string[];
  store_id?: number;
  username?: string;
}

// Local ErrorCode enum removed, use SharedErrorCode from shared/types/errors.ts
// Ensure that any usage of the local ErrorCode (e.g. ErrorCode.INVALID_TOKEN)
// is updated to use SharedErrorCode (e.g. SharedErrorCode.INVALID_TOKEN).
// The specific codes used here (INVALID_TOKEN, USER_NOT_FOUND, UNAUTHORIZED, ACCESS_DENIED)
// already exist in the shared ErrorCode enum or have equivalents (FORBIDDEN for ACCESS_DENIED).

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
  private redis: Redis | null;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly SALT_ROUNDS = 12;
  
  // Redis key prefixes for token storage
  private readonly TOKEN_PREFIX = 'auth:token:';
  private readonly SESSION_PREFIX = 'auth:session:';
  
  constructor() {
    // Initialize Redis client
    this.redis = getRedisClient();
    
    // If Redis client is not available, initialize it
    if (!this.redis) {
      this.redis = initRedis();
      
      if (!this.redis) {
        logger.warn('Redis client not available. Using fallback in-memory storage. This is NOT recommended for production!');
      } else {
        logger.info('Redis client initialized for token storage');
      }
    }
  }

  async generateTokenPair(user: UserForTokenGeneration): Promise<{ accessToken: string; refreshToken: string }> {
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

    try {
      // Store session data in Redis
      if (this.redis) {
        // Store token with expiration (7 days in seconds)
        const expirySeconds = 7 * 24 * 60 * 60; // 7 days
        
        // Store the token itself
        await this.redis.set(
          `${this.TOKEN_PREFIX}${sessionId}`,
          refreshToken,
          'EX',
          expirySeconds
        );
        
        // Store session metadata
        const sessionData = {
          userId: user.id.toString(),
          expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          role: user.role,
          username: user.username || 'unknown'
        };
        
        await this.redis.set(
          `${this.SESSION_PREFIX}${sessionId}`,
          JSON.stringify(sessionData),
          'EX',
          expirySeconds
        );
        
        logger.debug('Stored session in Redis', { sessionId });
      } else {
        // Redis not available - log warning
        logger.warn('Redis unavailable for token storage', { sessionId });
      }
    } catch (error: unknown) {
      logger.error('Failed to store token in Redis', { error, sessionId });
    }

    return { accessToken, refreshToken };
  }

  async validateAccessToken(token: string): Promise<JWTPayload | null> {
    try {
      // Using a more explicit approach with options parameter to fix TypeScript error
      const payload = jwt.verify(token, this.getJWTSecret(), this.getJWTVerifyOptions()) as JWTPayload;
      
      // Verify session still exists in Redis
      if (this.redis) {
        const sessionKey = `${this.SESSION_PREFIX}${payload.sessionId}`;
        const sessionExists = await this.redis.exists(sessionKey);
        
        if (!sessionExists) {
          logger.warn('Access token used with invalid session', { sessionId: payload.sessionId });
          return null;
        }
        
        // Update session last activity time
        const sessionData = await this.redis.get(sessionKey);
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData);
            session.lastActivity = new Date().toISOString();
            
            // Update session with new last activity time but keep original expiry
            const ttl = await this.redis.ttl(sessionKey);
            if (ttl > 0) {
              await this.redis.set(sessionKey, JSON.stringify(session), 'EX', ttl);
            }
          } catch (e: unknown) {
            logger.error('Error updating session activity', { error: e, sessionId: payload.sessionId });
          }
        }
      } else {
        // Redis not available - can't validate session
        logger.warn('Redis unavailable for token validation', { sessionId: payload.sessionId });
        return null;
      }

      return payload;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.debug('Access token validation failed', { error: errorMessage });
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
      // Using a more explicit approach with options parameter to fix TypeScript error
      const payload = jwt.verify(refreshToken, this.getRefreshSecret(), this.getRefreshVerifyOptions()) as RefreshTokenPayload;
      
      // Verify token in Redis
      if (!this.redis) {
        logger.warn('Redis unavailable for token refresh', { sessionId: payload.sessionId });
        return null;
      }
      
      // Check if token exists and matches
      const tokenKey = `${this.TOKEN_PREFIX}${payload.sessionId}`;
      const storedToken = await this.redis.get(tokenKey);
      
      if (!storedToken || storedToken !== refreshToken) {
        logger.warn('Invalid refresh token attempt', { sessionId: payload.sessionId });
        return null;
      }
      
      // Get session data
      const sessionKey = `${this.SESSION_PREFIX}${payload.sessionId}`;
      const sessionData = await this.redis.get(sessionKey);
      
      if (!sessionData) {
        logger.warn('Session not found during token refresh', { sessionId: payload.sessionId });
        return null;
      }
      
      // Parse session data
      let session;
      try {
        session = JSON.parse(sessionData);
        
        // Check if session has expired (shouldn't happen with Redis TTL, but just in case)
        const expiresAt = new Date(session.expiresAt);
        if (expiresAt < new Date()) {
          logger.warn('Expired session used for token refresh', { sessionId: payload.sessionId });
          await this.redis.del(tokenKey, sessionKey);
          return null;
        }
        
        // Verify user ID matches
        if (session.userId !== payload.userId) {
          logger.warn('User ID mismatch during token refresh', { 
            sessionId: payload.sessionId,
            tokenUserId: payload.userId,
            sessionUserId: session.userId 
          });
          return null;
        }
      } catch (e: unknown) {
        logger.error('Error parsing session data', { error: e, sessionId: payload.sessionId });
        return null;
      }

      // Get current user data using parameterized SQL to avoid injection
      const userId = parseInt(payload.userId);
      
      // Use a simplified approach to get user data to fix TypeScript issues
      let userData = null;
      try {
        // Helper function to safely convert values to strings for SQL queries
        const safeToString = (value: unknown): string => {
          if (value === null || value === undefined) return '';
          return String(value).replace(/'/g, "''"); // Escape single quotes
        };
        
        // Use parameterized query with sql template literal for safety
        const result = await db.execute(
          sql`SELECT id, username, email, role, is_active, store_id 
              FROM users 
              WHERE id = ${safeToString(userId)} AND is_active = true`
        );
        
        if (result.rows && result.rows.length > 0) {
          userData = result.rows[0];
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error); // Corrected: error.message
        logger.error('Error getting user data', { 
          error: errorMessage, 
          userId
        });
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.debug('Refresh token validation failed', { 
        error: errorMessage
      });
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
    try {
      if (this.redis) {
        const tokenKey = `${this.TOKEN_PREFIX}${sessionId}`;
        const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
        
        // Delete both token and session data
        const tokenResult = await this.redis.del(tokenKey);
        const sessionResult = await this.redis.del(sessionKey);
        
        const success = tokenResult > 0 || sessionResult > 0;
        
        if (success) {
          logger.info('Session revoked', { sessionId });
          return true;
        } else {
          logger.warn('Session not found for revocation', { sessionId });
          return false;
        }
      } else {
        logger.warn('Redis unavailable for session revocation', { sessionId });
        return false;
      }
    } catch (error: unknown) {
      logger.error('Error revoking session', { error, sessionId });
      return false;
    }
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      if (!this.redis) {
        logger.warn('Redis unavailable for session revocation', { userId });
        return 0;
      }
      
      // We need to scan all sessions to find those belonging to the user
      const sessionsToRevoke: string[] = [];
      let cursor = '0';
      
      do {
        // Scan for session keys
        // The Redis scan command returns a tuple of [nextCursor, keys]
    const scanResult = await this.redis.scan(
          cursor, 
          'MATCH', 
          `${this.SESSION_PREFIX}*`,
          'COUNT',
          '100'
        );
        
    const nextCursor = scanResult[0];
    const keys = scanResult[1];
        
        cursor = nextCursor;
        
        // Check each session
        for (const sessionKey of keys) {
          const sessionData = await this.redis.get(sessionKey);
          
          if (sessionData) {
            try {
              const session = JSON.parse(sessionData);
              
              if (session.userId === userId) {
                // Extract session ID from key
                const sessionId = sessionKey.substring(this.SESSION_PREFIX.length);
                sessionsToRevoke.push(sessionId);
              }
            } catch (e: unknown) {
              logger.error('Error parsing session data', { error: e, sessionKey });
            }
          }
        }
      } while (cursor !== '0');
      
      // Revoke all sessions found
      let revokedCount = 0;
      
      for (const sessionId of sessionsToRevoke) {
        const tokenKey = `${this.TOKEN_PREFIX}${sessionId}`;
        const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
        
        await this.redis.del(tokenKey, sessionKey);
        revokedCount++;
      }
      
      logger.info('All user sessions revoked', { userId, sessionCount: revokedCount });
      return revokedCount;
    } catch (error: unknown) {
      logger.error('Error revoking all user sessions', { error, userId });
      return 0;
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Cleanup is no longer needed as Redis handles expiration automatically
  // This method is kept for backward compatibility but does nothing
  private cleanupExpiredTokens(): void {
    // Redis handles expiration automatically using the EX parameter
    // when storing keys, so no manual cleanup is required
    logger.debug('Token cleanup skipped - Redis handles expiration automatically');
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
    // Consider using AppError for structured errors
    return res.status(401).json({
      error: 'Access token required',
      code: SharedErrorCode.UNAUTHORIZED // Or a more specific MISSING_TOKEN if added
    });
  }

  try {
    const payload = await authService.validateAccessToken(token);
    
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: SharedErrorCode.INVALID_TOKEN
      });
    }

    // Verify user still exists and is active
    // Use SQL template literal to fix TypeScript errors
    const result = await db.execute(
      sql`SELECT id, username, email, role, is_active, store_id 
          FROM users 
          WHERE id = ${parseInt(payload.userId)}`
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
        code: SharedErrorCode.USER_NOT_FOUND // Or a specific ACCOUNT_INACTIVE if added
      });
    }

    // Set user context following our centralized UserPayload interface
    const authenticatedUserPayload: UserPayload = {
      id: user.id.toString(),
      role: user.role,
      storeId: user.store_id ?? undefined,
      name: user.username, 
      email: user.email, 
      username: user.username, 
    };
    req.user = authenticatedUserPayload as any; // Cast to any to assign to Express.Request.user


    // Log successful authentication
    logger.debug('User authenticated', { 
      userId: user.id.toString(), 
      role: user.role,
      sessionId: payload.sessionId
    });

    next();
  } catch (error: unknown) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    logger.error('JWT authentication error', errorToLog);
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR' // Consider using SharedErrorCode here if applicable
    });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: SharedErrorCode.UNAUTHORIZED // Or a specific UNAUTHENTICATED if added
      });
    }

    if (!roles.includes((req.user as UserPayload).role)) { // Cast req.user
      logger.warn('Insufficient permissions', {
        userId: (req.user as UserPayload).id, // Cast req.user
        userRole: (req.user as UserPayload).role, // Cast req.user
        requiredRoles: roles,
        path: req.path
      });
      
      return res.status(403).json({
        error: `Insufficient permissions. Required: ${roles.join(' or ')}`,
        code: SharedErrorCode.FORBIDDEN // Or a specific INSUFFICIENT_PERMISSIONS if added
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
        code: SharedErrorCode.UNAUTHORIZED // Or a specific UNAUTHENTICATED if added
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
        code: SharedErrorCode.BAD_REQUEST // Or a specific INVALID_STORE_ID if added
      });
    }

    // Admins have access to all stores
    if ((req.user as UserPayload).role === 'admin') { // Cast req.user
      return next();
    }

    // Other users can only access their assigned store
    if ((req.user as UserPayload).storeId !== store_id) { // Cast req.user
      logger.warn('User tried to access unauthorized store', {
        userId: (req.user as UserPayload).id, // Cast req.user
        userStoreId: (req.user as UserPayload).storeId, // Cast req.user
        requestedStoreId: store_id,
        path: req.path
      });
      
      return res.status(403).json({
        error: 'Access denied to this store',
        code: SharedErrorCode.FORBIDDEN // Or a specific STORE_ACCESS_DENIED if added
      });
    }

    next();
  };
};

// No need to extend Express Request interface here
// It's now centralized in server/types/express.d.ts
