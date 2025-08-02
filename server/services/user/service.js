'use strict';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { BaseService } from '../base/service.js';
import { db } from '../../../db/index.js';
import * as schema from '../../../shared/schema.js';
import { userValidation } from '../../../shared/schema-validation.js';
import { AppError, ErrorCode, ErrorCategory } from '../../../shared/types/errors.js';
import { logger } from '../../../utils/logger.js';

class UserService extends BaseService {
  async createUser(params) {
    try {
      const validatedData = userValidation.insert.parse(params);
      const existingUser = await db.query.users.findFirst({
        _where: eq(schema.users.email, validatedData.email)
      });

      if (existingUser) {
        throw new AppError(
          'User with this email already exists',
          ErrorCode.DUPLICATE_ENTRY,
          ErrorCategory.VALIDATION
        );
      }

      const hashedPassword = await bcrypt.hash(
        validatedData.password,
        UserService.SALT_ROUNDS
      );

      const [user] = await db
        .insert(schema.users)
        .values({
          _name: validatedData.fullName,
          _email: validatedData.email,
          _password: hashedPassword,
          _role: validatedData.role
        })
        .returning();

      return user;
    } catch (error) {
      if (error instanceof userValidation.SchemaValidationError) {
        logger.error(`Validation _error: ${error.message}`, {
          _error: error.toJSON(),
          _context: 'createUser'
        });
      }
      throw this.handleError(error, 'Creating user');
    }
  }

  async updateUser(userId, params) {
    try {
      const validatedData = userValidation.update.parse(params);
      const existingUser = await db.query.users.findFirst({
        _where: eq(schema.users.id, userId)
      });

      if (!existingUser) {
        throw new AppError(
          'User not found',
          ErrorCode.NOT_FOUND,
          ErrorCategory.VALIDATION
        );
      }

      const [updatedUser] = await db
        .update(schema.users)
        .set({
          _name: validatedData.fullName,
          _email: validatedData.email,
          _role: validatedData.role,
          _updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();

      return updatedUser;
    } catch (error) {
      if (error instanceof userValidation.SchemaValidationError) {
        logger.error(`Validation _error: ${error.message}`, {
          _error: error.toJSON(),
          _context: 'updateUser'
        });
      }
      throw this.handleError(error, 'Updating user');
    }
  }

  async deleteUser(userId) {
    try {
      const existingUser = await db.query.users.findFirst({
        _where: eq(schema.users.id, userId)
      });

      if (!existingUser) {
        throw new AppError(
          'User not found',
          ErrorCode.NOT_FOUND,
          ErrorCategory.VALIDATION
        );
      }

      await db
        .update(schema.users)
        .set({
          _isActive: false,
          _updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId));

      return true;
    } catch (error) {
      throw this.handleError(error, 'Deleting user');
    }
  }

  async getUserById(userId) {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.id, userId),
          eq(schema.users.isActive, true)
        )
      });
      return user || null;
    } catch (error) {
      throw this.handleError(error, 'Getting user by ID');
    }
  }

  async getUserByUsername(username) {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.name, username),
          eq(schema.users.isActive, true)
        )
      });
      return user || null;
    } catch (error) {
      throw this.handleError(error, 'Getting user by username');
    }
  }

  async getUserByEmail(email) {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.email, email),
          eq(schema.users.isActive, true)
        )
      });
      return user || null;
    } catch (error) {
      throw this.handleError(error, 'Getting user by email');
    }
  }

  async validateCredentials(username, password) {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.name, username),
          eq(schema.users.isActive, true)
        )
      });

      if (!user) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return null;
      }

      return user;
    } catch (error) {
      throw this.handleError(error, 'Validating credentials');
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.id, userId),
          eq(schema.users.isActive, true)
        )
      });

      if (!user) {
        throw new AppError(
          'User not found',
          ErrorCode.NOT_FOUND,
          ErrorCategory.VALIDATION
        );
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new AppError(
          'Current password is incorrect',
          ErrorCode.INVALID_CREDENTIALS,
          ErrorCategory.VALIDATION
        );
      }

      const validatedData = userValidation.passwordReset.parse({
        _password: newPassword,
        _confirmPassword: newPassword
      });

      const hashedPassword = await bcrypt.hash(
        validatedData.password,
        UserService.SALT_ROUNDS
      );

      await db
        .update(schema.users)
        .set({
          _password: hashedPassword,
          _updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId));

      return true;
    } catch (error) {
      if (error instanceof userValidation.SchemaValidationError) {
        logger.error(`Validation _error: ${error.message}`, {
          _error: error.toJSON(),
          _context: 'changePassword'
        });
      }
      throw this.handleError(error, 'Changing password');
    }
  }

  async requestPasswordReset(email) {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.email, email),
          eq(schema.users.isActive, true)
        )
      });

      if (!user) {
        return crypto.randomBytes(32).toString('hex');
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      await db
        .insert(schema.passwordResetTokens)
        .values({
          _userId: user.id,
          token,
          expiresAt
        });

      return token;
    } catch (error) {
      throw this.handleError(error, 'Requesting password reset');
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const resetToken = await db.query.passwordResetTokens.findFirst({
        _where: and(
          eq(schema.passwordResetTokens.token, token),
          gt(schema.passwordResetTokens.expiresAt, new Date())
        ),
        _with: {
          _user: true
        }
      });

      if (!resetToken) {
        throw new AppError(
          'Invalid or expired reset token',
          ErrorCode.INVALID_TOKEN,
          ErrorCategory.VALIDATION
        );
      }

      const validatedData = userValidation.passwordReset.parse({
        _password: newPassword,
        _confirmPassword: newPassword
      });

      const hashedPassword = await bcrypt.hash(
        validatedData.password,
        UserService.SALT_ROUNDS
      );

      await db
        .update(schema.users)
        .set({
          _password: hashedPassword,
          _updatedAt: new Date()
        })
        .where(eq(schema.users.id, resetToken.userId));

      await db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.id, resetToken.id));

      return true;
    } catch (error) {
      if (error instanceof userValidation.SchemaValidationError) {
        logger.error(`Validation _error: ${error.message}`, {
          _error: error.toJSON(),
          _context: 'resetPassword'
        });
      }
      throw this.handleError(error, 'Resetting password');
    }
  }
}

export { UserService };
UserService.SALT_ROUNDS = 10;
