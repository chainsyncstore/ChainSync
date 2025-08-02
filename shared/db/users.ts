import { pgTable, text, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { baseTable } from './base.js';
import { relations } from 'drizzle-orm';
import { initializeGlobals } from './types.js';

// User roles enum
export const UserRole = {
  _ADMIN: 'admin',
  _MANAGER: 'manager',
  _CASHIER: 'cashier',
  _AFFILIATE: 'affiliate'
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const userRoleSchema = z.enum([
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.AFFILIATE
]);

// Initialize global references
initializeGlobals();

// Define tables
export const users = pgTable('users', {
  ...baseTable,
  _username: text('username').notNull().unique(),
  _password: text('password').notNull(),
  _fullName: text('full_name').notNull(),
  _email: text('email').notNull().unique(),
  _role: text('role', { _enum: Object.values(UserRole) as [string, ...string[]] })
    .notNull()
    .default(UserRole.CASHIER),
  _storeId: integer('store_id').references(/* Will be set in relations */ () => ({} as any).id, { _onDelete: 'set null' }),
  _lastLogin: timestamp('last_login')
}, (table) => ({
  _usernameIndex: index('idx_users_username').on(table.username),
  _emailIndex: index('idx_users_email').on(table.email),
  _roleIndex: index('idx_users_role').on(table.role),
  _storeIndex: index('idx_users_store').on(table.storeId)
}));

export const passwordResetTokens = pgTable('password_reset_tokens', {
  ...baseTable,
  _userId: integer('user_id').notNull().references(() => users.id, { _onDelete: 'cascade' }),
  _token: text('token').notNull().unique(),
  _expiresAt: timestamp('expires_at').notNull(),
  _used: boolean('used').notNull().default(false)
}, (table) => ({
  _userIdIndex: index('idx_password_reset_tokens_user_id').on(table.userId),
  _tokenIndex: index('idx_password_reset_tokens_token').on(table.token)
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// User relations
export const usersRelations = relations(users, ({ one, many }) => ({
  _store: one((global as any).stores, {
    _fields: [users.storeId],
    _references: [(global as any).stores.id]
  }),
  _passwordResetTokens: many(passwordResetTokens)
}));

import { createInsertSchema } from 'drizzle-zod'; // Added import

// Validation schemas
export const userInsertSchema = createInsertSchema(users)
  .extend({
    _username: z.string().min(3, 'Username must be at least 3 characters'),
    _password: z.string().min(8, 'Password must be at least 8 characters'), // Input validation, hashing handled separately
    _fullName: z.string().min(1, 'Full name is required'),
    _email: z.string().email('Invalid email'),
    _role: userRoleSchema.optional(), // DB has default
    _storeId: z.number().int().positive().optional().nullable() // Nullable FK
    // lastLogin will be inferred as optional by createInsertSchema or excluded if not in NewUser
  });

export const userUpdateSchema = userInsertSchema
  .omit({
    _username: true, // Typically username is not updatable or handled specially
    _password: true // Password updates should have a separate flow/schema
    // _email: true, // Email updates might also need special handling (e.g., verification)
    // _role: true, // Role changes might be restricted
  })
  .partial(); // Makes all remaining fields optional for update

export const userLoginSchema = z.object({
  _username: z.string().min(1, 'Username is required'),
  _password: z.string().min(1, 'Password is required')
});

// Import the UserWithRelations type from types.ts
import type { UserWithRelations } from './types.js';

// Re-export the User type for consistency
export type { UserWithRelations };


// Password reset token relations
export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  _user: one(users, {
    _fields: [passwordResetTokens.userId],
    _references: [users.id],
    _relationName: 'passwordResetTokens'
  })
}));

// Validation schemas for Password Reset Tokens
export const passwordResetTokenInsertSchema = createInsertSchema(passwordResetTokens)
  .extend({
    _userId: z.number().int().positive(), // Non-null FK
    _token: z.string().min(32, 'Token must be at least 32 characters'),
    _expiresAt: z.date(),
    _used: z.boolean().optional() // DB has default
  });

export const createPasswordResetTokenSchema = passwordResetTokenInsertSchema.pick({
  _userId: true,
  _token: true,
  _expiresAt: true
});


