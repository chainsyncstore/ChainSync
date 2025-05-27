import { Router } from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/auth/auth-service.js';
import { authRateLimit, passwordResetRateLimit } from '../middleware/jwt-auth.js';
import { Pool } from 'pg';
import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ component: 'auth-routes' });

export const createAuthRoutes = (db: Pool): Router => {
  const router = Router();
  const authService = new AuthService(db);

  // Login endpoint
  router.post('/login',
    authRateLimit,
    [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
    ],
    async (req: any, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { email, password } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;

        logger.info('Login attempt', { email, ipAddress });

        const result = await authService.login(email, password, ipAddress);

        if (!result) {
          logger.warn('Failed login attempt', { email, ipAddress });
          return res.status(401).json({
            error: 'Invalid email or password'
          });
        }

        const { user, tokens } = result;

        logger.info('Successful login', { 
          userId: user.id, 
          email: user.email, 
          role: user.role,
          ipAddress 
        });

        res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            permissions: user.permissions
          },
          tokens
        });

      } catch (error) {
        logger.error('Login error', error as Error, { 
          email: req.body.email,
          ipAddress: req.ip 
        });

        if (error instanceof Error && error.message.includes('locked')) {
          return res.status(423).json({
            error: error.message
          });
        }

        if (error instanceof Error && error.message.includes('deactivated')) {
          return res.status(403).json({
            error: error.message
          });
        }

        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  );

  // Refresh token endpoint
  router.post('/refresh',
    authRateLimit,
    [
      body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
    ],
    async (req: any, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { refreshToken } = req.body;

        const tokens = await authService.refreshAccessToken(refreshToken);

        if (!tokens) {
          return res.status(401).json({
            error: 'Invalid or expired refresh token'
          });
        }

        res.json({
          message: 'Token refreshed successfully',
          tokens
        });

      } catch (error) {
        logger.error('Token refresh error', error as Error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  );

  // Logout endpoint
  router.post('/logout',
    [
      body('sessionId')
        .optional()
        .isUUID()
        .withMessage('Invalid session ID format')
    ],
    async (req: any, res: Response) => {
      try {
        const { sessionId } = req.body;

        if (sessionId) {
          await authService.logout(sessionId);
        }

        res.json({
          message: 'Logout successful'
        });

      } catch (error) {
        logger.error('Logout error', error as Error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  );

  // Logout all sessions endpoint
  router.post('/logout-all',
    [
      body('userId')
        .notEmpty()
        .withMessage('User ID is required')
    ],
    async (req: any, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { userId } = req.body;

        await authService.logoutAllSessions(userId);

        res.json({
          message: 'All sessions logged out successfully'
        });

      } catch (error) {
        logger.error('Logout all sessions error', error as Error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  );

  // Registration endpoint
  router.post('/register',
    [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),
      body('username')
        .isLength({ min: 3 })
        .withMessage('Username must be at least 3 characters long')
        .isAlphanumeric()
        .withMessage('Username can only contain letters and numbers'),
      body('fullName')
        .isLength({ min: 2 })
        .withMessage('Full name is required'),
      body('role')
        .optional()
        .isIn(['cashier', 'manager', 'admin'])
        .withMessage('Invalid role type')
    ],
    async (req: any, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { email, password, username, fullName, role = 'cashier', storeId } = req.body;

        // Check if user with the same email or username exists
        const existingUser = await authService.checkExistingUser(email, username);
        if (existingUser) {
          return res.status(409).json({
            error: 'User already exists',
            details: existingUser.email === email ? 'Email is already in use' : 'Username is already taken'
          });
        }

        const user = await authService.registerUser({
          email,
          password,
          username,
          fullName,
          role,
          storeId: storeId ? parseInt(storeId) : undefined
        });

        logger.info('User registered successfully', { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        });

        res.status(201).json({
          message: 'Registration successful',
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role
          }
        });

      } catch (error) {
        logger.error('Registration error', error as Error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  );

  // Request password reset endpoint
  router.post('/request-password-reset',
    passwordResetRateLimit,
    [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required')
    ],
    async (req: any, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { email } = req.body;
        
        // Generate a reset token
        const result = await authService.createPasswordResetToken(email);
        
        if (!result) {
          // Always return success to prevent email enumeration
          return res.json({
            message: 'If your email is registered, you will receive a password reset link'
          });
        }
        
        // In a real application, send an email with the reset link
        // For this project, we'll just return the token in the response
        logger.info('Password reset requested', { email, token: result.token });

        res.json({
          message: 'If your email is registered, you will receive a password reset link',
          // The following would normally not be sent in the response, but included for development
          debug: {
            token: result.token,
            expiresAt: result.expiresAt
          }
        });

      } catch (error) {
        logger.error('Password reset request error', error as Error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  );

  // Reset password endpoint
  router.post('/reset-password',
    [
      body('token')
        .notEmpty()
        .withMessage('Reset token is required'),
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character')
    ],
    async (req: any, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        const { token, password } = req.body;

        const result = await authService.resetPasswordWithToken(token, password);

        if (!result) {
          return res.status(400).json({
            error: 'Invalid or expired reset token'
          });
        }

        // Invalidate all existing sessions for the user
        await authService.logoutAllSessions(result.userId);

        logger.info('Password reset successfully', { userId: result.userId });

        res.json({
          message: 'Password reset successful. You can now log in with your new password.'
        });

      } catch (error) {
        logger.error('Password reset error', error as Error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  );

  // Change password endpoint
  router.post('/change-password',
    passwordResetRateLimit,
    [
      body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
      body('newPassword')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least 8 characters with uppercase, lowercase, number and special character'),
      body('confirmPassword')
        .custom((value, { req }) => {
          if (value !== req.body.newPassword) {
            throw new Error('Password confirmation does not match');
          }
          return true;
        })
    ],
    async (req: any, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
          });
        }

        // This would need to be implemented in AuthService
        res.status(501).json({
          error: 'Change password functionality not yet implemented'
        });

      } catch (error) {
        logger.error('Change password error', error as Error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    }
  );

  return router;
};
