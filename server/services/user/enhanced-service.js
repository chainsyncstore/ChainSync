'use strict';
import { EnhancedBaseService } from '../base/enhanced-service.js';
import { UserServiceErrors } from './types.js';
import { eq } from 'drizzle-orm';
import database from '../../database.js';
import * as schema from '@shared/schema';
import { userValidation, SchemaValidationError } from '@shared/schema-validation';
import bcrypt from 'bcrypt';
import { logger } from '../../../utils/logger.js';

class EnhancedUserService extends EnhancedBaseService {
  async resetPassword(token, newPassword) {
    // _TODO: Implement password reset logic
    throw new Error('Not implemented');
  }

  async requestPasswordReset(email) {
    // _TODO: Implement password reset request logic
    throw new Error('Not implemented');
  }

  async createUser(params) {
    try {
      const existingUsername = await database.query.users.findFirst({
        _where: eq(schema.users.name, params.username)
      });

      if (existingUsername) {
        throw UserServiceErrors.DUPLICATE_USERNAME;
      }

      const existingEmail = await database.query.users.findFirst({
        _where: eq(schema.users.email, params.email)
      });

      if (existingEmail) {
        throw UserServiceErrors.DUPLICATE_EMAIL;
      }

      const hashedPassword = await bcrypt.hash(
        params.password,
        EnhancedUserService.SALT_ROUNDS
      );

      const userData = { ...params, _password: hashedPassword };
      const validatedData = userValidation.insert.parse(userData);

      const [user] = await database
        .insert(schema.users)
        .values(validatedData)
        .returning();

      return user;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        logger.error(`Validation _error: ${error.message}`, {
          _error: error.toJSON(),
          _context: 'createUser'
        });
      }
      return this.handleError(error, 'Creating user');
    }
  }

  async updateUser(userId, params) {
    try {
      const existingUser = await database.query.users.findFirst({
        _where: eq(schema.users.id, userId)
      });

      if (!existingUser) {
        throw UserServiceErrors.USER_NOT_FOUND;
      }

      if (params.username && params.username !== existingUser.name) {
        const existingUsername = await database.query.users.findFirst({
          _where: eq(schema.users.name, params.username)
        });

        if (existingUsername) {
          throw UserServiceErrors.DUPLICATE_USERNAME;
        }
      }

      if (params.email && params.email !== existingUser.email) {
        const existingEmail = await database.query.users.findFirst({
          _where: eq(schema.users.email, params.email)
        });

        if (existingEmail) {
          throw UserServiceErrors.DUPLICATE_EMAIL;
        }
      }

      const updateData = { ...params, _updatedAt: new Date() };
      const validatedData = userValidation.update.parse(updateData);

      const [updatedUser] = await database
        .update(schema.users)
        .set(validatedData)
        .where(eq(schema.users.id, userId))
        .returning();

      return updatedUser;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        logger.error(`Validation _error: ${error.message}`, {
          _error: error.toJSON(),
          _context: 'updateUser'
        });
      }
      return this.handleError(error, 'Updating user');
    }
  }

  async deleteUser(userId) {
    try {
      const result = await database
        .delete(schema.users)
        .where(eq(schema.users.id, userId))
        .returning({ _id: schema.users.id });

      return result.length > 0;
    } catch (error) {
      return this.handleError(error, 'Deleting user');
    }
  }

  async getUserById(userId) {
    try {
      return await database.query.users.findFirst({
        _where: eq(schema.users.id, userId),
        _with: { _store: true }
      });
    } catch (error) {
      return this.handleError(error, 'Getting user by ID');
    }
  }

  async getUserByUsername(username) {
    try {
      return await database.query.users.findFirst({
        _where: eq(schema.users.name, username),
        _with: { _store: true }
      });
    } catch (error) {
      return this.handleError(error, 'Getting user by username');
    }
  }

  async getUserByEmail(email) {
    try {
      return await database.query.users.findFirst({
        _where: eq(schema.users.email, email),
        _with: { _store: true }
      });
    } catch (error) {
      return this.handleError(error, 'Getting user by email');
    }
  }

  async validateCredentials(username, password) {
    try {
      const user = await database.query.users.findFirst({
        _where: eq(schema.users.name, username)
      });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return null;
      }

      return user;
    } catch (error) {
      return this.handleError(error, 'Validating credentials');
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await database.query.users.findFirst({
        _where: eq(schema.users.id, userId)
      });

      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        throw UserServiceErrors.INVALID_CREDENTIALS;
      }

      const hashedNewPassword = await bcrypt.hash(
        newPassword,
        EnhancedUserService.SALT_ROUNDS
      );

      await database
        .update(schema.users)
        .set({ _password: hashedNewPassword })
        .where(eq(schema.users.id, userId));

      return true;
    } catch (error) {
      return this.handleError(error, 'Changing password');
    }
  }
}

export { EnhancedUserService };
export const enhancedUserService = new EnhancedUserService();
EnhancedUserService.SALT_ROUNDS = 10;
