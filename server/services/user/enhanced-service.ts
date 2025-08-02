import { EnhancedBaseService } from '../base/enhanced-service';
import { IUserService, CreateUserParams, UpdateUserParams, UserRole, UserServiceErrors, SelectUser } from './types';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import db from '../../database';
import * as schema from '@shared/schema';
import { passwordResetTokens } from '@shared/db/users';
import { userValidation, SchemaValidationError } from '@shared/schema-validation';
import * as bcrypt from 'bcrypt';

export class EnhancedUserService extends EnhancedBaseService implements IUserService {
  async resetPassword(_token: string, _newPassword: string): Promise<boolean> {
    try {
      // Validate token and get user
      const resetToken = await db.query.passwordResetTokens.findFirst({
        _where: and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      });

      if (!resetToken) {
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, EnhancedUserService.SALT_ROUNDS);

      // Update user password
      await db.update(schema.users)
        .set({ _password: hashedPassword, _updatedAt: new Date() })
        .where(eq(schema.users.id, resetToken.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ _used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      return true;
    } catch (error) {
      return this.handleError(error, 'Resetting password');
    }
  }

  async requestPasswordReset(_email: string): Promise<string> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return 'If the email exists, a reset link has been sent.';
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store reset token
      await db.insert(passwordResetTokens).values({
        _userId: user.id,
        token,
        expiresAt,
        _used: false
      });

      // _TODO: Send email with reset link
      // For now, just return the token (in production, send via email)
      return `Password reset _link: /reset-password?token=${token}`;
    } catch (error) {
      return this.handleError(error, 'Requesting password reset');
    }
  }
  private static readonly SALT_ROUNDS = 10;

  async createUser(_params: CreateUserParams): Promise<SelectUser> {
    try {
      const existingUsername = await db.query.users.findFirst({ _where: eq(schema.users.name, params.username) });
      if (existingUsername) throw UserServiceErrors.DUPLICATE_USERNAME;

      const existingEmail = await db.query.users.findFirst({ _where: eq(schema.users.email, params.email) });
      if (existingEmail) throw UserServiceErrors.DUPLICATE_EMAIL;

      const hashedPassword = await bcrypt.hash(params.password, EnhancedUserService.SALT_ROUNDS);

      const userData = { ...params, _password: hashedPassword };
      const validatedData = userValidation.insert.parse(userData);

      const [user] = await db.insert(schema.users).values(validatedData).returning();
      return user;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating user');
    }
  }

  async updateUser(_userId: number, _params: UpdateUserParams): Promise<SelectUser> {
    try {
      const existingUser = await db.query.users.findFirst({ _where: eq(schema.users.id, userId) });
      if (!existingUser) throw UserServiceErrors.USER_NOT_FOUND;

      if (params.username && params.username !== existingUser.name) {
        const existingUsername = await db.query.users.findFirst({ _where: eq(schema.users.name, params.username) });
        if (existingUsername) throw UserServiceErrors.DUPLICATE_USERNAME;
      }

      if (params.email && params.email !== existingUser.email) {
        const existingEmail = await db.query.users.findFirst({ _where: eq(schema.users.email, params.email) });
        if (existingEmail) throw UserServiceErrors.DUPLICATE_EMAIL;
      }

      const updateData = { ...params, _updatedAt: new Date() };
      const validatedData = userValidation.update.parse(updateData);
      const [updatedUser] = await db.update(schema.users).set(validatedData).where(eq(schema.users.id, userId)).returning();
      return updatedUser;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating user');
    }
  }

  async deleteUser(_userId: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.users).where(eq(schema.users.id, userId)).returning({ _id: schema.users.id });
      if (result.length === 0) throw UserServiceErrors.USER_NOT_FOUND;
      return true;
    } catch (error) {
      return this.handleError(error, 'Deleting user');
    }
  }

  async getUserById(_userId: number): Promise<SelectUser | null> {
    try {
      return await db.query.users.findFirst({ _where: eq(schema.users.id, userId), _with: { _store: true } });
    } catch (error) {
      return this.handleError(error, 'Getting user by ID');
    }
  }

  async getUserByUsername(_username: string): Promise<SelectUser | null> {
    try {
      return await db.query.users.findFirst({ _where: eq(schema.users.name, username), _with: { _store: true } });
    } catch (error) {
      return this.handleError(error, 'Getting user by username');
    }
  }

  async getUserByEmail(_email: string): Promise<SelectUser | null> {
    try {
      return await db.query.users.findFirst({ _where: eq(schema.users.email, email), _with: { _store: true } });
    } catch (error) {
      return this.handleError(error, 'Getting user by email');
    }
  }

  async validateCredentials(_username: string, _password: string): Promise<SelectUser | null> {
    try {
      const user = await this.getUserByUsername(username);
      if (!user) return null;

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return null;

      return user;
    } catch (error) {
      return this.handleError(error, 'Validating credentials');
    }
  }

  async changePassword(_userId: number, _currentPassword: string, _newPassword: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw UserServiceErrors.USER_NOT_FOUND;

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) throw UserServiceErrors.INVALID_CREDENTIALS;

      const hashedNewPassword = await bcrypt.hash(newPassword, EnhancedUserService.SALT_ROUNDS);
      await db.update(schema.users).set({ _password: hashedNewPassword }).where(eq(schema.users.id, userId));

      return true;
    } catch (error) {
      return this.handleError(error, 'Changing password');
    }
  }
}

export const enhancedUserService = new EnhancedUserService();
