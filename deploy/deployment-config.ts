import * as dotenv from 'dotenv';
import { z } from 'zod';
import { getLogger } from '../src/logging';

const logger = getLogger().child({ component: 'deployment-config' });

// Load environment variables
dotenv.config();

// Environment schema validation
const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(32),
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  PROMETHEUS_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('9090'),
  HEALTH_CHECK_INTERVAL: z.string().transform(Number).pipe(z.number().min(1000)).default('30000'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).pipe(z.number().min(1000)).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).pipe(z.number().min(1)).default('100'),
  BACKUP_RETENTION_DAYS: z.string().transform(Number).pipe(z.number().min(1)).default('30'),
  MAX_FILE_SIZE: z.string().transform(Number).pipe(z.number().min(1)).default('10485760'),
  SSL_ENABLED: z.string().transform(val => val === 'true').default('false'),
  COMPRESSION_ENABLED: z.string().transform(val => val === 'true').default('true'),
  CACHE_TTL: z.string().transform(Number).pipe(z.number().min(0)).default('3600'),
  API_VERSION: z.string().default('v1'),
  DEPLOYMENT_ID: z.string().optional(),
  BUILD_VERSION: z.string().optional(),
  COMMIT_SHA: z.string().optional(),
});

// Environment-specific configurations
const environmentConfigs = {
  development: {
    logLevel: 'debug',
    corsOrigin: 'http://localhost:3000',
    healthCheckInterval: 10000,
    rateLimitWindow: 60000,
    rateLimitMax: 1000,
    sslEnabled: false,
    compressionEnabled: true,
    cacheTTL: 300,
  },
  staging: {
    logLevel: 'info',
    corsOrigin: 'https://staging.chainsync.example.com',
    healthCheckInterval: 30000,
    rateLimitWindow: 900000,
    rateLimitMax: 100,
    sslEnabled: true,
    compressionEnabled: true,
    cacheTTL: 1800,
  },
  production: {
    logLevel: 'warn',
    corsOrigin: 'https://chainsync.example.com',
    healthCheckInterval: 60000,
    rateLimitWindow: 900000,
    rateLimitMax: 50,
    sslEnabled: true,
    compressionEnabled: true,
    cacheTTL: 3600,
  },
  test: {
    logLevel: 'error',
    corsOrigin: 'http://localhost:3000',
    healthCheckInterval: 5000,
    rateLimitWindow: 1000,
    rateLimitMax: 10000,
    sslEnabled: false,
    compressionEnabled: false,
    cacheTTL: 0,
  },
};

// Secrets management
interface SecretsConfig {
  database: {
    url: string;
    ssl: boolean;
    maxConnections: number;
    idleTimeoutMillis: number;
  };
  redis: {
    url: string;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  encryption: {
    key: string;
    algorithm: string;
  };
  session: {
    secret: string;
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
  };
  email: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  payment: {
    stripeSecretKey: string;
    stripeWebhookSecret: string;
  };
  monitoring: {
    sentryDsn: string;
    prometheusPort: number;
  };
}

// Configuration manager
export class DeploymentConfig {
  private config: z.infer<typeof EnvironmentSchema>;
  private secrets: SecretsConfig;
  private environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.validateEnvironment();
    this.config = this.loadConfiguration();
    this.secrets = this.loadSecrets();
  }

  /**
   * Validate environment variables
   */
  private validateEnvironment(): void {
    try {
      EnvironmentSchema.parse(process.env);
      logger.info('Environment validation passed', { environment: this.environment });
    } catch (error) {
      logger.error('Environment validation failed', { error, environment: this.environment });
      throw new Error(`Environment validation failed: ${error}`);
    }
  }

  /**
   * Load configuration with environment-specific overrides
   */
  private loadConfiguration(): z.infer<typeof EnvironmentSchema> {
    const baseConfig = EnvironmentSchema.parse(process.env);
    const envConfig = environmentConfigs[this.environment as keyof typeof environmentConfigs];

    if (!envConfig) {
      throw new Error(`Unknown environment: ${this.environment}`);
    }

    // Apply environment-specific overrides
    const config = {
      ...baseConfig,
      LOG_LEVEL: envConfig.logLevel,
      CORS_ORIGIN: envConfig.corsOrigin || baseConfig.CORS_ORIGIN,
      HEALTH_CHECK_INTERVAL: envConfig.healthCheckInterval,
      RATE_LIMIT_WINDOW: envConfig.rateLimitWindow,
      RATE_LIMIT_MAX: envConfig.rateLimitMax,
      SSL_ENABLED: envConfig.sslEnabled,
      COMPRESSION_ENABLED: envConfig.compressionEnabled,
      CACHE_TTL: envConfig.cacheTTL,
    };

    logger.info('Configuration loaded', { 
      environment: this.environment,
      config: this.sanitizeConfig(config)
    });

    return config;
  }

