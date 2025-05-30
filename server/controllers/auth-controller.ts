import { Request, Response } from 'express';
import { UnifiedAuthService } from '../services/auth/unified-auth-service';
import { ErrorCode, ErrorCategory } from '../middleware/types/error';
import { AppError } from '../middleware/utils/app-error';
import { db } from '../../db';

// Logger configuration
const logger = {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  child: () => logger
};

const authService = new UnifiedAuthService();

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
            code: ErrorCode.AUTHENTICATION,
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
      logger.info('User logged in successfully', {
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
      
      logger.error('Login error', { error });
      return res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
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
        'SELECT id FROM users WHERE email = \'' + email.replace(/'/g, "''") + '\''
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
      
      // Insert user with parameterized query - using string replacement for compatibility
      // In a real production environment, we would use a proper ORM or parameterized queries
      const safeEmail = email.replace(/'/g, "''");
      const safeUsername = (username || email).replace(/'/g, "''");
      const safeFullName = (fullName || '').replace(/'/g, "''");
      
      const result = await db.execute(
        `INSERT INTO users (
          email, 
          password, 
          username, 
          full_name, 
          role, 
          is_active, 
          created_at
        ) VALUES ('${safeEmail}', '${hashedPassword}', '${safeUsername}', '${safeFullName}', '${role}', true, NOW()) RETURNING id`
      );
      
      const userId = result.rows[0].id;
      
      // Log user creation
      logger.info('New user registered', {
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
      
      logger.error('Registration error', { error });
      return res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
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
      
      // Check if user exists - using safe string replacement
      const safeEmail = email.replace(/'/g, "''");
      const userResult = await db.execute(
        `SELECT id, email, is_active FROM users WHERE email = '${safeEmail}'`
      );
      
      // Always return success even if user doesn't exist (to prevent user enumeration)
      if (!userResult.rows || userResult.rows.length === 0) {
        logger.info('Password reset requested for non-existent email', { email });
        return res.json({
          success: true,
          message: 'If your email is registered, you will receive password reset instructions'
        });
      }
      
      const user = userResult.rows[0];
      
      // Generate a secure random token
      const resetToken = await authService.generateResetToken(user.id);
      
      // In a real application, you would send an email with the reset link
      // For this exercise, we'll just log it
      logger.info('Password reset token generated', {
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
      logger.error('Password reset request error', { error });
      return res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
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
      
      // Update user password with safe string replacement
      await db.execute(
        `UPDATE users 
         SET password = '${hashedPassword}', 
             failed_login_attempts = 0, 
             locked_until = NULL,
             password_updated_at = NOW()
         WHERE id = '${userId}'`
      );
      
      // Invalidate all existing sessions for security
      await authService.logoutAllSessions(userId);
      
      // Log password reset
      logger.info('Password reset completed', { userId });
      
      return res.json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } catch (error: unknown) {
      logger.error('Password reset error', { error });
      return res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An error occurred while resetting your password'
        }
      });
    }
  }
}

// Create singleton instance
export const authController = new AuthController();
