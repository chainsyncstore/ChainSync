import { config } from 'dotenv';
import { z } from 'zod';

// Explicitly load .env.test during Jest tests
if (process.env.NODE_ENV === 'test') {
  config({ path: '.env.test' });
} else {
  config();
}

// Environment variables schema
const envSchema = z.object({
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database Configuration
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database connection').describe('PostgreSQL connection string'),

  // Session & Authentication
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),
  SESSION_COOKIE_NAME: z.string().default('chainSyncSession'),
  SESSION_COOKIE_MAX_AGE: z.coerce.number().default(86400000), // 24 hours in ms
  SESSION_COOKIE_SECURE: z.boolean().default(false),
  SESSION_COOKIE_HTTP_ONLY: z.boolean().default(true),
  SESSION_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),

  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // Security Configuration
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15000), // 15 seconds
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // CORS Configuration
  ALLOWED_ORIGINS: z.string().transform(str => str.split(',')),
  ALLOWED_METHODS: z.string().default('GET,HEAD,PUT,PATCH,POST,DELETE'),
  ALLOWED_HEADERS: z.string().default('Content-Type,Authorization,X-Requested-With'),

  // Payment Gateway Configuration (Optional)
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),

  // AI & Cloud Services (Optional)
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Cache & Performance (Optional)
  REDIS_URL: z.string().optional(),
  CACHE_TTL: z.coerce.number().default(3600),

  // Logging & Monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // File Upload & Storage
  MAX_UPLOAD_SIZE: z.coerce.number().default(10485760), // 10MB default
  UPLOAD_DIR: z.string().default('uploads'),
  STORAGE_PATH: z.string().default('storage')
});

// Validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsedEnv.data;

// Helper function to validate required environment variables
export function validateRequiredEnvVars() {
  if (env.NODE_ENV === 'production') {
    const requiredVars = ['SESSION_SECRET', 'DATABASE_URL', 'JWT_SECRET'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables in production: ${missingVars.join(', ')}`);
    }
  }
}

export { envSchema };
export type EnvConfig = z.infer<typeof envSchema>;
