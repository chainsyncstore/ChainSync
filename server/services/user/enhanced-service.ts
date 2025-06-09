import * as schema from '@shared/schema';
import { userValidation, SchemaValidationError } from '@shared/schema-validation';
import { ServiceErrorHandler } from '@shared/utils/service-helpers';
import * as bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';

import {
  IUserService,
  CreateUserParams,
  UpdateUserParams,
  UserRole,
  UserServiceErrors,
} from './types';
import { db } from '../../database';
import { EnhancedBaseService } from '../base/enhanced-service';

export class EnhancedUserService extends EnhancedBaseService implements IUserService {
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Find the password reset token
      const resetToken = await db.query.passwordResetTokens.findFirst({
        where: and(
          eq(schema.passwordResetTokens.token, token),
          eq(schema.passwordResetTokens.used, false)
        ),
      });

      if (!resetToken) {
        throw new Error('Invalid or expired reset token');
      }

      // Check if token has expired
      if (resetToken.expiresAt && resetToken.expiresAt < new Date()) {
        throw new Error('Reset token has expired');
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, EnhancedUserService.SALT_ROUNDS);

      // Update user password
      await db
        .update(schema.users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, resetToken.userId));

      // Mark token as used
      await db
        .update(schema.passwordResetTokens)
        .set({ used: true })
        .where(eq(schema.passwordResetTokens.id, resetToken.id));

      return true;
    } catch (error: unknown) {
      return ServiceErrorHandler.handleError(error, 'Resetting password');
    }
  }

  async requestPasswordReset(email: string): Promise<string> {
    try {
      // Find user by email
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate reset token
      const token = require('crypto').randomBytes(32).toString('hex');

      // Create password reset token record (expires in 24 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await db.insert(schema.passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
        used: false,
        createdAt: new Date(),
      });

      return token;
    } catch (error: unknown) {
      return ServiceErrorHandler.handleError(error, 'Requesting password reset');
    }
  }
  private static readonly SALT_ROUNDS = 10;

  async createUser(params: CreateUserParams): Promise<schema.User> {
    try {
      // Check for duplicate username
      const existingUsername = await db.query.users.findFirst({
        where: eq(schema.users.username, params.username),
      });
      if (existingUsername) throw UserServiceErrors.DUPLICATE_USERNAME;
      // Check for duplicate email
      const existingEmail = await db.query.users.findFirst({
        where: eq(schema.users.email, params.email),
      });
      if (existingEmail) throw UserServiceErrors.DUPLICATE_EMAIL;
      // Hash password
      const hashedPassword = await bcrypt.hash(params.password, EnhancedUserService.SALT_ROUNDS);
      const userData = {
        username: params.username,
        password: hashedPassword,
        fullName: params.fullName,
        email: params.email,
        role: params.role,
        storeId: params.storeId,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const validatedData = userValidation.insert(userData);
      const [user] = await db.insert(schema.users).values(validatedData).returning();
      return user;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        const errorMessage = error.message;
        const errorJSON = error.toJSON();
        console.error(`Validation error: ${errorMessage}`, errorJSON);
      }
      return ServiceErrorHandler.handleError(error, 'Creating user');
    }
  }

  async updateUser(userId: number, params: UpdateUserParams): Promise<schema.User> {
    try {
      const existingUser = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!existingUser) throw UserServiceErrors.USER_NOT_FOUND;
      if (params.username && params.username !== existingUser.username) {
        const existingUsername = await db.query.users.findFirst({
          where: eq(schema.users.username, params.username),
        });
        if (existingUsername) throw UserServiceErrors.DUPLICATE_USERNAME;
      }
      if (params.email && params.email !== existingUser.email) {
        const existingEmail = await db.query.users.findFirst({
          where: eq(schema.users.email, params.email),
        });
        if (existingEmail) throw UserServiceErrors.DUPLICATE_EMAIL;
      }
      const updateData = { ...params, updatedAt: new Date() };
      const validatedData = userValidation.update(updateData);
      const [updatedUser] = await db
        .update(schema.users)
        .set(validatedData)
        .where(eq(schema.users.id, userId))
        .returning();
      return updatedUser;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        const errorMessage = error.message;
        const errorJSON = error.toJSON();
        console.error(`Validation error: ${errorMessage}`, errorJSON);
      }
      return ServiceErrorHandler.handleError(error, 'Updating user');
    }
  }

  async deleteUser(userId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.users)
        .where(eq(schema.users.id, userId))
        .returning({ id: schema.users.id });
      if (result.length === 0) throw UserServiceErrors.USER_NOT_FOUND;
      return true;
    } catch (error: unknown) {
      return ServiceErrorHandler.handleError(error, 'Deleting user');
    }
  }

  async getUserById(userId: number): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
        with: { store: true },
      });
      return user;
    } catch (error: unknown) {
      return ServiceErrorHandler.handleError(error, 'Getting user by ID');
    }
  }

  async getUserByUsername(username: string): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
        with: { store: true },
      });
      return user || null;
    } catch (error: unknown) {
      return ServiceErrorHandler.handleError(error, 'Getting user by username');
    }
  }

  async getUserByEmail(email: string): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
        with: { store: true },
      });
      return user || null;
    } catch (error: unknown) {
      return ServiceErrorHandler.handleError(error, 'Getting user by email');
    }
  }

  async validateCredentials(username: string, password: string): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
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
        .set({ lastLogin: new Date() })
        .where(eq(schema.users.id, user.id));

      return user;
    } catch (error: unknown) {
      return ServiceErrorHandler.handleError(error, 'Validating credentials');
    }
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });

      if (!user) {
        throw UserServiceErrors.USER_NOT_FOUND;
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, EnhancedUserService.SALT_ROUNDS);

      // Update password
      await db
        .update(schema.users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));

      return true;
    } catch (error: unknown) {
      return ServiceErrorHandler.handleError(error, 'Changing password');
    }
  }
}

export const enhancedUserService = new EnhancedUserService();
