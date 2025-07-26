"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const drizzle_orm_1 = require("drizzle-orm");
const service_js_1 = require("../base/service.js");
const index_js_1 = require("../../../db/index.js");
const schema = __importStar(require("../../../shared/schema.js"));
const schema_validation_js_1 = require("../../../shared/schema-validation.js");
const errors_js_1 = require("../../../shared/types/errors.js");
class UserService extends service_js_1.BaseService {
    async createUser(params) {
        try {
            const validatedData = schema_validation_js_1.userValidation.insert.parse(params);
            const existingUser = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.users.email, validatedData.email)
            });
            if (existingUser) {
                throw new errors_js_1.AppError('User with this email already exists', errors_js_1.ErrorCode.DUPLICATE_ENTRY, errors_js_1.ErrorCategory.VALIDATION);
            }
            const hashedPassword = await bcrypt_1.default.hash(validatedData.password, UserService.SALT_ROUNDS);
            const [user] = await index_js_1.db
                .insert(schema.users)
                .values({
                name: validatedData.fullName,
                email: validatedData.email,
                password: hashedPassword,
                role: validatedData.role,
            })
                .returning();
            return user;
        }
        catch (error) {
            if (error instanceof schema_validation_js_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            throw this.handleError(error, 'Creating user');
        }
    }
    async updateUser(userId, params) {
        try {
            const validatedData = schema_validation_js_1.userValidation.update.parse(params);
            const existingUser = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.users.id, userId)
            });
            if (!existingUser) {
                throw new errors_js_1.AppError('User not found', errors_js_1.ErrorCode.NOT_FOUND, errors_js_1.ErrorCategory.VALIDATION);
            }
            const [updatedUser] = await index_js_1.db
                .update(schema.users)
                .set({
                name: validatedData.fullName,
                email: validatedData.email,
                role: validatedData.role,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema.users.id, userId))
                .returning();
            return updatedUser;
        }
        catch (error) {
            if (error instanceof schema_validation_js_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            throw this.handleError(error, 'Updating user');
        }
    }
    async deleteUser(userId) {
        try {
            const existingUser = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.users.id, userId)
            });
            if (!existingUser) {
                throw new errors_js_1.AppError('User not found', errors_js_1.ErrorCode.NOT_FOUND, errors_js_1.ErrorCategory.VALIDATION);
            }
            await index_js_1.db
                .update(schema.users)
                .set({
                isActive: false,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema.users.id, userId));
            return true;
        }
        catch (error) {
            throw this.handleError(error, 'Deleting user');
        }
    }
    async getUserById(userId) {
        try {
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.users.id, userId), (0, drizzle_orm_1.eq)(schema.users.isActive, true))
            });
            return user || null;
        }
        catch (error) {
            throw this.handleError(error, 'Getting user by ID');
        }
    }
    async getUserByUsername(username) {
        try {
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.users.name, username), (0, drizzle_orm_1.eq)(schema.users.isActive, true))
            });
            return user || null;
        }
        catch (error) {
            throw this.handleError(error, 'Getting user by username');
        }
    }
    async getUserByEmail(email) {
        try {
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.users.email, email), (0, drizzle_orm_1.eq)(schema.users.isActive, true))
            });
            return user || null;
        }
        catch (error) {
            throw this.handleError(error, 'Getting user by email');
        }
    }
    async validateCredentials(username, password) {
        try {
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.users.name, username), (0, drizzle_orm_1.eq)(schema.users.isActive, true))
            });
            if (!user) {
                return null;
            }
            const isValidPassword = await bcrypt_1.default.compare(password, user.password);
            if (!isValidPassword) {
                return null;
            }
            return user;
        }
        catch (error) {
            throw this.handleError(error, 'Validating credentials');
        }
    }
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.users.id, userId), (0, drizzle_orm_1.eq)(schema.users.isActive, true))
            });
            if (!user) {
                throw new errors_js_1.AppError('User not found', errors_js_1.ErrorCode.NOT_FOUND, errors_js_1.ErrorCategory.VALIDATION);
            }
            const isValidPassword = await bcrypt_1.default.compare(currentPassword, user.password);
            if (!isValidPassword) {
                throw new errors_js_1.AppError('Current password is incorrect', errors_js_1.ErrorCode.INVALID_CREDENTIALS, errors_js_1.ErrorCategory.VALIDATION);
            }
            const validatedData = schema_validation_js_1.userValidation.passwordReset.parse({ password: newPassword, confirmPassword: newPassword });
            const hashedPassword = await bcrypt_1.default.hash(validatedData.password, UserService.SALT_ROUNDS);
            await index_js_1.db
                .update(schema.users)
                .set({
                password: hashedPassword,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema.users.id, userId));
            return true;
        }
        catch (error) {
            if (error instanceof schema_validation_js_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            throw this.handleError(error, 'Changing password');
        }
    }
    async requestPasswordReset(email) {
        try {
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.users.email, email), (0, drizzle_orm_1.eq)(schema.users.isActive, true))
            });
            if (!user) {
                return crypto_1.default.randomBytes(32).toString('hex');
            }
            const token = crypto_1.default.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour
            await index_js_1.db
                .insert(schema.passwordResetTokens)
                .values({
                userId: user.id,
                token,
                expiresAt
            });
            return token;
        }
        catch (error) {
            throw this.handleError(error, 'Requesting password reset');
        }
    }
    async resetPassword(token, newPassword) {
        try {
            const resetToken = await index_js_1.db.query.passwordResetTokens.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.passwordResetTokens.token, token), (0, drizzle_orm_1.gt)(schema.passwordResetTokens.expiresAt, new Date())),
                with: {
                    user: true
                }
            });
            if (!resetToken) {
                throw new errors_js_1.AppError('Invalid or expired reset token', errors_js_1.ErrorCode.INVALID_TOKEN, errors_js_1.ErrorCategory.VALIDATION);
            }
            const validatedData = schema_validation_js_1.userValidation.passwordReset.parse({ password: newPassword, confirmPassword: newPassword });
            const hashedPassword = await bcrypt_1.default.hash(validatedData.password, UserService.SALT_ROUNDS);
            await index_js_1.db
                .update(schema.users)
                .set({
                password: hashedPassword,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema.users.id, resetToken.userId));
            await index_js_1.db
                .delete(schema.passwordResetTokens)
                .where((0, drizzle_orm_1.eq)(schema.passwordResetTokens.id, resetToken.id));
            return true;
        }
        catch (error) {
            if (error instanceof schema_validation_js_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            throw this.handleError(error, 'Resetting password');
        }
    }
}
exports.UserService = UserService;
UserService.SALT_ROUNDS = 10;
