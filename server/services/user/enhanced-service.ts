import { EnhancedBaseService } from '../base/enhanced-service';
import { IUserService, CreateUserParams, UpdateUserParams, UserRole, UserServiceErrors, SelectUser } from './types';
import { eq, and } from 'drizzle-orm';
import db from '../../database';
import * as schema from '@shared/schema';
import { userValidation, SchemaValidationError } from '@shared/schema-validation';
import * as bcrypt from 'bcrypt';

export class EnhancedUserService extends EnhancedBaseService implements IUserService {
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // TODO: Implement password reset logic
    throw new Error('Not implemented');
  }

  async requestPasswordReset(email: string): Promise<string> {
    // TODO: Implement password reset request logic
    throw new Error('Not implemented');
  }
  private static readonly SALT_ROUNDS = 10;

  async createUser(params: CreateUserParams): Promise<SelectUser> {
    try {
      const existingUsername = await db.query.users.findFirst({ where: eq(schema.users.name, params.username) });
      if (existingUsername) throw UserServiceErrors.DUPLICATE_USERNAME;

      const existingEmail = await db.query.users.findFirst({ where: eq(schema.users.email, params.email) });
      if (existingEmail) throw UserServiceErrors.DUPLICATE_EMAIL;

      const hashedPassword = await bcrypt.hash(params.password, EnhancedUserService.SALT_ROUNDS);
      
      const userData = { ...params, password: hashedPassword };
      const validatedData = userValidation.insert.parse(userData);
      
      const [user] = await db.insert(schema.users).values(validatedData).returning();
      return user;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating user');
    }
  }

  async updateUser(userId: number, params: UpdateUserParams): Promise<SelectUser> {
    try {
      const existingUser = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!existingUser) throw UserServiceErrors.USER_NOT_FOUND;

      if (params.username && params.username !== existingUser.name) {
        const existingUsername = await db.query.users.findFirst({ where: eq(schema.users.name, params.username) });
        if (existingUsername) throw UserServiceErrors.DUPLICATE_USERNAME;
      }

      if (params.email && params.email !== existingUser.email) {
        const existingEmail = await db.query.users.findFirst({ where: eq(schema.users.email, params.email) });
        if (existingEmail) throw UserServiceErrors.DUPLICATE_EMAIL;
      }

      const updateData = { ...params, updatedAt: new Date() };
      const validatedData = userValidation.update.parse(updateData);
      const [updatedUser] = await db.update(schema.users).set(validatedData).where(eq(schema.users.id, userId)).returning();
      return updatedUser;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating user');
    }
  }

  async deleteUser(userId: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.users).where(eq(schema.users.id, userId)).returning({ id: schema.users.id });
      if (result.length === 0) throw UserServiceErrors.USER_NOT_FOUND;
      return true;
    } catch (error) {
      return this.handleError(error, 'Deleting user');
    }
  }

  async getUserById(userId: number): Promise<SelectUser | null> {
    try {
      return await db.query.users.findFirst({ where: eq(schema.users.id, userId), with: { store: true } });
    } catch (error) {
      return this.handleError(error, 'Getting user by ID');
    }
  }

  async getUserByUsername(username: string): Promise<SelectUser | null> {
    try {
      return await db.query.users.findFirst({ where: eq(schema.users.name, username), with: { store: true } });
    } catch (error) {
      return this.handleError(error, 'Getting user by username');
    }
  }

  async getUserByEmail(email: string): Promise<SelectUser | null> {
    try {
      return await db.query.users.findFirst({ where: eq(schema.users.email, email), with: { store: true } });
    } catch (error) {
      return this.handleError(error, 'Getting user by email');
    }
  }

  async validateCredentials(username: string, password: string): Promise<SelectUser | null> {
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

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw UserServiceErrors.USER_NOT_FOUND;

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) throw UserServiceErrors.INVALID_CREDENTIALS;

      const hashedNewPassword = await bcrypt.hash(newPassword, EnhancedUserService.SALT_ROUNDS);
      await db.update(schema.users).set({ password: hashedNewPassword }).where(eq(schema.users.id, userId));

      return true;
    } catch (error) {
      return this.handleError(error, 'Changing password');
    }
  }
}

export const enhancedUserService = new EnhancedUserService();
