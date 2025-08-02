import { users } from '@shared/schema';
import { InferSelectModel } from 'drizzle-orm';

export type SelectUser = InferSelectModel<typeof users>;

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  CUSTOMER = 'customer'
}

export interface CreateUserParams {
  _username: string;
  _password: string;
  _fullName: string;
  _email: string;
  _role: UserRole;
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
  _USER_NOT_FOUND: Error;
  _DUPLICATE_USERNAME: Error;
  _DUPLICATE_EMAIL: Error;
  _INVALID_CREDENTIALS: Error;
  _PASSWORD_RESET_EXPIRED: Error;
  _PASSWORD_RESET_USED: Error;
  _PASSWORD_RESET_NOT_FOUND: Error;
}

export const _UserServiceErrors: UserServiceErrors = {
  _USER_NOT_FOUND: new Error('User not found'),
  _DUPLICATE_USERNAME: new Error('Username already exists'),
  _DUPLICATE_EMAIL: new Error('Email already exists'),
  _INVALID_CREDENTIALS: new Error('Invalid username or password'),
  _PASSWORD_RESET_EXPIRED: new Error('Password reset token has expired'),
  _PASSWORD_RESET_USED: new Error('Password reset token has already been used'),
  _PASSWORD_RESET_NOT_FOUND: new Error('Password reset token not found')
};

export interface IUserService {
  createUser(_params: CreateUserParams): Promise<SelectUser>;
  updateUser(_userId: number, _params: UpdateUserParams): Promise<SelectUser>;
  deleteUser(_userId: number): Promise<boolean>;
  getUserById(_userId: number): Promise<SelectUser | null>;
  getUserByUsername(_username: string): Promise<SelectUser | null>;
  getUserByEmail(_email: string): Promise<SelectUser | null>;
  validateCredentials(_username: string, _password: string): Promise<SelectUser | null>;
  changePassword(_userId: number, _currentPassword: string, _newPassword: string): Promise<boolean>;
  resetPassword(_token: string, _newPassword: string): Promise<boolean>;
  requestPasswordReset(_email: string): Promise<string>;
}
