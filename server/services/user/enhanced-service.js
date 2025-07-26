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
exports.enhancedUserService = exports.EnhancedUserService = void 0;
const enhanced_service_1 = require("../base/enhanced-service");
const types_1 = require("./types");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../../database"));
const schema = __importStar(require("@shared/schema"));
const schema_validation_1 = require("@shared/schema-validation");
const bcrypt = __importStar(require("bcrypt"));
class EnhancedUserService extends enhanced_service_1.EnhancedBaseService {
    async resetPassword(token, newPassword) {
        // TODO: Implement password reset logic
        throw new Error('Not implemented');
    }
    async requestPasswordReset(email) {
        // TODO: Implement password reset request logic
        throw new Error('Not implemented');
    }
    async createUser(params) {
        try {
            const existingUsername = await database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.name, params.username) });
            if (existingUsername)
                throw types_1.UserServiceErrors.DUPLICATE_USERNAME;
            const existingEmail = await database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.email, params.email) });
            if (existingEmail)
                throw types_1.UserServiceErrors.DUPLICATE_EMAIL;
            const hashedPassword = await bcrypt.hash(params.password, EnhancedUserService.SALT_ROUNDS);
            const userData = { ...params, password: hashedPassword };
            const validatedData = schema_validation_1.userValidation.insert.parse(userData);
            const [user] = await database_1.default.insert(schema.users).values(validatedData).returning();
            return user;
        }
        catch (error) {
            if (error instanceof schema_validation_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            return this.handleError(error, 'Creating user');
        }
    }
    async updateUser(userId, params) {
        try {
            const existingUser = await database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.id, userId) });
            if (!existingUser)
                throw types_1.UserServiceErrors.USER_NOT_FOUND;
            if (params.username && params.username !== existingUser.name) {
                const existingUsername = await database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.name, params.username) });
                if (existingUsername)
                    throw types_1.UserServiceErrors.DUPLICATE_USERNAME;
            }
            if (params.email && params.email !== existingUser.email) {
                const existingEmail = await database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.email, params.email) });
                if (existingEmail)
                    throw types_1.UserServiceErrors.DUPLICATE_EMAIL;
            }
            const updateData = { ...params, updatedAt: new Date() };
            const validatedData = schema_validation_1.userValidation.update.parse(updateData);
            const [updatedUser] = await database_1.default.update(schema.users).set(validatedData).where((0, drizzle_orm_1.eq)(schema.users.id, userId)).returning();
            return updatedUser;
        }
        catch (error) {
            if (error instanceof schema_validation_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            return this.handleError(error, 'Updating user');
        }
    }
    async deleteUser(userId) {
        try {
            const result = await database_1.default.delete(schema.users).where((0, drizzle_orm_1.eq)(schema.users.id, userId)).returning({ id: schema.users.id });
            if (result.length === 0)
                throw types_1.UserServiceErrors.USER_NOT_FOUND;
            return true;
        }
        catch (error) {
            return this.handleError(error, 'Deleting user');
        }
    }
    async getUserById(userId) {
        try {
            return await database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.id, userId), with: { store: true } });
        }
        catch (error) {
            return this.handleError(error, 'Getting user by ID');
        }
    }
    async getUserByUsername(username) {
        try {
            return await database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.name, username), with: { store: true } });
        }
        catch (error) {
            return this.handleError(error, 'Getting user by username');
        }
    }
    async getUserByEmail(email) {
        try {
            return await database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.email, email), with: { store: true } });
        }
        catch (error) {
            return this.handleError(error, 'Getting user by email');
        }
    }
    async validateCredentials(username, password) {
        try {
            const user = await this.getUserByUsername(username);
            if (!user)
                return null;
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid)
                return null;
            return user;
        }
        catch (error) {
            return this.handleError(error, 'Validating credentials');
        }
    }
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await this.getUserById(userId);
            if (!user)
                throw types_1.UserServiceErrors.USER_NOT_FOUND;
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid)
                throw types_1.UserServiceErrors.INVALID_CREDENTIALS;
            const hashedNewPassword = await bcrypt.hash(newPassword, EnhancedUserService.SALT_ROUNDS);
            await database_1.default.update(schema.users).set({ password: hashedNewPassword }).where((0, drizzle_orm_1.eq)(schema.users.id, userId));
            return true;
        }
        catch (error) {
            return this.handleError(error, 'Changing password');
        }
    }
}
exports.EnhancedUserService = EnhancedUserService;
EnhancedUserService.SALT_ROUNDS = 10;
exports.enhancedUserService = new EnhancedUserService();
