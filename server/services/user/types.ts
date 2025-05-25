/**
 * User Service Types
 * 
 * This file defines the interfaces and types for the user service.
 */

import * as schema from '@shared/schema';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  CUSTOMER = 'customer'
}

export interface CreateUserParams {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: UserRole;
  storeId?: number;
}

export interface UpdateUserParams {
  username?: string;
  fullName?: string;
  email?: string;
  role?: UserRole;
  storeId?: number;
}

export interface UserServiceErrors {
  USER_NOT_FOUND: Error;
  DUPLICATE_USERNAME: Error;
  DUPLICATE_EMAIL: Error;
  INVALID_CREDENTIALS: Error;
  PASSWORD_RESET_EXPIRED: Error;
  PASSWORD_RESET_USED: Error;
  PASSWORD_RESET_NOT_FOUND: Error;
}

export const UserServiceErrors: UserServiceErrors = {
  USER_NOT_FOUND: new Error("User not found"),
  DUPLICATE_USERNAME: new Error("Username already exists"),
  DUPLICATE_EMAIL: new Error("Email already exists"),
  INVALID_CREDENTIALS: new Error("Invalid username or password"),
  PASSWORD_RESET_EXPIRED: new Error("Password reset token has expired"),
  PASSWORD_RESET_USED: new Error("Password reset token has already been used"),
  PASSWORD_RESET_NOT_FOUND: new Error("Password reset token not found")
};

export interface IUserService {
  createUser(params: CreateUserParams): Promise<schema.User>;
  updateUser(userId: number, params: UpdateUserParams): Promise<schema.User>;
  deleteUser(userId: number): Promise<boolean>;
  getUserById(userId: number): Promise<schema.User | null>;
  getUserByUsername(username: string): Promise<schema.User | null>;
  getUserByEmail(email: string): Promise<schema.User | null>;
  validateCredentials(username: string, password: string): Promise<schema.User | null>;
  changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
  requestPasswordReset(email: string): Promise<string>;
}
