import { Request, Response } from 'express';
import { sql } from 'drizzle-orm'; // Import for SQL building
import { UnifiedAuthService } from '../services/auth/unified-auth-service';
import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import { db } from '../../db';
import { getRedisClient } from '../../src/cache/redis'; // Corrected Redis import
import { getLogger } from '../../src/logging'; // Use the project's logger

// Logger configuration
const controllerLogger = getLogger().child({ component: 'auth-controller' });

const redis = getRedisClient();
if (!redis) {
  controllerLogger.error('Redis client not available. AuthController cannot be initialized.');
  throw new Error('Redis client not available for AuthController.');
}

const authService = new UnifiedAuthService(db, redis);

/**
 * Controller for authentication-related endpoints
 */
export class AuthController {
  /**
   * User login handler
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      
      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Email and password are required'
          }
        });
      }
      
      // Get client metadata for security logging
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string
      };
      
      // Attempt login
      const result = await authService.login(email, password, metadata);
      
      if (!result) {
        // Don't reveal whether the user exists or the password was incorrect
        return res.status(401).json({
          success: false,
          error: {
            code: ErrorCode.INVALID_CREDENTIALS,
            message: 'Invalid email or password'
          }
        });
      }
      
      // Set secure HTTP-only cookie for refresh token (preferred over localStorage)
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Log successful login
      controllerLogger.info('User logged in successfully', {
        userId: result.user.id,
        email: result.user.email,
        ip: req.ip
      });
      
      // Return user data and access token
      return res.json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            username: result.user.username,
            role: result.user.role,
            permissions: result.user.permissions,
            storeId: result.user.storeId
          },
          token: result.tokens.accessToken
        }
      });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return res.status(error.statusCode || 400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        });
      }
      
      controllerLogger.error('Login error', { error });
      return res.status(500).json({
        success: false,
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'An error occurred during login'
          }
      });
    }
  }
  
  /**
   * User registration handler with enhanced security
   */
  async register(req: Request, res: Response) {
    try {
      const { email, password, username, fullName } = req.body;
      
      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Email and password are required'
          }
        });
      }
      
      // Check for existing user with parameterized query
      const existingUserResult = await db.execute(
        sql`SELECT id FROM users WHERE email = ${email}`
      );
      
      if (existingUserResult.rows && existingUserResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'User with this email already exists'
          }
        });
      }
      
      // Create user with secure password hashing
      const hashedPassword = await authService.hashPassword(password);
      
      // Default role for new users
      const role = 'viewer';
      
      // Insert user with parameterized query
      const result = await db.execute(
        sql`INSERT INTO users (
          email, 
          password, 
          username, 
          full_name, 
          role, 
          is_active, 
          created_at
        ) VALUES (${email}, ${hashedPassword}, ${username || email}, ${fullName || null}, ${role}, true, NOW()) RETURNING id`
      );
      
      const userId = result.rows[0].id;
      
      // Log user creation
      controllerLogger.info('New user registered', {
        userId,
        email,
        ip: req.ip
      });
      
      return res.status(201).json({
        success: true,
        data: {
          id: userId,
          email,
          username: username || email,
          role
        }
      });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return res.status(error.statusCode || 400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        });
      }
      
      controllerLogger.error('Registration error', { error });
      return res.status(500).json({
        success: false,
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'An error occurred during registration'
          }
      });
    }
  }
  
  /**
   * Password reset request handler
   */
  async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Email is required'
          }
        });
      }
      
      // Check if user exists
      const userResult = await db.execute(
        sql`SELECT id, email, is_active FROM users WHERE email = ${email}`
      );
      
      // Always return success even if user doesn't exist (to prevent user enumeration)
      if (!userResult.rows || userResult.rows.length === 0) {
        controllerLogger.info('Password reset requested for non-existent email', { email });
        return res.json({
          success: true,
          message: 'If your email is registered, you will receive password reset instructions'
        });
      }
      
      const user = userResult.rows[0] as { id: string; email: string; is_active: boolean }; // Type assertion
      
      // Generate a secure random token
      const resetToken = await authService.generateResetToken(user.id);
      
      // In a real application, you would send an email with the reset link
      // For this exercise, we'll just log it
      controllerLogger.info('Password reset token generated', {
        userId: user.id,
        email: user.email,
        // In a real app, you would NOT log the actual token
        tokenPreview: resetToken.substring(0, 5) + '...'
      });
      
      return res.json({
        success: true,
        message: 'If your email is registered, you will receive password reset instructions'
      });
    } catch (error: unknown) {
      controllerLogger.error('Password reset request error', { error });
      return res.status(500).json({
        success: false,
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'An error occurred while processing your request'
          }
      });
    }
  }
  
  /**
   * Complete password reset
   */
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Token and new password are required'
          }
        });
      }
      
      // Validate the reset token
      const userId = await authService.validateResetToken(token);
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Invalid or expired token'
          }
        });
      }
      
      // Update the user's password
      const hashedPassword = await authService.hashPassword(newPassword);
      
      // Update user password
      await db.execute(
        sql`UPDATE users 
         SET password = ${hashedPassword}, 
             failed_login_attempts = 0, 
             locked_until = NULL,
             password_updated_at = NOW()
         WHERE id = ${userId}`
      );
      
      // Invalidate all existing sessions for security
      await authService.logoutAllSessions(userId);
      
      // Log password reset
      controllerLogger.info('Password reset completed', { userId });
      
      return res.json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } catch (error: unknown) {
      controllerLogger.error('Password reset error', { error });
      return res.status(500).json({
        success: false,
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'An error occurred while resetting your password'
          }
      });
    }
  }
}

// Create singleton instance
export const authController = new AuthController();
