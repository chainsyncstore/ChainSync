/**
 * Standardized Authentication Service
 * 
 * This implementation follows the standard service pattern and 
 * provides authentication functionality with Redis-based token storage.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import Redis from 'ioredis';
import { eq } from 'drizzle-orm';

import { BaseService, ServiceError, ServiceConfig } from '../base/standard-service';
import { users } from '@shared/db/users';
import { ErrorCode, ErrorCategory } from '@shared/types/errors';
import { SecurityLogger, SecurityEventType } from '@src/logging';

// Schema definitions for input validation
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).optional(),
  fullName: z.string().min(1),
  role: z.enum(['admin', 'manager', 'cashier', 'viewer']).default('cashier'),
  storeId: z.number().optional(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

const changePasswordSchema = z.object({
  userId: z.string(),
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

// Type definitions
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
  storeId?: number;
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

export interface LoginParams {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterParams {
  email: string;
  password: string;
  username?: string;
  fullName: string;
  role?: 'admin' | 'manager' | 'cashier' | 'viewer';
  storeId?: number;
}

export interface ResetPasswordParams {
  token: string;
  password: string;
}

export interface ChangePasswordParams {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

/**
 * Standardized Authentication Service implementation
 */
export class AuthService extends BaseService<User, RegisterParams, Partial<User>> {
  protected readonly entityName = 'user';
  protected readonly tableName = 'users';
  protected readonly primaryKeyField = 'id';
  protected readonly createSchema = registerSchema;
  protected readonly updateSchema = z.object({
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    fullName: z.string().min(1).optional(),
    role: z.enum(['admin', 'manager', 'cashier', 'viewer']).optional(),
    isActive: z.boolean().optional(),
    storeId: z.number().optional(),
  });

  private readonly redis: Redis;
  private readonly securityLogger: SecurityLogger;
  private readonly saltRounds = 12;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';
  
  // Redis key prefixes for token storage
  private readonly tokenPrefix = 'auth:token:';
  private readonly sessionPrefix = 'auth:session:';
  private readonly resetTokenPrefix = 'auth:reset:';
  
