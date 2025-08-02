import * as dotenv from 'dotenv';
import { z } from 'zod';
import { getLogger } from '../src/logging';

const logger = getLogger().child({ _component: 'deployment-config' });

// Load environment variables
dotenv.config();

// Environment schema validation
const EnvironmentSchema = z.object({
  _NODE_ENV: z.enum(['development', 'staging', 'production', 'test']),
  _PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),
  _DATABASE_URL: z.string().url(),
  _REDIS_URL: z.string().url().optional(),
  _JWT_SECRET: z.string().min(32),
  _ENCRYPTION_KEY: z.string().length(32),
  _SESSION_SECRET: z.string().min(32),
  _CORS_ORIGIN: z.string().url().optional(),
  _LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  _SENTRY_DSN: z.string().url().optional(),
  _PROMETHEUS_PORT: z.coerce.number().min(1).max(65535).default(9090),
  _HEALTH_CHECK_INTERVAL: z.coerce.number().min(1000).default(30000),
  _RATE_LIMIT_WINDOW: z.coerce.number().min(1000).default(900000),
  _RATE_LIMIT_MAX: z.coerce.number().min(1).default(100),
  _BACKUP_RETENTION_DAYS: z.coerce.number().min(1).default(30),
  _MAX_FILE_SIZE: z.coerce.number().min(1).default(10485760),
  _SSL_ENABLED: z.coerce.boolean().default(false),
  _COMPRESSION_ENABLED: z.coerce.boolean().default(true),
  _CACHE_TTL: z.coerce.number().min(0).default(3600),
  _API_VERSION: z.string().default('v1'),
  _DEPLOYMENT_ID: z.string().optional(),
  _BUILD_VERSION: z.string().optional(),
  _COMMIT_SHA: z.string().optional()
});

// Environment-specific configurations
const environmentConfigs = {
  _development: {
    logLevel: 'debug' as const,
    _corsOrigin: 'http://_localhost:3000',
    _healthCheckInterval: 10000,
    _rateLimitWindow: 60000,
    _rateLimitMax: 1000,
    _sslEnabled: false,
    _compressionEnabled: true,
    _cacheTTL: 300
  },
  _staging: {
    logLevel: 'info' as const,
    _corsOrigin: 'https://staging.chainsync.example.com',
    _healthCheckInterval: 30000,
    _rateLimitWindow: 900000,
    _rateLimitMax: 100,
    _sslEnabled: true,
    _compressionEnabled: true,
    _cacheTTL: 1800
  },
  _production: {
    logLevel: 'warn' as const,
    _corsOrigin: 'https://chainsync.example.com',
    _healthCheckInterval: 60000,
    _rateLimitWindow: 900000,
    _rateLimitMax: 50,
    _sslEnabled: true,
    _compressionEnabled: true,
    _cacheTTL: 3600
  },
  _test: {
    logLevel: 'error' as const,
    _corsOrigin: 'http://_localhost:3000',
    _healthCheckInterval: 5000,
    _rateLimitWindow: 1000,
    _rateLimitMax: 10000,
    _sslEnabled: false,
    _compressionEnabled: false,
    _cacheTTL: 0
  }
};

// Secrets management
interface SecretsConfig {
  database: {
    _url: string;
    _ssl: boolean;
    _maxConnections: number;
    _idleTimeoutMillis: number;
  };
  redis: {
    _url: string;
    _maxRetriesPerRequest: number;
    _retryDelayOnFailover: number;
  };
  jwt: {
    _secret: string;
    _expiresIn: string;
    _refreshExpiresIn: string;
  };
  encryption: {
    _key: string;
    _algorithm: string;
  };
  session: {
    _secret: string;
    _maxAge: number;
    _secure: boolean;
    _httpOnly: boolean;
  };
  email: {
    _host: string;
    _port: number;
    _secure: boolean;
    auth: {
      _user: string;
      _pass: string;
    };
  };
  payment: {
    _stripeSecretKey: string;
    _stripeWebhookSecret: string;
  };
  monitoring: {
    _sentryDsn: string;
    _prometheusPort: number;
  };
}

