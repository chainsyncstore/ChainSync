import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';
// Load .env file only in non-production environments
if (process.env.NODE_ENV !== 'production') {
    loadDotEnv();
}
const EnvSchema = z.object({
    NODE_ENV: z.string().optional().default('development'),
    PORT: z.coerce.number().optional().default(5000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    SESSION_SECRET: z.string(),
    SENTRY_DSN: z.string().url().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    PAYSTACK_SECRET_KEY: z.string().optional(),
    FLUTTERWAVE_SECRET_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    // Add more variables as needed
});
// Parse and validate
const _env = EnvSchema.safeParse(process.env);
if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
}
export const env = _env.data;
// Convenience helpers
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
//# sourceMappingURL=env.js.map