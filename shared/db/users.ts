import { pgTable, text, boolean, integer, timestamp, unique, primaryKey, foreignKey, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { baseTable, timestampsSchema, softDeleteSchema, commonValidators } from "./base";
import { stores } from "./stores";

// User roles
export const userRoles = z.enum(["admin", "manager", "cashier", "affiliate"]);

// User table
export const users = pgTable("users", {
  ...baseTable,
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("cashier"),
  storeId: integer("store_id").references(() => stores.id),
  lastLogin: timestamp("last_login"),
  usernameIndex: index("idx_users_username").on((users) => users.username),
  emailIndex: index("idx_users_email").on((users) => users.email),
  roleIndex: index("idx_users_role").on((users) => users.role)
});

// Validation schemas
export const userInsertSchema = createInsertSchema(users, {
  username: commonValidators.name,
  password: (schema) => schema.string().min(8, "Password must be at least 8 characters"),
  fullName: commonValidators.name,
  email: commonValidators.email,
  role: (schema) => schema.enum(userRoles.enum),
  storeId: (schema) => schema.number().int().positive(),
});

export const userUpdateSchema = userInsertSchema.omit({
  username: true,
  password: true,
});

// Type exports
export type User = z.infer<typeof createSelectSchema(users)>;
export type UserInsert = z.infer<typeof userInsertSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
  passwordResetTokens: many(() => passwordResetTokens),
}));

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  ...baseTable,
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  userIdIndex: index("idx_password_reset_tokens_user_id").on((table) => table.userId),
  tokenIndex: index("idx_password_reset_tokens_token").on((table) => table.token)
});

export const passwordResetTokenInsertSchema = createInsertSchema(passwordResetTokens, {
  userId: (schema) => schema.number().int().positive(),
  token: (schema) => schema.string().min(32, "Token must be at least 32 characters"),
  expiresAt: (schema) => schema.date(),
});

export type PasswordResetToken = z.infer<typeof createSelectSchema(passwordResetTokens)>;
export type PasswordResetTokenInsert = z.infer<typeof passwordResetTokenInsertSchema>;

// Relations for password reset tokens
export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));
