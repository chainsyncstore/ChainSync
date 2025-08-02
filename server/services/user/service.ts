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

  async createUser(_params: CreateUserParams): Promise<schema.SelectUser> {
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

      const hashedPassword = await bcrypt.hash(validatedData.password, UserService.SALT_ROUNDS);

      const [user] = await db
        .insert(schema.users)
        .values({
          _name: validatedData.fullName,
          _email: validatedData.email,
          _password: hashedPassword
        })
        .returning();

      if (!user) {
        throw new AppError(
          'Failed to create user',
          ErrorCode.INTERNAL_SERVER_ERROR,
          ErrorCategory.SYSTEM
        );
      }

      return user;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${(error as any).message}`, (error as any).toJSON());
      }
      throw this.handleError(error as Error, 'Creating user');
    }
  }

  async updateUser(_userId: number, _params: UpdateUserParams): Promise<schema.SelectUser> {
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
          _email: validatedData.email
        })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new AppError(
          'Failed to update user',
          ErrorCode.INTERNAL_SERVER_ERROR,
          ErrorCategory.SYSTEM
        );
      }

      return updatedUser;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${(error as any).message}`, (error as any).toJSON());
      }
      throw this.handleError(error as Error, 'Updating user');
    }
  }

  async deleteUser(_userId: number): Promise<boolean> {
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
          _name: existingUser.name
        })
        .where(eq(schema.users.id, userId));

      return true;
    } catch (error) {
      throw this.handleError(error as Error, 'Deleting user');
    }
  }

  async getUserById(_userId: number): Promise<schema.SelectUser | null> {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.id, userId),
          eq(schema.users.isActive, true)
        )
      });

      return user || null;
    } catch (error) {
      throw this.handleError(error as Error, 'Getting user by ID');
    }
  }

  async getUserByUsername(_username: string): Promise<schema.SelectUser | null> {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.name, username),
          eq(schema.users.isActive, true)
        )
      });

      return user || null;
    } catch (error) {
      throw this.handleError(error as Error, 'Getting user by username');
    }
  }

  async getUserByEmail(_email: string): Promise<schema.SelectUser | null> {
    try {
      const user = await db.query.users.findFirst({
        _where: and(
          eq(schema.users.email, email),
          eq(schema.users.isActive, true)
        )
      });

      return user || null;
    } catch (error) {
      throw this.handleError(error as Error, 'Getting user by email');
    }
  }

  async validateCredentials(_username: string, _password: string): Promise<schema.SelectUser | null> {
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
      throw this.handleError(error as Error, 'Validating credentials');
    }
  }

  async changePassword(_userId: number, _currentPassword: string, _newPassword: string): Promise<boolean> {
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

      const validatedData = userValidation.passwordReset.parse({ _password: newPassword, _confirmPassword: newPassword });

      const hashedPassword = await bcrypt.hash(validatedData.password, UserService.SALT_ROUNDS);

      await db
        .update(schema.users)
        .set({
          _password: hashedPassword
        })
        .where(eq(schema.users.id, userId));

      return true;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${(error as any).message}`, (error as any).toJSON());
      }
      throw this.handleError(error as Error, 'Changing password');
    }
  }

  async requestPasswordReset(_email: string): Promise<string> {
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
      throw this.handleError(error as Error, 'Requesting password reset');
    }
  }

  async resetPassword(_token: string, _newPassword: string): Promise<boolean> {
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

      const validatedData = userValidation.passwordReset.parse({ _password: newPassword, _confirmPassword: newPassword });

      const hashedPassword = await bcrypt.hash(validatedData.password, UserService.SALT_ROUNDS);

      await db
        .update(schema.users)
        .set({
          _password: hashedPassword
        })
        .where(eq(schema.users.id, resetToken.userId));

      await db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.id, resetToken.id));

      return true;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${(error as any).message}`, (error as any).toJSON());
      }
      throw this.handleError(error as Error, 'Resetting password');
    }
  }
}
