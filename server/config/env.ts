import { config } from 'dotenv';
import { z } from 'zod';

config();

// Environment variables schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database connection').describe('PostgreSQL connection string'),
  SESSION_SECRET: z.string(),
  SESSION_COOKIE_NAME: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('24h'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  MAX_UPLOAD_SIZE: z.string().transform(Number).default('10485760'), // 10MB default
  UPLOAD_DIR: z.string().default('uploads'),
  ALLOWED_ORIGINS: z.string(),
  // Payment gateway keys - optional
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),
  // AI/Cloud keys - optional
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  // Cache - optional
  REDIS_URL: z.string().optional(),
  CACHE_TTL: z.string().transform(Number).default('3600'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes in milliseconds
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100')
});

// Validate environment variables
const env = envSchema.parse(process.env);

export { env, envSchema };
export type EnvConfig = z.infer<typeof envSchema>;
