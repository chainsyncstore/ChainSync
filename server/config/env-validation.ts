import { z } from 'zod';
import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

// Define the schema for environment variables
const envSchema = z.object({
  // Core Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  HOST: z.string().default('localhost'),
  API_BASE_URL: z.string().default('/api/v1'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Database (Required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_SIZE: z.string().transform(Number).pipe(z.number().min(1)).default('10'),
  DB_POOL_IDLE_TIMEOUT: z.string().transform(Number).pipe(z.number().min(1000)).default('30000'),

  // Redis (Optional for development, required for production)
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).pipe(z.number().min(0)).default('0'),

  // Session (Required)
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_COOKIE_NAME: z.string().default('chainSyncSession'),
  SESSION_COOKIE_MAX_AGE: z.string().transform(Number).pipe(z.number().min(1)).default('86400000'),
  SESSION_COOKIE_SECURE: z.string().transform(val => val === 'true').default('false'),
  SESSION_COOKIE_HTTP_ONLY: z.string().transform(val => val === 'true').default('true'),
  SESSION_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

  // Security
  RATE_LIMIT_WINDOW: z.string().transform(Number).pipe(z.number().min(1000)).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).pipe(z.number().min(1)).default('100'),
  CSRF_SECRET: z.string().min(16, 'CSRF_SECRET must be at least 16 characters').optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_EXPIRES_IN: z.string().default('1d'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  ALLOWED_METHODS: z.string().default('GET,HEAD,PUT,PATCH,POST,DELETE'),
  ALLOWED_HEADERS: z.string().default('Content-Type,Authorization,X-Requested-With,X-CSRF-Token'),

  // Payment Gateways (Optional but recommended for production)
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),

  // Monitoring (Optional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  SENTRY_TRACES_SAMPLE_RATE: z.string().transform(Number).pipe(z.number().min(0).max(1)).default('0.1'),

  // OpenTelemetry
  OTEL_ENABLED: z.string().transform(val => val === 'true').default('false'),
  OTEL_SERVICE_NAME: z.string().default('chainsync-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

  // Storage
  STORAGE_PATH: z.string().default('storage'),
  
  // AWS (Optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  BACKUP_S3_BUCKET: z.string().optional(),

  // AI Integration (Optional)
  OPENAI_API_KEY: z.string().optional(),

  // Caching
  CACHE_TTL: z.string().transform(Number).pipe(z.number().min(1)).default('3600'),
  CACHE_ENABLED: z.string().transform(val => val === 'true').default('true'),

  // Monitoring Thresholds
  CPU_WARNING_THRESHOLD: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('70'),
  CPU_CRITICAL_THRESHOLD: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('90'),
  MEMORY_WARNING_THRESHOLD: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('75'),
  MEMORY_CRITICAL_THRESHOLD: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('90'),
  DB_RESPONSE_WARNING_MS: z.string().transform(Number).pipe(z.number().min(1)).default('500'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnvironment(): EnvConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  
  try {
    const config = envSchema.parse(process.env);
    
    // Additional production-specific validations
    if (isProduction) {
      // Ensure Redis is configured in production
      if (!config.REDIS_URL && !config.REDIS_HOST) {
        throw new Error('Redis configuration is required in production (REDIS_URL or REDIS_HOST)');
      }
      
      // Ensure session secret is strong enough for production
      if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 64) {
        throw new Error('SESSION_SECRET must be at least 64 characters in production');
      }
      
      // Ensure CSRF protection is enabled in production
      if (!process.env.CSRF_SECRET || process.env.CSRF_SECRET.length < 32) {
        throw new Error('CSRF_SECRET is required and must be at least 32 characters in production');
      }
      
      // Ensure JWT secret is strong enough for production
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) {
        throw new Error('JWT_SECRET must be at least 64 characters in production');
      }
      
      // Ensure secure cookies in production
      if (process.env.SESSION_COOKIE_SECURE !== 'true') {
        throw new Error('SESSION_COOKIE_SECURE must be true in production');
      }
      
      // Ensure payment gateways are configured in production
      if (!process.env.PAYSTACK_SECRET_KEY || !process.env.PAYSTACK_PUBLIC_KEY) {
        throw new Error('Payment gateway configuration (Paystack) is required in production');
      }
      
      // Ensure monitoring is enabled in production
      if (!process.env.SENTRY_DSN) {
        throw new Error('SENTRY_DSN is required for error monitoring in production');
      }
      
      // Ensure monitoring thresholds are reasonable
      if (config.CPU_WARNING_THRESHOLD >= config.CPU_CRITICAL_THRESHOLD) {
        throw new Error('CPU_WARNING_THRESHOLD must be less than CPU_CRITICAL_THRESHOLD');
      }
      
      if (config.MEMORY_WARNING_THRESHOLD >= config.MEMORY_CRITICAL_THRESHOLD) {
        throw new Error('MEMORY_WARNING_THRESHOLD must be less than MEMORY_CRITICAL_THRESHOLD');
      }
    }
    
    return config;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      
      console.error('❌ Environment validation failed:');
      errorMessages.forEach(msg => console.error(`  - ${msg}`));
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      console.error('📖 Refer to .env.example for the complete list of variables.\n');
      
      process.exit(1);
      // Ensure a return path for type checking, though process.exit will terminate
      // This path should ideally not be reached if process.exit works as expected.
      throw new AppError('Environment validation failed and process.exit was called', ErrorCategory.SYSTEM, ErrorCode.CONFIGURATION_ERROR);
    }
    
    // Handle other errors (e.g., from production-specific checks)
    console.error('❌ Environment validation failed:');
    if (error instanceof Error) {
      console.error(`  - ${error.message}`);
    } else {
      console.error(`  - Unknown error: ${String(error)}`);
    }
    console.error('\n💡 Please check your environment configuration.');
    process.exit(1);
    // Ensure a return path for type checking
    throw new AppError('Environment validation failed and process.exit was called', ErrorCategory.SYSTEM, ErrorCode.CONFIGURATION_ERROR);
  }
}

export function logEnvironmentInfo(config: EnvConfig): void {
  console.log('🔧 Environment Configuration:');
  console.log(`  - Environment: ${config.NODE_ENV}`);
  console.log(`  - Port: ${config.PORT}`);
  console.log(`  - Host: ${config.HOST}`);
  console.log(`  - API Base URL: ${config.API_BASE_URL}`);
  console.log(`  - Log Level: ${config.LOG_LEVEL}`);
  console.log(`  - Database Pool Size: ${config.DB_POOL_SIZE}`);
  console.log(`  - Redis: ${config.REDIS_URL ? 'Configured' : 'Not configured'}`);
  console.log(`  - Caching: ${config.CACHE_ENABLED ? 'Enabled' : 'Disabled'}`);
  console.log(`  - Session Cookie Secure: ${config.SESSION_COOKIE_SECURE ? 'Yes' : 'No'}`);
  console.log(`  - Payment Gateways: ${config.PAYSTACK_SECRET_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`  - Monitoring: ${config.SENTRY_DSN ? 'Enabled' : 'Disabled'}`);
  console.log(`  - OpenTelemetry: ${config.OTEL_ENABLED ? 'Enabled' : 'Disabled'}`);
  console.log('');
}
