import crypto from 'crypto';

import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import bcrypt from 'bcrypt';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

import {
  getLogger,
  SecurityLogger,
  SecurityEventType,
  SecuritySeverity,
} from '../../../src/logging/index';

const logger = getLogger().child({ component: 'unified-auth-service' });
// Create a security logger instance for auth-specific security events
const securityLogger = new SecurityLogger(logger);

// Core interfaces for consistent typing
export interface User {
  id: string;
  email: string;
  username?: string;
  password: string;
  role: 'admin' | 'manager' | 'cashier' | 'viewer';
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  storeId?: number;
  fullName?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
  storeId?: number; // Added storeId to match the User interface
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionData {
  userId: string;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Unified Authentication Service
 *
 * This service consolidates authentication logic and fixes SQL injection vulnerabilities.
 * It also adds proper token storage in Redis for persistence across restarts and scaling.
 */
export class UnifiedAuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly SALT_ROUNDS = 12;

  // Redis key prefixes for token storage
  private readonly TOKEN_PREFIX = 'token:'; // Redis key prefix for tokens
  private readonly SESSION_PREFIX = 'session:'; // Redis key prefix for sessions
  private readonly RESET_TOKEN_PREFIX = 'reset:'; // Redis key prefix for password reset tokens

  constructor(
    private db: unknown, // Use any to accommodate both Pool and Drizzle database types
    private redis: Redis,
    private jwtSecret = process.env.JWT_SECRET,
    private refreshSecret = process.env.JWT_REFRESH_SECRET
  ) {
    // Validate that secrets exist
    if (!this.jwtSecret || !this.refreshSecret) {
      const errorMsg = 'JWT_SECRET and JWT_REFRESH_SECRET must be provided in environment';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Hashes a password using bcrypt with appropriate salt rounds
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verifies a password against a hashed password
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generates a new pair of access and refresh tokens for a user
   */
  async generateTokenPair(
    user: User,
    metadata: { ipAddress?: string; userAgent?: string } = {}
  ): Promise<AuthTokens> {
    // Validate user is active
    if (!user.isActive) {
      throw new AppError(
        'User is not active',
        ErrorCategory.AUTHENTICATION,
        ErrorCode.UNAUTHORIZED,
        { reason: 'User account is inactive' }
      );
    }

    const sessionId = crypto.randomUUID();

    // Create access token payload
    const accessTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      sessionId,
    };

    // Sign access token
    const accessToken = jwt.sign(accessTokenPayload, this.jwtSecret!, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // Sign refresh token
    const refreshToken = jwt.sign({ userId: user.id, sessionId }, this.refreshSecret!, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });

    // Calculate expiration dates
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store session in Redis
    const sessionData: SessionData = {
      userId: user.id,
      lastActivity: new Date(),
      expiresAt: refreshExpiresAt,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    };

    // Store both the refresh token and session data in Redis
    try {
      // Store refresh token with expiration
      await this.redis.set(
        `${this.TOKEN_PREFIX}${sessionId}`,
        refreshToken,
        'EX',
        7 * 24 * 60 * 60 // 7 days in seconds
      );

      // Store session data with expiration
      await this.redis.set(
        `${this.SESSION_PREFIX}${sessionId}`,
        JSON.stringify(sessionData),
        'EX',
        7 * 24 * 60 * 60 // 7 days in seconds
      );
    } catch (error: unknown) {
      logger.error('Failed to store token in Redis', { error, userId: user.id });
      throw new AppError(
        'Failed to store token in Redis',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { redisError: (error as Error).message, reason: 'Redis connection error' },
        503 // Service Unavailable
      );
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  /**
   * Validates an access token and returns the decoded payload
   */
  async validateAccessToken(
    token: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<JWTPayload | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret!) as JWTPayload;

      // Update session activity timestamp
      const sessionKey = `${this.SESSION_PREFIX}${payload.sessionId}`;
      try {
        await this.redis.hset(sessionKey, 'lastActivity', Date.now().toString());
      } catch (error: unknown) {
        // Non-blocking error - we still want to validate the token
        logger.error('Failed to update session activity', { error, sessionId: payload.sessionId });
      }

      // Log successful token validation
      securityLogger.logAuthentication(
        'Access token validated',
        'SUCCESS',
        SecuritySeverity.INFORMATIONAL,
        {
          userId: payload.userId,
          sessionId: payload.sessionId,
          ip: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        }
      );

      return payload;
    } catch (error: unknown) {
      // Log failed token validation
      securityLogger.logAuthentication('Invalid access token', 'FAILURE', SecuritySeverity.MEDIUM, {
        ip: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        reason: (error as Error).message || 'token_validation_failed',
      });
      return null;
    }
  }

  /**
   * Refreshes an access token using a refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuthTokens | null> {
    try {
      const payload = jwt.verify(refreshToken, this.refreshSecret!) as {
        userId: string;
        sessionId: string;
      };

      // Check if refresh token is valid in Redis
      const sessionKey = `${this.SESSION_PREFIX}${payload.sessionId}`;
      const storedToken = await this.redis.get(`${this.TOKEN_PREFIX}${payload.sessionId}`);

      // Verify the token matches and session exists
      const sessionExists = storedToken === refreshToken;

      if (!sessionExists) {
        // Log invalid refresh token attempt
        securityLogger.logAuthentication(
          'Invalid refresh token - session not found',
          'FAILURE',
          SecuritySeverity.MEDIUM,
          {
            userId: payload.userId,
            sessionId: payload.sessionId,
            ip: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
            reason: 'session_not_found',
          }
        );
        return null;
      }

      // Get the user data
      const user = await this.getUserById(payload.userId);
      if (!user || !user.isActive) {
        logger.warn('Refresh token used for inactive/nonexistent user', { userId: payload.userId });
        return null;
      }

      // Generate new token pair
      return this.generateTokenPair(user);
    } catch (error: unknown) {
      logger.error('Error refreshing token', { error });
      return null;
    }
  }

  /**
   * Checks if a user is active
   */
  async isUserActive(userId: string): Promise<boolean> {
    try {
      // Use parameterized query to prevent SQL injection
      const query = 'SELECT is_active FROM users WHERE id = $1';
      const result = await (this.db as any).execute(query, [userId]);

      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].is_active === true;
    } catch (error) {
      logger.error('Error checking user active status', {
        error: (error as Error).message,
        userId,
      });
      return false;
    }
  }

  /**
   * Gets a user by email with SQL injection protection
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      // Parameterized query to prevent SQL injection
      const query = `
        SELECT 
          id, email, username, password, role, full_name as "fullName",
          is_active as "isActive", last_login as "lastLogin", 
          failed_login_attempts as "failedLoginAttempts", 
          locked_until as "lockedUntil", store_id as "storeId"
        FROM users 
        WHERE email = $1
      `;

      const result = await (this.db as any).execute(query, [email]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      // Get permissions based on role
      const permissions = this.getPermissionsByRole(row.role);

      return {
        id: row.id,
        email: row.email,
        username: row.username,
        password: row.password,
        role: row.role,
        fullName: row.fullName,
        permissions,
        isActive: row.isActive,
        lastLogin: row.lastLogin,
        failedLoginAttempts: row.failedLoginAttempts || 0,
        lockedUntil: row.lockedUntil,
        storeId: row.storeId,
      };
    } catch (error) {
      logger.error('Error getting user by email', { error: (error as Error).message, email });
      return null;
    }
  }

  /**
   * Gets a user by ID with SQL injection protection
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      // Parameterized query to prevent SQL injection
      const query = `
        SELECT 
          id, email, username, password, role, full_name as "fullName",
          is_active as "isActive", last_login as "lastLogin", 
          failed_login_attempts as "failedLoginAttempts", 
          locked_until as "lockedUntil", store_id as "storeId"
        FROM users 
        WHERE id = $1
      `;

      const result = await (this.db as any).execute(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      // Get permissions based on role
      const permissions = this.getPermissionsByRole(row.role);

      return {
        id: row.id,
        email: row.email,
        username: row.username,
        password: row.password,
        role: row.role,
        fullName: row.fullName,
        permissions,
        isActive: row.isActive,
        lastLogin: row.lastLogin,
        failedLoginAttempts: row.failedLoginAttempts || 0,
        lockedUntil: row.lockedUntil,
        storeId: row.storeId,
      };
    } catch (error) {
      logger.error('Error getting user by ID', { error: (error as Error).message, userId });
      return null;
    }
  }

  /**
   * Maps role names to permissions
   */
  private getPermissionsByRole(role: string): string[] {
    switch (role) {
      case 'admin':
        return [
          'user:read',
          'user:write',
          'user:delete',
          'store:read',
          'store:write',
          'store:delete',
          'product:read',
          'product:write',
          'product:delete',
          'inventory:read',
          'inventory:write',
          'inventory:delete',
          'transaction:read',
          'transaction:write',
          'transaction:void',
          'report:read',
          'settings:read',
          'settings:write',
        ];
      case 'manager':
        return [
          'user:read',
          'store:read',
          'product:read',
          'product:write',
          'inventory:read',
          'inventory:write',
          'transaction:read',
          'transaction:write',
          'transaction:void',
          'report:read',
        ];
      case 'cashier':
        return ['product:read', 'inventory:read', 'transaction:read', 'transaction:write'];
      case 'viewer':
        return ['product:read', 'inventory:read', 'transaction:read', 'report:read'];
      default:
        return [];
    }
  }

  /**
   * Logs a user in with email and password
   */
  async login(
    email: string,
    password: string,
    metadata: { ipAddress?: string; userAgent?: string } = {}
  ): Promise<{ user: User; tokens: AuthTokens } | null> {
    // Log the login attempt with security logger
    securityLogger.logAuthentication(
      'Login attempt initiated',
      'SUCCESS', // We log the attempt itself as successful, not the outcome
      SecuritySeverity.INFORMATIONAL,
      {
        userId: 'unknown', // Will be updated if user is found
        email,
        ip: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      }
    );

    const user = await this.getUserByEmail(email);

    if (!user) {
      // Log failed login due to unknown user
      securityLogger.logAuthentication(
        'Login failed - user not found',
        'FAILURE',
        SecuritySeverity.MEDIUM,
        {
          email,
          ip: metadata.ipAddress,
          userAgent: metadata.userAgent,
          reason: 'user_not_found',
        }
      );
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Log locked account access attempt
      securityLogger.logAuthentication(
        'Login attempt on locked account',
        'FAILURE',
        SecuritySeverity.HIGH,
        {
          userId: user.id,
          email: user.email,
          ip: metadata.ipAddress,
          userAgent: metadata.userAgent,
          reason: 'account_locked',
          lockedUntil: user.lockedUntil,
        }
      );

      throw new AppError('Invalid refresh token', ErrorCategory.AUTHENTICATION, ErrorCode.LOCKED, {
        lockedUntil: user.lockedUntil,
        reason: 'Account is temporarily locked',
      });
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.password);

    if (!isValidPassword) {
      // Log failed login due to invalid password
      securityLogger.logAuthentication(
        'Login failed - invalid password',
        'FAILURE',
        SecuritySeverity.MEDIUM,
        {
          userId: user.id,
          email: user.email,
          ip: metadata.ipAddress,
          userAgent: metadata.userAgent,
          reason: 'invalid_password',
          failedAttempts: (user.failedLoginAttempts || 0) + 1,
        }
      );

      await this.handleFailedLogin(user.id);
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      // Log login attempt on inactive account
      securityLogger.logAuthentication(
        'Login attempt on inactive account',
        'FAILURE',
        SecuritySeverity.MEDIUM,
        {
          userId: user.id,
          email: user.email,
          ip: metadata.ipAddress,
          userAgent: metadata.userAgent,
          reason: 'account_inactive',
        }
      );

      throw new AppError(
        'User not found or token mismatch',
        ErrorCategory.AUTHENTICATION,
        ErrorCode.UNAUTHORIZED,
        { reason: 'Account is deactivated' }
      );
    }

    // Reset failed login attempts on successful login
    await this.resetFailedLoginAttempts(user.id);

    // Update last login
    await this.updateLastLogin(user.id, metadata.ipAddress);

    // Generate token pair
    const tokens = await this.generateTokenPair(user, metadata);

    // Log successful login
    securityLogger.logAuthentication(
      'Login successful',
      'SUCCESS',
      SecuritySeverity.INFORMATIONAL,
      {
        userId: user.id,
        email: user.email,
        ip: metadata.ipAddress,
        userAgent: metadata.userAgent,
        role: user.role,
      }
    );

    return { user, tokens };
  }

  /**
   * Logs out a user by invalidating their session
   */
  async logout(sessionId: string): Promise<void> {
    try {
      // Remove token and session from Redis
      await this.redis.del(`${this.TOKEN_PREFIX}${sessionId}`);
      await this.redis.del(`${this.SESSION_PREFIX}${sessionId}`);
    } catch (error) {
      logger.error('Error during logout', { error: (error as Error).message, sessionId });
      // Non-blocking error - we consider the user logged out anyway
    }
  }

  /**
   * Logs out all sessions for a user
   */
  async logoutAllSessions(userId: string): Promise<void> {
    try {
      // Get all sessions from Redis
      const sessionKeys = await this.redis.keys(`${this.SESSION_PREFIX}*`);

      // Check each session to see if it belongs to the user
      for (const key of sessionKeys) {
        try {
          const sessionData = await this.redis.get(key);
          if (sessionData) {
            const session = JSON.parse(sessionData) as SessionData;

            if (session.userId === userId) {
              // Extract sessionId from key
              const sessionId = key.substring(this.SESSION_PREFIX.length);

              // Delete token and session
              await this.redis.del(`${this.TOKEN_PREFIX}${sessionId}`);
              await this.redis.del(key);
            }
          }
        } catch (error) {
          logger.error('Error processing session during logout all', {
            error: (error as Error).message,
            key,
          });
          // Continue with other sessions
        }
      }
    } catch (error) {
      logger.error('Error during logout all sessions', { error: (error as Error).message, userId });
      throw new AppError(
        'Error during logout all sessions',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { reason: 'Failed to log out all sessions' }
      );
    }
  }

  /**
   * Handles a failed login attempt
   */
  private async handleFailedLogin(
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      // Get current failed attempts to determine if account will be locked
      const userQuery = `
        SELECT failed_login_attempts 
        FROM users 
        WHERE id = $1
      `;

      const userResult = await (this.db as any).execute(userQuery, [userId]);
      const currentFailedAttempts = userResult.rows[0]?.failed_login_attempts || 0;
      const willLockAccount = currentFailedAttempts + 1 >= 5;

      // Use parameterized query to prevent SQL injection
      const updateQuery = `
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE 
              WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
              ELSE locked_until
            END
        WHERE id = $1
        RETURNING failed_login_attempts, locked_until
      `;

      const result = await (this.db as any).execute(updateQuery, [userId]);
      const newFailedAttempts = result.rows[0]?.failed_login_attempts;
      const lockedUntil = result.rows[0]?.locked_until;

      // Log account lockout if threshold reached
      if (willLockAccount) {
        securityLogger.logAuthentication(
          'Account locked due to too many failed login attempts',
          'FAILURE',
          SecuritySeverity.HIGH,
          {
            userId,
            ip: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
            failedAttempts: newFailedAttempts,
            lockedUntil: lockedUntil,
            reason: 'max_failed_attempts',
          }
        );
      }
    } catch (error) {
      logger.error('Error handling failed login', { error: (error as Error).message, userId });
      // Non-blocking - we'll still return null for the login attempt
    }
  }

