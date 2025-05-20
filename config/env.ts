import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().default('chainSyncSession'),
  SESSION_COOKIE_MAX_AGE: z.string().transform(Number).default('86400000'), // 24 hours in ms
  SESSION_COOKIE_SECURE: z.boolean().default(false),
  SESSION_COOKIE_HTTP_ONLY: z.boolean().default(true),
  SESSION_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Security
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('15000'), // 15 seconds
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // CORS
  ALLOWED_ORIGINS: z.string().transform(str => str.split(',')),
  ALLOWED_METHODS: z.string().default('GET,HEAD,PUT,PATCH,POST,DELETE'),
  ALLOWED_HEADERS: z.string().default('Content-Type,Authorization,X-Requested-With'),
  
  // Payment
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),
  
  // AI
  OPENAI_API_KEY: z.string().optional(),
  
  // Other
  STORAGE_PATH: z.string().default('storage')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsedEnv.data;

// Helper function to validate required environment variables
export function validateRequiredEnvVars() {
  if (env.NODE_ENV === 'production') {
    const requiredVars = ['SESSION_SECRET', 'DATABASE_URL'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables in production: ${missingVars.join(', ')}`);
    }
  }
}
