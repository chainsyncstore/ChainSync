import { pgTable, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { baseTable } from "./base";
import { relations } from "drizzle-orm";
import { initializeGlobals } from "./types";

// User roles enum
export const UserRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  CASHIER: "cashier",
  AFFILIATE: "affiliate", // Kept affiliate as it's in schema
  VIEWER: "viewer" // Added viewer from auth service type
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

// User statuses enum
export const UserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  PENDING_VERIFICATION: "pending_verification"
} as const;

export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

export const userRoleSchema = z.enum([
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.AFFILIATE,
  UserRole.VIEWER
]);

// Initialize global references
initializeGlobals();

// Define tables
export const users = pgTable("users", {
  ...baseTable,
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: Object.values(UserRole) as [UserRole, ...UserRole[]] }) // Use UserRole type for enum values
    .notNull()
    .default(UserRole.CASHIER),
  status: text("status", { enum: Object.values(UserStatus) as [UserStatus, ...UserStatus[]] }) // Added status field
    .notNull()
    .default(UserStatus.PENDING_VERIFICATION),
  storeId: integer("store_id").references(/* Will be set in relations */ () => (global as any).stores.id, { onDelete: "set null" }), // Assuming global.stores.id
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").notNull().default(true), // This might be redundant if 'status' field is used actively
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
}, (table) => ({
  usernameIndex: index("idx_users_username").on(table.username),
  emailIndex: index("idx_users_email").on(table.email),
  roleIndex: index("idx_users_role").on(table.role),
  storeIndex: index("idx_users_store").on(table.storeId)
}));

export const passwordResetTokens = pgTable("password_reset_tokens", {
  ...baseTable,
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
}, (table) => ({
  userIdIndex: index("idx_password_reset_tokens_user_id").on(table.userId),
  tokenIndex: index("idx_password_reset_tokens_token").on(table.token)
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// User relations
export const usersRelations = relations(users, ({ one, many }) => ({
  store: one((global as any).stores, {
    fields: [users.storeId],
    references: [(global as any).stores.id],
  }),
  passwordResetTokens: many(passwordResetTokens),
}));

import { createInsertSchema } from "drizzle-zod"; // Added import

// Validation schemas
export const userInsertSchema = createInsertSchema(users)
  .extend({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"), // Input validation, hashing handled separately
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email"),
    role: userRoleSchema.optional(), // DB has default
    storeId: z.number().int().positive().optional().nullable(), // Nullable FK
    // lastLogin will be inferred as optional by createInsertSchema or excluded if not in NewUser
  });

export const userUpdateSchema = userInsertSchema
  .omit({ 
    username: true, // Typically username is not updatable or handled specially
    password: true, // Password updates should have a separate flow/schema
    // email: true, // Email updates might also need special handling (e.g., verification)
    // role: true, // Role changes might be restricted
  })
  .partial(); // Makes all remaining fields optional for update

export const userLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Import the UserWithRelations type from types.ts
import type { UserWithRelations } from "./types";

// Re-export the User type for consistency
export type { UserWithRelations };





// Password reset token relations
export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
    relationName: "passwordResetTokens"
  }),
}));

// Validation schemas for Password Reset Tokens
export const passwordResetTokenInsertSchema = createInsertSchema(passwordResetTokens)
  .extend({
    userId: z.number().int().positive(), // Non-null FK
    token: z.string().min(32, "Token must be at least 32 characters"),
    expiresAt: z.date(),
    used: z.boolean().optional(), // DB has default
  });

export const createPasswordResetTokenSchema = passwordResetTokenInsertSchema.pick({
  userId: true,
  token: true,
  expiresAt: true
});