  /**
   * Load secrets configuration
   */
  private loadSecrets(): SecretsConfig {
    const secrets: SecretsConfig = {
      database: {
        url: this.config.DATABASE_URL,
        ssl: this.environment === 'production',
        maxConnections: this.environment === 'production' ? 20 : 10,
        idleTimeoutMillis: 30000,
      },
      redis: {
        url: this.config.REDIS_URL || 'redis://localhost:6379',
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
      },
      jwt: {
        secret: this.config.JWT_SECRET,
        expiresIn: '15m',
        refreshExpiresIn: '7d',
      },
      encryption: {
        key: this.config.ENCRYPTION_KEY,
        algorithm: 'aes-256-gcm',
      },
      session: {
        secret: this.config.SESSION_SECRET,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: this.environment === 'production',
        httpOnly: true,
      },
      email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: this.environment === 'production',
        auth: {
          user: process.env.EMAIL_USER || '',
          pass: process.env.EMAIL_PASS || '',
        },
      },
      payment: {
        stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      },
      monitoring: {
        sentryDsn: this.config.SENTRY_DSN || '',
        prometheusPort: this.config.PROMETHEUS_PORT,
      },
    };

    logger.info('Secrets loaded', { environment: this.environment });
    return secrets;
  }

  /**
   * Sanitize configuration for logging (remove sensitive data)
   */
  private sanitizeConfig(config: any): any {
    const sanitized = { ...config };
    const sensitiveKeys = ['JWT_SECRET', 'ENCRYPTION_KEY', 'SESSION_SECRET', 'DATABASE_URL'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  /**
   * Get configuration value
   */
  get<K extends keyof z.infer<typeof EnvironmentSchema>>(key: K): z.infer<typeof EnvironmentSchema>[K] {
    return this.config[key];
  }

  /**
   * Get secrets configuration
   */
  getSecrets(): SecretsConfig {
    return this.secrets;
  }

  /**
   * Get environment name
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Check if environment is production
   */
  isProduction(): boolean {
    return this.environment === 'production';
  }

  /**
   * Check if environment is staging
   */
  isStaging(): boolean {
    return this.environment === 'staging';
  }

  /**
   * Check if environment is development
   */
  isDevelopment(): boolean {
    return this.environment === 'development';
  }

  /**
   * Check if environment is test
   */
  isTest(): boolean {
    return this.environment === 'test';
  }

  /**
   * Validate deployment readiness
   */
  validateDeploymentReadiness(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required environment variables
    if (!this.config.DATABASE_URL) {
      errors.push('DATABASE_URL is required');
    }

    if (!this.config.JWT_SECRET) {
      errors.push('JWT_SECRET is required');
    }

    if (!this.config.ENCRYPTION_KEY) {
      errors.push('ENCRYPTION_KEY is required');
    }

    if (!this.config.SESSION_SECRET) {
      errors.push('SESSION_SECRET is required');
    }

    // Production-specific validations
    if (this.isProduction()) {
      if (!this.config.SENTRY_DSN) {
        errors.push('SENTRY_DSN is required for production');
      }

      if (!this.secrets.payment.stripeSecretKey) {
        errors.push('STRIPE_SECRET_KEY is required for production');
      }

      if (!this.secrets.email.auth.user || !this.secrets.email.auth.pass) {
        errors.push('Email credentials are required for production');
      }
    }

    const valid = errors.length === 0;
    
    if (!valid) {
      logger.error('Deployment readiness validation failed', { errors });
    } else {
      logger.info('Deployment readiness validation passed');
    }

    return { valid, errors };
  }

  /**
   * Get deployment metadata
   */
  getDeploymentMetadata(): Record<string, any> {
    return {
      environment: this.environment,
      version: this.config.BUILD_VERSION || 'unknown',
      commitSha: this.config.COMMIT_SHA || 'unknown',
      deploymentId: this.config.DEPLOYMENT_ID || 'unknown',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
    };
  }
}

// Export singleton instance
export const deploymentConfig = new DeploymentConfig(); 