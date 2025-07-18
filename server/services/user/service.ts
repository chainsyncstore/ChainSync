import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq, and, or, gt } from 'drizzle-orm';

import { BaseService } from '../base/service.js';
import { IUserService, CreateUserParams, UpdateUserParams } from './types.js';
import { db } from '../../../db/index.js';
import * as schema from '../../../shared/schema.js';
import { userValidation, SchemaValidationError } from '../../../shared/schema-validation.js';
import { AppError, ErrorCode, ErrorCategory } from '../../../shared/types/errors.js';

export class UserService extends BaseService implements IUserService {
  private static readonly SALT_ROUNDS = 10;
  
  async createUser(params: CreateUserParams): Promise<schema.User> {
    try {
      // Validate input data
      const validatedData = userValidation.insert(params);
      
      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: or(
          eq(schema.users.username, validatedData.username),
          eq(schema.users.email, validatedData.email)
        )
      });
      
      if (existingUser) {
        throw new AppError(
          'User with this username or email already exists',
          ErrorCode.DUPLICATE_ENTRY,
          ErrorCategory.VALIDATION
        );
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, UserService.SALT_ROUNDS);
      
      // Create user
      const [user] = await db
        .insert(schema.users)
        .values({
          ...validatedData,
          password: hashedPassword
        })
        .returning();
      
      return user;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${(error as any).message}`, (error as any).toJSON());
      }
      return this.handleError(error as Error, 'Creating user');
    }
  }
  
  async updateUser(userId: number, params: UpdateUserParams): Promise<schema.User> {
    try {
      // Validate input data
      const validatedData = userValidation.update(params);
      
      // Check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });
      
      if (!existingUser) {
        throw new AppError(
          'User not found',
          ErrorCode.NOT_FOUND,
          ErrorCategory.VALIDATION
        );
      }
      
      // If password is being updated, hash it
      if (validatedData.password) {
        validatedData.password = await bcrypt.hash(validatedData.password, UserService.SALT_ROUNDS);
      }
      
      // Update user
      const [updatedUser] = await db
        .update(schema.users)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId))
        .returning();
      
      return updatedUser;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${(error as any).message}`, (error as any).toJSON());
      }
      return this.handleError(error as Error, 'Updating user');
    }
  }
  
  async deleteUser(userId: number): Promise<boolean> {
    try {
      // Check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });
      
      if (!existingUser) {
        throw new AppError(
          'User not found',
          ErrorCode.NOT_FOUND,
          ErrorCategory.VALIDATION
        );
      }
      
      // Soft delete user
      await db
        .update(schema.users)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId));
      
      return true;
    } catch (error) {
      return this.handleError(error as Error, 'Deleting user');
    }
  }
  
  async getUserById(userId: number): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: and(
          eq(schema.users.id, userId),
          eq(schema.users.isActive, true)
        )
      });
      
      return user || null;
    } catch (error) {
      return this.handleError(error as Error, 'Getting user by ID');
    }
  }
  
  async getUserByUsername(username: string): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: and(
          eq(schema.users.username, username),
          eq(schema.users.isActive, true)
        )
      });
      
      return user || null;
    } catch (error) {
      return this.handleError(error as Error, 'Getting user by username');
    }
  }
  
  async getUserByEmail(email: string): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: and(
          eq(schema.users.email, email),
          eq(schema.users.isActive, true)
        )
      });
      
      return user || null;
    } catch (error) {
      return this.handleError(error as Error, 'Getting user by email');
    }
  }
  
  async validateCredentials(username: string, password: string): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: and(
          eq(schema.users.username, username),
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
      
      // Update last login
      await db
        .update(schema.users)
        .set({ lastLogin: new Date(), updatedAt: new Date() })
        .where(eq(schema.users.id, user.id));
      
      return user;
    } catch (error) {
      return this.handleError(error as Error, 'Validating credentials');
    }
  }
  
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Get user
      const user = await db.query.users.findFirst({
        where: and(
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
      
      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        throw new AppError(
          'Current password is incorrect',
          ErrorCode.INVALID_CREDENTIALS,
          ErrorCategory.VALIDATION
        );
      }
      
      // Validate new password
      const validatedData = userValidation.passwordReset({ password: newPassword, confirmPassword: newPassword });
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(validatedData.password, UserService.SALT_ROUNDS);
      
      // Update password
      await db
        .update(schema.users)
        .set({
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId));
      
      return true;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${(error as any).message}`, (error as any).toJSON());
      }
      return this.handleError(error as Error, 'Changing password');
    }
  }
  
  async requestPasswordReset(email: string): Promise<string> {
    try {
      // Get user
      const user = await db.query.users.findFirst({
        where: and(
          eq(schema.users.email, email),
          eq(schema.users.isActive, true)
        )
      });
      
      if (!user) {
        // Don't reveal if user exists or not
        return crypto.randomBytes(32).toString('hex');
      }
      
      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      
      // Store reset token
      await db
        .insert(schema.passwordResetTokens)
        .values({
          userId: user.id,
          token,
          expiresAt
        });
      
      return token;
    } catch (error) {
      return this.handleError(error as Error, 'Requesting password reset');
    }
  }
  
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Find valid token
      const resetToken = await db.query.passwordResetTokens.findFirst({
        where: and(
          eq(schema.passwordResetTokens.token, token),
          gt(schema.passwordResetTokens.expiresAt, new Date())
        ),
        with: {
          user: true
        }
      });
      
      if (!resetToken) {
        throw new AppError(
          'Invalid or expired reset token',
          ErrorCode.INVALID_TOKEN,
          ErrorCategory.VALIDATION
        );
      }
      
      // Validate new password
      const validatedData = userValidation.passwordReset({ password: newPassword, confirmPassword: newPassword });
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(validatedData.password, UserService.SALT_ROUNDS);
      
      // Update password
      await db
        .update(schema.users)
        .set({
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, resetToken.userId));
      
      // Delete used token
      await db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.id, resetToken.id));
      
      return true;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${(error as any).message}`, (error as any).toJSON());
      }
      return this.handleError(error as Error, 'Resetting password');
    }
  }
}
