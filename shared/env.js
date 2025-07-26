"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDev = exports.isProd = exports.env = void 0;
const dotenv_1 = require("dotenv");
const zod_1 = require("zod");
// Load .env file only in non-production environments
if (process.env.NODE_ENV !== 'production') {
    (0, dotenv_1.config)();
}
const EnvSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.string().optional().default('development'),
    PORT: zod_1.z.coerce.number().optional().default(5000),
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().url().optional(),
    SESSION_SECRET: zod_1.z.string(),
    SENTRY_DSN: zod_1.z.string().url().optional(),
    STRIPE_SECRET_KEY: zod_1.z.string().optional(),
    PAYSTACK_SECRET_KEY: zod_1.z.string().optional(),
    FLUTTERWAVE_SECRET_KEY: zod_1.z.string().optional(),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    // Add more variables as needed
});
// Parse and validate
const _env = EnvSchema.safeParse(process.env);
if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
}
exports.env = _env.data;
// Convenience helpers
exports.isProd = exports.env.NODE_ENV === 'production';
exports.isDev = exports.env.NODE_ENV === 'development';
