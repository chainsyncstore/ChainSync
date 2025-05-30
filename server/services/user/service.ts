/**
 * User Service Implementation
 * 
 * This file implements a standardized user service with proper schema validation
 * and error handling according to our schema style guide.
 */

import { BaseService } from '../base/service';
import { IUserService, UserServiceErrors, CreateUserParams, UpdateUserParams, UserRole } from './types';
import { db } from '@db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { userValidation, SchemaValidationError } from '@shared/schema-validation';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export class UserService extends BaseService implements IUserService {
  private static readonly SALT_ROUNDS = 10;
  private static readonly TOKEN_EXPIRY_HOURS = 24;
  
  /**
   * Create a new user with validated data
   */
  async createUser(params: CreateUserParams): Promise<schema.User> {
    try {
      // Check for duplicate username
      const existingUsername = await db.query.users.findFirst({
        where: eq(schema.users.username, params.username)
      });
      
      if (existingUsername) {
        throw UserServiceErrors.DUPLICATE_USERNAME;
      }
      
      // Check for duplicate email
      const existingEmail = await db.query.users.findFirst({
        where: eq(schema.users.email, params.email)
      });
      
      if (existingEmail) {
        throw UserServiceErrors.DUPLICATE_EMAIL;
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(params.password, UserService.SALT_ROUNDS);
      
      // Prepare user data with camelCase field names (will be converted to snake_case in DB)
      const userData = {
        username: params.username,
        password: hashedPassword,
        fullName: params.fullName,
        email: params.email,
        role: params.role,
        storeId: params.storeId,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Validate with our schema validation
      const validatedData = userValidation.insert(userData);
      
      // Insert validated data
      const [user] = await db.insert(schema.users)
        .values(validatedData)
        .returning();
      
      return user;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating user');
    }
  }
  
  /**
   * Update a user with validated data
   */
  async updateUser(userId: number, params: UpdateUserParams): Promise<schema.User> {
    try {
      // Verify user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });
      
      if (!existingUser) {
        throw UserServiceErrors.USER_NOT_FOUND;
      }
      
      // Check for duplicate username if being updated
      if (params.username && params.username !== existingUser.username) {
        const existingUsername = await db.query.users.findFirst({
          where: eq(schema.users.username, params.username)
        });
        
        if (existingUsername) {
          throw UserServiceErrors.DUPLICATE_USERNAME;
        }
      }
      
      // Check for duplicate email if being updated
      if (params.email && params.email !== existingUser.email) {
        const existingEmail = await db.query.users.findFirst({
          where: eq(schema.users.email, params.email)
        });
        
        if (existingEmail) {
          throw UserServiceErrors.DUPLICATE_EMAIL;
        }
      }
      
      // Prepare update data with proper camelCase field names
      const updateData = {
        ...params,
        updatedAt: new Date()
      };
      
      // Validate the update data
      const validatedData = userValidation.update(updateData);
      
      // Update with validated data
      const [updatedUser] = await db.update(schema.users)
        .set(validatedData)
        .where(eq(schema.users.id, userId))
        .returning();
      
      return updatedUser;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating user');
    }
  }
  
  /**
   * Delete a user by ID
   */
  async deleteUser(userId: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.users)
        .where(eq(schema.users.id, userId))
        .returning({ id: schema.users.id });
      
      if (result.length === 0) {
        throw UserServiceErrors.USER_NOT_FOUND;
      }
      
      return true;
    } catch (error: unknown) {
      return this.handleError(error, 'Deleting user');
    }
  }
  
  /**
   * Get a user by ID
   */
  async getUserById(userId: number): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
        with: {
          store: true
        }
      });
      
      return user;
    } catch (error: unknown) {
      return this.handleError(error, 'Getting user by ID');
    }
  }
  
  /**
   * Get a user by username
   */
  async getUserByUsername(username: string): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
        with: {
          store: true
        }
      });
      
      return user;
    } catch (error: unknown) {
      return this.handleError(error, 'Getting user by username');
    }
  }
  
  /**
   * Get a user by email
   */
  async getUserByEmail(email: string): Promise<schema.User | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email),
        with: {
          store: true
        }
      });
      
      return user;
    } catch (error: unknown) {
      return this.handleError(error, 'Getting user by email');
    }
  }
  
  /**
   * Validate user credentials
   */
  async validateCredentials(username: string, password: string): Promise<schema.User | null> {
    try {
      const user = await this.getUserByUsername(username);
      
      if (!user) {
        throw UserServiceErrors.INVALID_CREDENTIALS;
      }
      
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        throw UserServiceErrors.INVALID_CREDENTIALS;
      }
      
      // Update last login timestamp
      await db.update(schema.users)
        .set({ lastLogin: new Date(), updatedAt: new Date() })
        .where(eq(schema.users.id, user.id));
      
      return user;
    } catch (error: unknown) {
      return this.handleError(error, 'Validating credentials');
    }
  }
  
  /**
   * Change a user's password
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      
      if (!user) {
        throw UserServiceErrors.USER_NOT_FOUND;
      }
      
      // Validate current password
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      
      if (!passwordMatch) {
        throw UserServiceErrors.INVALID_CREDENTIALS;
      }
      
      // Validate the new password
      const passwordData = {
        password: newPassword,
        confirmPassword: newPassword
      };
      
      userValidation.passwordReset(passwordData);
      
      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, UserService.SALT_ROUNDS);
      
      await db.update(schema.users)
        .set({ 
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, userId));
      
      return true;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Changing password');
    }
  }
  
  /**
   * Request a password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    try {
      const user = await this.getUserByEmail(email);
      
      if (!user) {
        throw UserServiceErrors.USER_NOT_FOUND;
      }
      
      // Generate a random token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + UserService.TOKEN_EXPIRY_HOURS);
      
      // Save token to database
      await db.insert(schema.passwordResetTokens)
        .values({
          userId: user.id,
          token,
          expiresAt,
          used: false,
          createdAt: new Date()
        });
      
      return token;
    } catch (error: unknown) {
      return this.handleError(error, 'Requesting password reset');
    }
  }
  
  /**
   * Reset a password using a token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Find the token
      const resetToken = await db.query.passwordResetTokens.findFirst({
        where: eq(schema.passwordResetTokens.token, token)
      });
      
      if (!resetToken) {
        throw UserServiceErrors.PASSWORD_RESET_NOT_FOUND;
      }
      
      // Check if token is used
      if (resetToken.used) {
        throw UserServiceErrors.PASSWORD_RESET_USED;
      }
      
      // Check if token is expired
      if (resetToken.expiresAt < new Date()) {
        throw UserServiceErrors.PASSWORD_RESET_EXPIRED;
      }
      
      // Validate the new password
      const passwordData = {
        password: newPassword,
        confirmPassword: newPassword
      };
      
      userValidation.passwordReset(passwordData);
      
      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, UserService.SALT_ROUNDS);
      
      await db.update(schema.users)
        .set({ 
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, resetToken.userId));
      
      // Mark token as used
      await db.update(schema.passwordResetTokens)
        .set({ used: true })
        .where(eq(schema.passwordResetTokens.id, resetToken.id));
      
      return true;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Resetting password');
    }
  }
}