  /**
   * Resets failed login attempts for a user
   */
  private async resetFailedLoginAttempts(
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      // First check if user was locked
      const userQuery = `
        SELECT failed_login_attempts, locked_until 
        FROM users 
        WHERE id = $1
      `;

      const userResult = await (this.db as any).execute(userQuery, [userId]);
      const wasLocked =
        userResult.rows[0]?.locked_until && new Date(userResult.rows[0].locked_until) > new Date();
      const previousFailedAttempts = userResult.rows[0]?.failed_login_attempts || 0;

      // Use parameterized query to prevent SQL injection
      const query = `
        UPDATE users 
        SET failed_login_attempts = 0,
            locked_until = NULL
        WHERE id = $1
      `;

      await (this.db as any).execute(query, [userId]);

      // Log account unlock if it was previously locked
      if (wasLocked) {
        securityLogger.logAuthentication(
          'Account unlocked after successful authentication',
          'SUCCESS',
          SecuritySeverity.MEDIUM,
          {
            userId,
            ip: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
            previousFailedAttempts,
          }
        );
      }
    } catch (error) {
      logger.error('Error resetting failed login attempts', {
        error: (error as Error).message,
        userId,
      });
      // Non-blocking - user can still log in
    }
  }

  /**
   * Updates last login timestamp for a user
   */
  private async updateLastLogin(userId: string, ipAddress?: string): Promise<void> {
    try {
      // Use parameterized query to prevent SQL injection
      const query = `
        UPDATE users 
        SET last_login = NOW(), last_login_ip = $2
        WHERE id = $1
      `;

      await (this.db as any).execute(query, [userId, ipAddress || null]);
    } catch (error) {
      logger.error('Error updating last login', { error: (error as Error).message, userId });
      // Non-blocking - user can still log in
    }
  }

  /**
   * Permission checking utilities
   */
  /**
   * Check if a user has a specific permission
   *
   * @param user The user or user role to check
   * @param permission The permission to check for
   * @returns True if the user has the permission
   */
  hasPermission(
    user: JWTPayload | { role: string; permissions?: string[] } | User,
    permission: string
  ): boolean {
    // If user is admin, they have all permissions
    if (user.role === 'admin') {
      return true;
    }

    // Check if the user has the specific permission
    const permissions =
      'permissions' in user && Array.isArray(user.permissions) ? user.permissions : [];

    return permissions.includes(permission);
  }

  /**
   * Check if a user has one of the specified roles
   *
   * @param userOrRole The user object or just the role string
   * @param roles The roles to check against
   * @returns True if the user has one of the specified roles
   */
  hasRole(userOrRole: JWTPayload | { role: string } | string, roles: string[]): boolean {
    const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;

    return roles.includes(role);
  }

  canAccessResource(user: JWTPayload, resource: string, action: string): boolean {
    const permission = `${resource}:${action}`;
    return this.hasPermission(user, permission);
  }

  /**
   * Generate a secure password reset token
   *
   * @param userId User ID to generate token for
   * @returns The generated reset token
   */
  async generateResetToken(userId: string): Promise<string> {
    try {
      // Generate a secure random token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Set expiration time (1 hour from now)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Store the token in Redis with expiration
      await this.redis.set(
        `${this.RESET_TOKEN_PREFIX}${hashedToken}`,
        userId,
        'EX',
        3600 // 1 hour in seconds
      );

      // Log token generation (without the actual token)
      logger.info('Generated password reset token', { userId });

      return resetToken;
    } catch (error) {
      logger.error('Error generating reset token', { error: (error as Error).message, userId });
      throw new AppError(
        'Error generating reset token',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { reason: 'Failed to generate password reset token' }
      );
    }
  }

  /**
   * Validate a password reset token
   *
   * @param token The token to validate
   * @returns The user ID if valid, null otherwise
   */
  async validateResetToken(token: string): Promise<string | null> {
    try {
      // Hash the token for comparison
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Get the token from Redis
      const userId = await this.redis.get(`${this.RESET_TOKEN_PREFIX}${hashedToken}`);

      if (!userId) {
        logger.warn('Invalid or expired reset token used');
        return null;
      }

      // Delete the token so it can't be used again (one-time use)
      await this.redis.del(`${this.RESET_TOKEN_PREFIX}${hashedToken}`);

      return userId;
    } catch (error) {
      logger.error('Error validating reset token', { error: (error as Error).message });
      return null;
    }
  }
}
