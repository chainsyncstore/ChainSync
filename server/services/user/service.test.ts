/**
 * User Service Tests
 * 
 * This file contains tests for the refactored user service, focusing on
 * validation, error handling, and schema standardization.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserService } from './service';
import { UserServiceErrors, UserRole } from './types';
import { db } from '@db';
import * as schema from '@shared/schema';
import { SchemaValidationError } from '@shared/schema-validation';
import * as bcrypt from 'bcrypt';

// Mock DB and schema validation
jest.mock('@db', () => ({
  query: {
    users: {
      findFirst: jest.fn()
    }
  },
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn()
}));

jest.mock('@shared/schema-validation', () => ({
  userValidation: {
    insert: jest.fn(data => data),
    update: jest.fn(data => data),
    passwordReset: jest.fn(data => data)
  },
  SchemaValidationError: class SchemaValidationError extends Error {
    constructor(message: string, options?: unknown) {
      super(message);
      this.name = 'SchemaValidationError';
    }
    toJSON() {
      return {
        error: this.name,
        message: this.message
      };
    }
  }
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
}));

describe('UserService', () => {
  let userService: UserService;
  
  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });
  
  describe('createUser', () => {
    const validUserData = {
      username: 'testuser',
      password: 'Test@123',
      fullName: 'Test User',
      email: 'test@example.com',
      role: UserRole.CASHIER,
      storeId: 1
    };
    
    it('should create a new user with validated data', async () => {
      // Mock findFirst to return null (no existing user)
      (db.query.users.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Mock returning to return the created user
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { id: 1, ...validUserData, password: 'hashed_password' }
      ]);
      
      const result = await userService.createUser(validUserData);
      
      // Check that validation was called
      expect(require('@shared/schema-validation').userValidation.insert).toHaveBeenCalled();
      
      // Check that password was hashed
      expect(bcrypt.hash).toHaveBeenCalledWith(validUserData.password, 10);
      
      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        username: validUserData.username,
        fullName: validUserData.fullName,
        email: validUserData.email
      }));
    });
    
    it('should throw error when username already exists', async () => {
      // Mock findFirst to return an existing user
      (db.query.users.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 1,
        username: validUserData.username
      });
      
      await expect(userService.createUser(validUserData))
        .rejects.toThrow(UserServiceErrors.DUPLICATE_USERNAME.message);
    });
    
    it('should throw error when email already exists', async () => {
      // Mock findFirst to return null for username check, but an existing user for email check
      (db.query.users.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 1,
          email: validUserData.email
        });
      
      await expect(userService.createUser(validUserData))
        .rejects.toThrow(UserServiceErrors.DUPLICATE_EMAIL.message);
    });
    
    it('should handle validation errors properly', async () => {
      // Mock findFirst to return null (no existing user)
      (db.query.users.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Make validation throw an error
      (require('@shared/schema-validation').userValidation.insert as jest.Mock)
        .mockImplementationOnce(() => {
          throw new SchemaValidationError('Invalid user data');
        });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await expect(userService.createUser(validUserData))
        .rejects.toThrow();
      
      // Check that error was logged
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('validateCredentials', () => {
    it('should validate correct credentials', async () => {
      // Mock getUserByUsername to return a user
      jest.spyOn(userService, 'getUserByUsername').mockResolvedValue({
        id: 1,
        username: 'testuser',
        password: 'hashed_password',
        fullName: 'Test User',
        email: 'test@example.com',
        role: 'cashier'
      } as any);
      
      // Mock db.update for lastLogin update
      (db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn()
        })
      });
      
      const result = await userService.validateCredentials('testuser', 'Test@123');
      
      // Check that password was compared
      expect(bcrypt.compare).toHaveBeenCalledWith('Test@123', 'hashed_password');
      
      // Check result is the user
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        username: 'testuser'
      }));
    });
    
    it('should throw error for invalid username', async () => {
      // Mock getUserByUsername to return null
      jest.spyOn(userService, 'getUserByUsername').mockResolvedValue(null);
      
      await expect(userService.validateCredentials('wronguser', 'Test@123'))
        .rejects.toThrow(UserServiceErrors.INVALID_CREDENTIALS.message);
    });
    
    it('should throw error for incorrect password', async () => {
      // Mock getUserByUsername to return a user
      jest.spyOn(userService, 'getUserByUsername').mockResolvedValue({
        id: 1,
        username: 'testuser',
        password: 'hashed_password'
      } as any);
      
      // Mock bcrypt.compare to return false
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      
      await expect(userService.validateCredentials('testuser', 'WrongPassword'))
        .rejects.toThrow(UserServiceErrors.INVALID_CREDENTIALS.message);
    });
  });
});