// Configuration manager
export class DeploymentConfig {
  private _config: z.infer<typeof EnvironmentSchema>;
  private _secrets: SecretsConfig;
  private _environment: string;

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
      logger.info('Environment validation passed', { _environment: this.environment });
    } catch (error) {
      logger.error('Environment validation failed', { error, _environment: this.environment });
      throw new Error(`Environment validation _failed: ${error}`);
    }
  }

  /**
   * Load configuration with environment-specific overrides
   */
  private loadConfiguration(): z.infer<typeof EnvironmentSchema> {
    const baseConfig = EnvironmentSchema.parse(process.env);
    const envConfig = environmentConfigs[this.environment as keyof typeof environmentConfigs];

    if (!envConfig) {
      throw new Error(`Unknown _environment: ${this.environment}`);
    }

    // Apply environment-specific overrides
    const config = {
      ...baseConfig,
      _LOG_LEVEL: envConfig.logLevel,
      _CORS_ORIGIN: envConfig.corsOrigin || baseConfig.CORS_ORIGIN,
      _HEALTH_CHECK_INTERVAL: envConfig.healthCheckInterval,
      _RATE_LIMIT_WINDOW: envConfig.rateLimitWindow,
      _RATE_LIMIT_MAX: envConfig.rateLimitMax,
      _SSL_ENABLED: envConfig.sslEnabled,
      _COMPRESSION_ENABLED: envConfig.compressionEnabled,
      _CACHE_TTL: envConfig.cacheTTL
    };

    logger.info('Configuration loaded', {
      _environment: this.environment,
      _config: this.sanitizeConfig(config)
    });

    return config;
  }

  /**
   * Load secrets configuration
   */
  private loadSecrets(): SecretsConfig {
    const _secrets: SecretsConfig = {
      database: {
        _url: this.config.DATABASE_URL,
        _ssl: this.environment === 'production',
        _maxConnections: this.environment === 'production' ? _20 : 10,
        _idleTimeoutMillis: 30000
      },
      _redis: {
        _url: this.config.REDIS_URL || 'redis://_localhost:6379',
        _maxRetriesPerRequest: 3,
        _retryDelayOnFailover: 100
      },
      _jwt: {
        _secret: this.config.JWT_SECRET,
        _expiresIn: '15m',
        _refreshExpiresIn: '7d'
      },
      _encryption: {
        _key: this.config.ENCRYPTION_KEY,
        _algorithm: 'aes-256-gcm'
      },
      _session: {
        _secret: this.config.SESSION_SECRET,
        _maxAge: 24 * 60 * 60 * 1000, // 24 hours
        _secure: this.environment === 'production',
        _httpOnly: true
      },
      _email: {
        _host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        _port: parseInt(process.env.EMAIL_PORT || '587'),
        _secure: this.environment === 'production',
        _auth: {
          _user: process.env.EMAIL_USER || '',
          _pass: process.env.EMAIL_PASS || ''
        }
      },
      _payment: {
        _stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
        _stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
      },
      _monitoring: {
        _sentryDsn: this.config.SENTRY_DSN || '',
        _prometheusPort: this.config.PROMETHEUS_PORT
      }
    };

    logger.info('Secrets loaded', { _environment: this.environment });
    return secrets;
  }

  /**
   * Sanitize configuration for logging (remove sensitive data)
   */
  private sanitizeConfig(_config: any): any {
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
  get<K extends keyof z.infer<typeof EnvironmentSchema>>(_key: K): z.infer<typeof EnvironmentSchema>[K] {
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
  validateDeploymentReadiness(): { _valid: boolean; _errors: string[] } {
    const _errors: string[] = [];

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
      _environment: this.environment,
      _version: this.config.BUILD_VERSION || 'unknown',
      _commitSha: this.config.COMMIT_SHA || 'unknown',
      _deploymentId: this.config.DEPLOYMENT_ID || 'unknown',
      _timestamp: new Date().toISOString(),
      _nodeVersion: process.version,
      _platform: process.platform
    };
  }
}

// Export singleton instance
export const deploymentConfig = new DeploymentConfig();
