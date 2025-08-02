'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UserServiceErrors = exports.UserRole = void 0;
let UserRole;
(function(UserRole) {
  UserRole['ADMIN'] = 'admin';
  UserRole['MANAGER'] = 'manager';
  UserRole['CASHIER'] = 'cashier';
  UserRole['CUSTOMER'] = 'customer';
})(UserRole || (exports.UserRole = UserRole = {}));
exports.UserServiceErrors = {
  USER_NOT_FOUND: new Error('User not found'),
  DUPLICATE_USERNAME: new Error('Username already exists'),
  DUPLICATE_EMAIL: new Error('Email already exists'),
  INVALID_CREDENTIALS: new Error('Invalid username or password'),
  PASSWORD_RESET_EXPIRED: new Error('Password reset token has expired'),
  PASSWORD_RESET_USED: new Error('Password reset token has already been used'),
  PASSWORD_RESET_NOT_FOUND: new Error('Password reset token not found')
};
