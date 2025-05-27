import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Pool } from 'pg';

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
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();
  private activeSessions = new Map<string, { userId: string; lastActivity: Date }>();
  
  constructor(private db: Pool) {}

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async generateTokenPair(user: User): Promise<AuthTokens> {
    const sessionId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    
    const accessTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionId
    };

    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, sessionId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    // Store refresh token
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    this.refreshTokens.set(sessionId, { userId: user.id, expiresAt: refreshExpiresAt });
    
    // Track active session
    this.activeSessions.set(sessionId, { userId: user.id, lastActivity: new Date() });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }

  async validateAccessToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      // Check if session is still active
      const session = this.activeSessions.get(payload.sessionId);
      if (!session || session.userId !== payload.userId) {
        return null;
      }

      // Update last activity
      session.lastActivity = new Date();
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      const sessionData = this.refreshTokens.get(payload.sessionId);
      
      if (!sessionData || sessionData.userId !== payload.userId || sessionData.expiresAt < new Date()) {
        return null;
      }

      // Get user data
      const user = await this.getUserById(payload.userId);
      if (!user || !user.isActive) {
        return null;
      }

      return this.generateTokenPair(user);
    } catch (error) {
      return null;
    }
  }
  
  async checkExistingUser(email: string, username: string): Promise<{ email: string; username: string } | null> {
    const query = `
      SELECT email, username FROM users 
      WHERE email = $1 OR username = $2
      LIMIT 1
    `;
    
    const result = await this.db.query(query, [email, username]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return {
      email: result.rows[0].email,
      username: result.rows[0].username
    };
  }
  
  async registerUser(userData: {
    email: string;
    password: string;
    username: string;
    fullName: string;
    role?: string;
    storeId?: number;
  }): Promise<User> {
    // Hash the password
    const hashedPassword = await this.hashPassword(userData.password);
    
    // Set default role if not provided
    const role = userData.role || 'cashier';
    
    // Insert user into database
    const query = `
      INSERT INTO users (email, username, password, full_name, role, store_id, is_active, failed_login_attempts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, username, role, store_id as "storeId", is_active as "isActive"
    `;
    
    const result = await this.db.query(query, [
      userData.email,
      userData.username,
      hashedPassword,
      userData.fullName,
      role,
      userData.storeId || null,
      true, // isActive
      0 // failedLoginAttempts
    ]);
    
    const user = result.rows[0];
    
    // Generate permissions based on role
    const permissions = this.getPermissionsByRole(role);
    
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      password: hashedPassword, // Normally we wouldn't return this, but needed for the interface
      role: user.role,
      permissions,
      isActive: user.isActive,
      failedLoginAttempts: 0,
      storeId: user.storeId
    };
  }
  
  private getPermissionsByRole(role: string): string[] {
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
  
  async createPasswordResetToken(email: string): Promise<{ token: string; expiresAt: Date } | null> {
    // Find user by email
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      return null;
    }
    
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Store token in database
    const query = `
      INSERT INTO password_reset_tokens (user_id, token, expires_at, used)
      VALUES ($1, $2, $3, $4)
    `;
    
    await this.db.query(query, [user.id, token, expiresAt, false]);
    
    return { token, expiresAt };
  }
  
  async resetPasswordWithToken(token: string, newPassword: string): Promise<{ userId: string } | null> {
    // Find valid token
    const tokenQuery = `
      SELECT user_id, expires_at, used
      FROM password_reset_tokens
      WHERE token = $1
    `;
    
    const tokenResult = await this.db.query(tokenQuery, [token]);
    
    if (tokenResult.rows.length === 0) {
      return null;
    }
    
    const resetToken = tokenResult.rows[0];
    
    // Check if token is expired or used
    if (new Date(resetToken.expires_at) < new Date() || resetToken.used) {
      return null;
    }
    
    // Hash the new password
    const hashedPassword = await this.hashPassword(newPassword);
    
    // Update the user's password
    const updateQuery = `
      UPDATE users
      SET password = $1, failed_login_attempts = 0, locked_until = NULL
      WHERE id = $2
      RETURNING id
    `;
    
    const updateResult = await this.db.query(updateQuery, [hashedPassword, resetToken.user_id]);
    
    if (updateResult.rows.length === 0) {
      return null;
    }
    
    // Mark token as used
    await this.db.query(
      'UPDATE password_reset_tokens SET used = true WHERE token = $1',
      [token]
    );
    
    return { userId: resetToken.user_id };
  }

  async login(email: string, password: string, ipAddress?: string): Promise<{ user: User; tokens: AuthTokens } | null> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      await this.handleFailedLogin(user.id);
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Reset failed login attempts on successful login
    await this.resetFailedLoginAttempts(user.id);
    
    // Update last login
    await this.updateLastLogin(user.id, ipAddress);

    const tokens = await this.generateTokenPair(user);
    
    return { user, tokens };
  }

  async logout(sessionId: string): Promise<void> {
    this.refreshTokens.delete(sessionId);
    this.activeSessions.delete(sessionId);
  }

  async logoutAllSessions(userId: string): Promise<void> {
    // Remove all refresh tokens for user
    for (const [sessionId, data] of this.refreshTokens.entries()) {
      if (data.userId === userId) {
        this.refreshTokens.delete(sessionId);
      }
    }
    
    // Remove all active sessions for user
    for (const [sessionId, data] of this.activeSessions.entries()) {
      if (data.userId === userId) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, username, password, role, is_active as "isActive", last_login as "lastLogin", 
             failed_login_attempts as "failedLoginAttempts", locked_until as "lockedUntil", store_id as "storeId"
      FROM users 
      WHERE email = $1
    `;
    
    const result = await this.db.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // Get permissions based on role
    const permissions = this.getPermissionsByRole(row.role);
    
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      role: row.role,
      permissions: row.permissions || [],
      isActive: row.is_active,
      lastLogin: row.last_login,
      failedLoginAttempts: row.failed_login_attempts || 0,
      lockedUntil: row.locked_until,
      storeId: row.store_id
    };
  }

  private async getUserById(userId: string): Promise<User | null> {
    const query = `
      SELECT id, email, username, password, role, is_active as "isActive", last_login as "lastLogin", 
             failed_login_attempts as "failedLoginAttempts", locked_until as "lockedUntil", store_id as "storeId"
      FROM users 
      WHERE id = $1
    `;
    
    const result = await this.db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // Get permissions based on role
    const permissions = this.getPermissionsByRole(row.role);
    
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      role: row.role,
      permissions,
      isActive: row.is_active,
      lastLogin: row.last_login,
      failedLoginAttempts: row.failed_login_attempts || 0,
      lockedUntil: row.locked_until
    };
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET failed_login_attempts = failed_login_attempts + 1,
          locked_until = CASE 
            WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
            ELSE locked_until
          END
      WHERE id = $1
    `;
    
    await this.db.query(query, [userId]);
  }

  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE id = $1
    `;
    
    await this.db.query(query, [userId]);
  }

  private async updateLastLogin(userId: string, ipAddress?: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login = NOW(), last_login_ip = $2
      WHERE id = $1
    `;
    
    await this.db.query(query, [userId, ipAddress]);
  }

  // Permission checking utilities
  hasPermission(user: JWTPayload, permission: string): boolean {
    return user.permissions.includes(permission) || user.role === 'admin';
  }

  hasRole(user: JWTPayload, roles: string[]): boolean {
    return roles.includes(user.role);
  }

  canAccessResource(user: JWTPayload, resource: string, action: string): boolean {
    const permission = `${resource}:${action}`;
    return this.hasPermission(user, permission);
  }
}