  constructor(
    config: ServiceConfig & { 
      redis: Redis;
      jwtSecret?: string;
      refreshSecret?: string;
    }
  ) {
    super(config);
    this.redis = config.redis;
    this.securityLogger = new SecurityLogger(this.logger);
    
    // Validate that JWT secrets exist
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      const errorMsg = 'JWT_SECRET and JWT_REFRESH_SECRET must be provided in environment';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
  
  /**
   * Authenticate a user and generate tokens
   */
  async login(params: LoginParams): Promise<AuthTokens> {
    try {
      // Validate input
      const validatedInput = loginSchema.parse(params);
      const { email, password, ipAddress, userAgent } = validatedInput;
      
      // Find user by email
      const user = await this.findUserByEmail(email);
      
      if (!user) {
        this.securityLogger.log(
          SecurityEventType.FAILED_LOGIN,
          'User not found',
          { email, ipAddress },
          SecurityEventType.MEDIUM
        );
        
        throw new ServiceError(
          ErrorCode.AUTHENTICATION_FAILED,
          'Invalid email or password',
          { email },
          false
        );
      }
      
      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        this.securityLogger.log(
          SecurityEventType.ACCOUNT_LOCKED,
          'Attempted login to locked account',
          { userId: user.id, email, ipAddress },
          SecurityEventType.HIGH
        );
        
        const waitMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        
        throw new ServiceError(
          ErrorCode.ACCOUNT_LOCKED,
          `Account is locked. Please try again in ${waitMinutes} minutes`,
          { email, lockedUntil: user.lockedUntil },
          false
        );
      }
      
      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.password);
      
      if (!isPasswordValid) {
        // Increment failed login attempts
        await this.handleFailedLogin(user, ipAddress);
        
        throw new ServiceError(
          ErrorCode.AUTHENTICATION_FAILED,
          'Invalid email or password',
          { email },
          false
        );
      }
      
      // Reset failed login attempts on successful login
      if (user.failedLoginAttempts > 0) {
        await this.resetFailedLoginAttempts(user.id);
      }
      
      // Update last login timestamp
      await this.updateLastLogin(user.id);
      
      // Generate tokens
      const tokens = await this.generateTokenPair(user, { ipAddress, userAgent });
      
      this.securityLogger.log(
        SecurityEventType.SUCCESSFUL_LOGIN,
        'User logged in successfully',
        { userId: user.id, email, ipAddress },
        SecurityEventType.LOW
      );
      
      return tokens;
    } catch (error) {
      return this.handleError(error, 'Login failed');
    }
  }
  
  /**
   * Register a new user
   */
  async register(params: RegisterParams): Promise<User> {
    try {
      // Validate input
      const validatedInput = registerSchema.parse(params);
      
      // Check if user already exists
      const existingUser = await this.findUserByEmail(validatedInput.email);
      
      if (existingUser) {
        throw new ServiceError(
          ErrorCode.DUPLICATE_ENTRY,
          'User with this email already exists',
          { email: validatedInput.email },
          false
        );
      }
      
      // Hash password
      const hashedPassword = await this.hashPassword(validatedInput.password);
      
      // Create user
      const result = await this.executeQuery(
        async (db) => {
          return db.insert(users).values({
            email: validatedInput.email,
            password: hashedPassword,
            username: validatedInput.username,
            fullName: validatedInput.fullName,
            role: validatedInput.role || 'cashier',
            storeId: validatedInput.storeId,
            isActive: true,
            failedLoginAttempts: 0,
            createdAt: new Date()
          }).returning();
        },
        'user.register'
      );
      
      const user = result[0];
      
      if (!user) {
        throw new ServiceError(
          ErrorCode.DATABASE_ERROR,
          'Failed to create user',
          { email: validatedInput.email },
          false
        );
      }
      
      // Log security event
      this.securityLogger.log(
        SecurityEventType.USER_CREATED,
        'New user registered',
        { userId: user.id, email: user.email },
        SecurityEventType.MEDIUM
      );
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      return { ...userWithoutPassword, password: '[REDACTED]' } as User;
    } catch (error) {
      return this.handleError(error, 'User registration failed');
    }
  }
  
  /**
   * Validate an access token
   */
  async validateToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      // Check if session is still active
      const sessionKey = `${this.sessionPrefix}${payload.sessionId}`;
      const sessionData = await this.redis.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }
      
      const session = JSON.parse(sessionData) as SessionData;
      
      if (session.userId !== payload.userId) {
        return null;
      }
      
      // Update last activity
      const now = new Date();
      session.lastActivity = now;
      await this.redis.set(
        sessionKey,
        JSON.stringify(session),
        'EX',
        7 * 24 * 60 * 60 // 7 days in seconds
      );
      
      return payload;
    } catch (error) {
      this.logger.debug('Token validation failed', { error });
      return null;
    }
  }
  
  /**
   * Refresh an access token using a refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      
      // Check if refresh token exists in Redis
      const tokenKey = `${this.tokenPrefix}${payload.sessionId}`;
      const storedToken = await this.redis.get(tokenKey);
      
      if (!storedToken || storedToken !== refreshToken) {
        return null;
      }
      
      // Check if session exists
      const sessionKey = `${this.sessionPrefix}${payload.sessionId}`;
      const sessionData = await this.redis.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }
      
      const session = JSON.parse(sessionData) as SessionData;
      
      if (session.userId !== payload.userId) {
        return null;
      }
      
      // Get user data
      const user = await this.getById(payload.userId);
      
      if (!user || !user.isActive) {
        return null;
      }
      
      // Generate new tokens
      const metadata = {
        ipAddress: session.ipAddress,
        userAgent: session.userAgent
      };
      
      return this.generateTokenPair(user, metadata);
    } catch (error) {
      this.logger.debug('Token refresh failed', { error });
      return null;
    }
  }
  
  /**
   * Logout a user by invalidating their tokens
   */
  async logout(sessionId: string): Promise<boolean> {
    try {
      // Get session data for logging
      const sessionKey = `${this.sessionPrefix}${sessionId}`;
      const sessionData = await this.redis.get(sessionKey);
      
      // Delete token and session
      const tokenKey = `${this.tokenPrefix}${sessionId}`;
      await this.redis.del(tokenKey);
      await this.redis.del(sessionKey);
      
      if (sessionData) {
        const session = JSON.parse(sessionData) as SessionData;
        
        this.securityLogger.log(
          SecurityEventType.LOGOUT,
          'User logged out',
          { userId: session.userId, sessionId },
          SecurityEventType.LOW
        );
      }
      
      return true;
    } catch (error) {
      this.logger.error('Logout failed', { error, sessionId });
      return false;
    }
  }
  
  /**
   * Request a password reset for a user
   */
  async requestPasswordReset(email: string): Promise<string | null> {
    try {
      // Find user by email
      const user = await this.findUserByEmail(email);
      
      if (!user) {
        this.logger.info('Password reset requested for non-existent email', { email });
        return null;
      }
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Store token in Redis with expiration (1 hour)
      const resetKey = `${this.resetTokenPrefix}${resetToken}`;
      await this.redis.set(
        resetKey,
        user.id,
        'EX',
        60 * 60 // 1 hour in seconds
      );
      
      this.securityLogger.log(
        SecurityEventType.PASSWORD_RESET_REQUESTED,
        'Password reset requested',
        { userId: user.id, email },
        SecurityEventType.MEDIUM
      );
      
      return resetToken;
    } catch (error) {
      this.handleError(error, 'Password reset request failed');
      return null;
    }
  }
  
  /**
   * Reset a user's password using a reset token
   */
  async resetPassword(params: ResetPasswordParams): Promise<boolean> {
    try {
      // Validate input
      const validatedInput = resetPasswordSchema.parse(params);
      const { token, password } = validatedInput;
      
      // Check if token exists in Redis
      const resetKey = `${this.resetTokenPrefix}${token}`;
      const userId = await this.redis.get(resetKey);
      
      if (!userId) {
        throw new ServiceError(
          ErrorCode.INVALID_TOKEN,
          'Invalid or expired reset token',
          { token },
          false
        );
      }
      
      // Hash new password
      const hashedPassword = await this.hashPassword(password);
      
      // Update user password
      await this.executeQuery(
        async (db) => {
          return db.update(users)
            .set({
              password: hashedPassword,
              failedLoginAttempts: 0,
              lockedUntil: null
            })
            .where(eq(users.id, userId));
        },
        'user.resetPassword'
      );
      
      // Delete reset token
      await this.redis.del(resetKey);
      
      // Invalidate all sessions for this user
      await this.invalidateUserSessions(userId);
      
      this.securityLogger.log(
        SecurityEventType.PASSWORD_RESET_COMPLETED,
        'Password reset completed',
        { userId },
        SecurityEventType.MEDIUM
      );
      
      return true;
    } catch (error) {
      return this.handleError(error, 'Password reset failed');
    }
  }
  
  /**
   * Change a user's password
   */
  async changePassword(params: ChangePasswordParams): Promise<boolean> {
    try {
      // Validate input
      const validatedInput = changePasswordSchema.parse(params);
      const { userId, currentPassword, newPassword } = validatedInput;
      
      // Get user
      const user = await this.getById(userId);
      
      if (!user) {
        throw new ServiceError(
          ErrorCode.NOT_FOUND,
          'User not found',
          { userId },
          false
        );
      }
      
      // Verify current password
      const isPasswordValid = await this.verifyPassword(currentPassword, user.password);
      
      if (!isPasswordValid) {
        throw new ServiceError(
          ErrorCode.AUTHENTICATION_FAILED,
          'Current password is incorrect',
          { userId },
          false
        );
      }
      
      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);
      
      // Update user password
      await this.executeQuery(
        async (db) => {
          return db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, userId));
        },
        'user.changePassword'
      );
      
      this.securityLogger.log(
        SecurityEventType.PASSWORD_CHANGED,
        'Password changed',
        { userId },
        SecurityEventType.MEDIUM
      );
      
      return true;
    } catch (error) {
      return this.handleError(error, 'Password change failed');
    }
  }
  
  /**
   * Invalidate all sessions for a user
   */
  async invalidateUserSessions(userId: string): Promise<void> {
    try {
      // Find all sessions for this user
      const sessionKeys = await this.redis.keys(`${this.sessionPrefix}*`);
      
      for (const sessionKey of sessionKeys) {
        const sessionData = await this.redis.get(sessionKey);
        
        if (sessionData) {
          const session = JSON.parse(sessionData) as SessionData;
          
          if (session.userId === userId) {
            // Get session ID from key
            const sessionId = sessionKey.replace(this.sessionPrefix, '');
            
            // Delete token and session
            const tokenKey = `${this.tokenPrefix}${sessionId}`;
            await this.redis.del(tokenKey);
            await this.redis.del(sessionKey);
          }
        }
      }
      
      this.securityLogger.log(
        SecurityEventType.SESSIONS_INVALIDATED,
        'All sessions invalidated for user',
        { userId },
        SecurityEventType.MEDIUM
      );
    } catch (error) {
      this.logger.error('Failed to invalidate user sessions', { error, userId });
    }
  }
  
  /**
   * Find a user by email
   */
  private async findUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.executeQuery(
        async (db) => {
          return db.select().from(users).where(eq(users.email, email)).limit(1);
        },
        'user.findByEmail'
      );
      
      return result[0] || null;
    } catch (error) {
      this.logger.error('Error finding user by email', { error, email });
      return null;
    }
  }
  
  /**
   * Hash a password
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }
  
  /**
   * Verify a password against a hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  /**
   * Generate a pair of access and refresh tokens
   */
  private async generateTokenPair(
    user: User,
    metadata: { ipAddress?: string; userAgent?: string } = {}
  ): Promise<AuthTokens> {
    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    // Create access token payload
    const accessTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      sessionId,
      storeId: user.storeId
    };

    // Sign access token
    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.JWT_SECRET!,
      { expiresIn: this.accessTokenExpiry }
    );

    // Sign refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, sessionId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: this.refreshTokenExpiry }
    );

    // Calculate expiration dates
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Store session in Redis
    const sessionData: SessionData = {
      userId: user.id,
      lastActivity: new Date(),
      expiresAt: refreshExpiresAt,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    };
    
    // Store both the refresh token and session data in Redis
    try {
      // Store refresh token with expiration
      await this.redis.set(
        `${this.tokenPrefix}${sessionId}`,
        refreshToken,
        'EX',
        7 * 24 * 60 * 60 // 7 days in seconds
      );
      
      // Store session data with expiration
      await this.redis.set(
        `${this.sessionPrefix}${sessionId}`,
        JSON.stringify(sessionData),
        'EX',
        7 * 24 * 60 * 60 // 7 days in seconds
      );
    } catch (error) {
      this.logger.error('Failed to store token in Redis', { error, userId: user.id });
      throw new ServiceError(
        ErrorCode.DATABASE_ERROR,
        'Redis connection error',
        { redisError: error instanceof Error ? error.message : String(error) },
        true
      );
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }
  
  /**
   * Handle a failed login attempt
   */
  private async handleFailedLogin(user: User, ipAddress?: string): Promise<void> {
    try {
      const failedAttempts = user.failedLoginAttempts + 1;
      let lockedUntil: Date | null = null;
      
      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        // Lock for 30 minutes
        lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      
      // Update user
      await this.executeQuery(
        async (db) => {
          return db.update(users)
            .set({
              failedLoginAttempts: failedAttempts,
              lockedUntil
            })
            .where(eq(users.id, user.id));
        },
        'user.updateFailedLoginAttempts'
      );
      
      this.securityLogger.log(
        SecurityEventType.FAILED_LOGIN,
        failedAttempts >= 5 ? 'Account locked after multiple failed attempts' : 'Failed login attempt',
        { userId: user.id, email: user.email, ipAddress, failedAttempts, lockedUntil },
        failedAttempts >= 5 ? SecurityEventType.HIGH : SecurityEventType.MEDIUM
      );
    } catch (error) {
      this.logger.error('Failed to update login attempts', { error, userId: user.id });
    }
  }
  
  /**
   * Reset failed login attempts
   */
  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    try {
      await this.executeQuery(
        async (db) => {
          return db.update(users)
            .set({
              failedLoginAttempts: 0,
              lockedUntil: null
            })
            .where(eq(users.id, userId));
        },
        'user.resetFailedLoginAttempts'
      );
    } catch (error) {
      this.logger.error('Failed to reset login attempts', { error, userId });
    }
  }
  
  /**
   * Update last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.executeQuery(
        async (db) => {
          return db.update(users)
            .set({ lastLogin: new Date() })
            .where(eq(users.id, userId));
        },
        'user.updateLastLogin'
      );
    } catch (error) {
      this.logger.error('Failed to update last login', { error, userId });
    }
  }
}
