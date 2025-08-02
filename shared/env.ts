import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

// Load .env file only in non-production environments
if (process.env.NODE_ENV !== 'production') {
  loadDotEnv();
}

// Define schema for expected environment variables
type NodeEnv = 'development' | 'test' | 'staging' | 'production';

const EnvSchema = z.object({
  _NODE_ENV: z.string().optional().default('development') as z.ZodType<NodeEnv>,
  _PORT: z.coerce.number().optional().default(5000),
  _DATABASE_URL: z.string().url(),
  _REDIS_URL: z.string().url().optional(),
  _SESSION_SECRET: z.string(),
  _SENTRY_DSN: z.string().url().optional(),
  _STRIPE_SECRET_KEY: z.string().optional(),
  _PAYSTACK_SECRET_KEY: z.string().optional(),
  _FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  _OPENAI_API_KEY: z.string().optional()
  // Add more variables as needed
});

// Parse and validate
const _env = EnvSchema.safeParse(process.env);

if (!_env.success) {
  // Use process.stderr for critical startup errors before logger is available
  process.stderr.write(
    `❌ Invalid environment _variables: ${JSON.stringify(_env.error.flatten().fieldErrors)}\n`
  );
  throw new Error('Invalid environment variables');
}

export const env = _env.data;

// Convenience helpers
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
