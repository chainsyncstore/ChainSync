"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = exports.env = void 0;
const dotenv_1 = require("dotenv");
const zod_1 = require("zod");
// Explicitly load .env.test during Jest tests
if (process.env.NODE_ENV === 'test') {
    (0, dotenv_1.config)({ path: '.env.test' });
}
else {
    (0, dotenv_1.config)();
}
// Environment variables schema
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().transform(Number).default('3000'),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required for database connection').describe('PostgreSQL connection string'),
    SESSION_SECRET: zod_1.z.string(),
    SESSION_COOKIE_NAME: zod_1.z.string(),
    JWT_SECRET: zod_1.z.string(),
    JWT_EXPIRES_IN: zod_1.z.string().default('24h'),
    REFRESH_TOKEN_EXPIRES_IN: zod_1.z.string().default('7d'),
    MAX_UPLOAD_SIZE: zod_1.z.string().transform(Number).default('10485760'), // 10MB default
    UPLOAD_DIR: zod_1.z.string().default('uploads'),
    ALLOWED_ORIGINS: zod_1.z.string(),
    // Payment gateway keys - optional
    PAYSTACK_SECRET_KEY: zod_1.z.string().optional(),
    PAYSTACK_PUBLIC_KEY: zod_1.z.string().optional(),
    FLUTTERWAVE_SECRET_KEY: zod_1.z.string().optional(),
    FLUTTERWAVE_PUBLIC_KEY: zod_1.z.string().optional(),
    // AI/Cloud keys - optional
    OPENAI_API_KEY: zod_1.z.string().optional(),
    GOOGLE_CLOUD_PROJECT_ID: zod_1.z.string().optional(),
    GOOGLE_APPLICATION_CREDENTIALS: zod_1.z.string().optional(),
    // Cache - optional
    REDIS_URL: zod_1.z.string().optional(),
    CACHE_TTL: zod_1.z.string().transform(Number).default('3600'),
    LOG_LEVEL: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    RATE_LIMIT_WINDOW_MS: zod_1.z.string().transform(Number).default('900000'), // 15 minutes in milliseconds
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.string().transform(Number).default('100')
});
exports.envSchema = envSchema;
// Validate environment variables
const env = envSchema.parse(process.env);
exports.env = env;
