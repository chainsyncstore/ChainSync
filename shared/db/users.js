"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPasswordResetTokenSchema = exports.passwordResetTokenInsertSchema = exports.passwordResetTokensRelations = exports.userLoginSchema = exports.userUpdateSchema = exports.userInsertSchema = exports.usersRelations = exports.passwordResetTokens = exports.users = exports.userRoleSchema = exports.UserRole = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const zod_1 = require("zod");
const base_js_1 = require("./base.js");
const drizzle_orm_1 = require("drizzle-orm");
const types_js_1 = require("./types.js");
// User roles enum
exports.UserRole = {
    ADMIN: "admin",
    MANAGER: "manager",
    CASHIER: "cashier",
    AFFILIATE: "affiliate"
};
exports.userRoleSchema = zod_1.z.enum([
    exports.UserRole.ADMIN,
    exports.UserRole.MANAGER,
    exports.UserRole.CASHIER,
    exports.UserRole.AFFILIATE
]);
// Initialize global references
(0, types_js_1.initializeGlobals)();
// Define tables
exports.users = (0, pg_core_1.pgTable)("users", {
    ...base_js_1.baseTable,
    username: (0, pg_core_1.text)("username").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    role: (0, pg_core_1.text)("role", { enum: Object.values(exports.UserRole) })
        .notNull()
        .default(exports.UserRole.CASHIER),
    storeId: (0, pg_core_1.integer)("store_id").references(/* Will be set in relations */ () => ({}.id), { onDelete: "set null" }),
    lastLogin: (0, pg_core_1.timestamp)("last_login"),
}, (table) => ({
    usernameIndex: (0, pg_core_1.index)("idx_users_username").on(table.username),
    emailIndex: (0, pg_core_1.index)("idx_users_email").on(table.email),
    roleIndex: (0, pg_core_1.index)("idx_users_role").on(table.role),
    storeIndex: (0, pg_core_1.index)("idx_users_store").on(table.storeId)
}));
exports.passwordResetTokens = (0, pg_core_1.pgTable)("password_reset_tokens", {
    ...base_js_1.baseTable,
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    token: (0, pg_core_1.text)("token").notNull().unique(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    used: (0, pg_core_1.boolean)("used").notNull().default(false),
}, (table) => ({
    userIdIndex: (0, pg_core_1.index)("idx_password_reset_tokens_user_id").on(table.userId),
    tokenIndex: (0, pg_core_1.index)("idx_password_reset_tokens_token").on(table.token)
}));
// User relations
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ one, many }) => ({
    store: one(global.stores, {
        fields: [exports.users.storeId],
        references: [global.stores.id],
    }),
    passwordResetTokens: many(exports.passwordResetTokens),
}));
const drizzle_zod_1 = require("drizzle-zod"); // Added import
// Validation schemas
exports.userInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users)
    .extend({
    username: zod_1.z.string().min(3, "Username must be at least 3 characters"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"), // Input validation, hashing handled separately
    fullName: zod_1.z.string().min(1, "Full name is required"),
    email: zod_1.z.string().email("Invalid email"),
    role: exports.userRoleSchema.optional(), // DB has default
    storeId: zod_1.z.number().int().positive().optional().nullable(), // Nullable FK
    // lastLogin will be inferred as optional by createInsertSchema or excluded if not in NewUser
});
exports.userUpdateSchema = exports.userInsertSchema
    .omit({
    username: true, // Typically username is not updatable or handled specially
    password: true, // Password updates should have a separate flow/schema
    // email: true, // Email updates might also need special handling (e.g., verification)
    // role: true, // Role changes might be restricted
})
    .partial(); // Makes all remaining fields optional for update
exports.userLoginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "Username is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
// Password reset token relations
exports.passwordResetTokensRelations = (0, drizzle_orm_1.relations)(exports.passwordResetTokens, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.passwordResetTokens.userId],
        references: [exports.users.id],
        relationName: "passwordResetTokens"
    }),
}));
// Validation schemas for Password Reset Tokens
exports.passwordResetTokenInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.passwordResetTokens)
    .extend({
    userId: zod_1.z.number().int().positive(), // Non-null FK
    token: zod_1.z.string().min(32, "Token must be at least 32 characters"),
    expiresAt: zod_1.z.date(),
    used: zod_1.z.boolean().optional(), // DB has default
});
exports.createPasswordResetTokenSchema = exports.passwordResetTokenInsertSchema.pick({
    userId: true,
    token: true,
    expiresAt: true
});
