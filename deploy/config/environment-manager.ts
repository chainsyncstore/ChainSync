import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'environment-manager' });

// Environment configuration schema
const EnvironmentConfigSchema = z.object({
  name: z.string(),
  domain: z.string().url(),
  database: z.object({
    url: z.string().url(),
    ssl: z.boolean(),
    maxConnections: z.number().min(1).max(100),
    idleTimeoutMillis: z.number().min(1000),
  }),
  redis: z.object({
    url: z.string().url(),
    maxRetriesPerRequest: z.number().min(1).max(10),
    retryDelayOnFailover: z.number().min(50).max(1000),
  }),
  security: z.object({
    jwtSecret: z.string().min(32),
    encryptionKey: z.string().length(32),
    sessionSecret: z.string().min(32),
    corsOrigin: z.string().url(),
    rateLimitWindow: z.number().min(1000),
    rateLimitMax: z.number().min(1),
  }),
  monitoring: z.object({
    logLevel: z.enum(['error', 'warn', 'info', 'debug']),
    sentryDsn: z.string().url().optional(),
    prometheusPort: z.number().min(1).max(65535),
    healthCheckInterval: z.number().min(1000),
  }),
  features: z.object({
    sslEnabled: z.boolean(),
    compressionEnabled: z.boolean(),
    cacheTTL: z.number().min(0),
    maxFileSize: z.number().min(1),
    backupRetentionDays: z.number().min(1),
  }),
});

type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

// Environment parity validator
export class EnvironmentParityValidator {
  private environments: Map<string, EnvironmentConfig> = new Map();

  /**
   * Load environment configurations
   */
  async loadEnvironments(configPath: string): Promise<void> {
    try {
      const configDir = await fs.readdir(configPath);
      
      for (const file of configDir) {
        if (file.endsWith('.json')) {
          const envName = path.basename(file, '.json');
          const configData = await fs.readFile(path.join(configPath, file), 'utf8');
          const config = EnvironmentConfigSchema.parse(JSON.parse(configData));
          
          this.environments.set(envName, config);
          logger.info('Environment configuration loaded', { environment: envName });
        }
      }
    } catch (error) {
      logger.error('Failed to load environment configurations', { error });
      throw error;
    }
  }

  /**
   * Validate environment parity
   */
  validateParity(): { valid: boolean; differences: Record<string, any[]> } {
    const differences: Record<string, any[]> = {};
    const environments = Array.from(this.environments.keys());
    
    if (environments.length < 2) {
      logger.warn('Need at least 2 environments to validate parity');
      return { valid: true, differences };
    }

    const baseEnv = environments[0]!;
    const baseConfig = this.environments.get(baseEnv);
    if (!baseConfig) {
      throw new Error(`Base environment '${baseEnv}' not found`);
    }

    for (let i = 1; i < environments.length; i++) {
      const envName = environments[i]!;
      const envConfig = this.environments.get(envName);
      if (!envConfig) {
        throw new Error(`Environment '${envName}' not found`);
      }
      const envDifferences: any[] = [];

      // Compare configurations
      this.compareConfigs(baseConfig, envConfig, envDifferences, '');

      if (envDifferences.length > 0) {
        differences[envName] = envDifferences;
      }
    }

    const valid = Object.keys(differences).length === 0;
    
    if (!valid) {
      logger.warn('Environment parity validation failed', { differences });
    } else {
      logger.info('Environment parity validation passed');
    }

    return { valid, differences };
  }

  /**
   * Compare configurations recursively
   */
  private compareConfigs(
    base: any,
    current: any,
    differences: any[],
    path: string
  ): void {
    const baseKeys = Object.keys(base);
    const currentKeys = Object.keys(current);

    // Check for missing keys
    for (const key of baseKeys) {
      if (!currentKeys.includes(key)) {
        differences.push({
          path: path ? `${path}.${key}` : key,
          type: 'missing',
          expected: base[key],
          actual: undefined,
        });
      }
    }

    // Check for extra keys
    for (const key of currentKeys) {
      if (!baseKeys.includes(key)) {
        differences.push({
          path: path ? `${path}.${key}` : key,
          type: 'extra',
          expected: undefined,
          actual: current[key],
        });
      }
    }

    // Compare common keys
    for (const key of baseKeys) {
      if (currentKeys.includes(key)) {
        const baseValue = base[key];
        const currentValue = current[key];
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue)) {
          this.compareConfigs(baseValue, currentValue, differences, currentPath);
        } else if (baseValue !== currentValue) {
          differences.push({
            path: currentPath,
            type: 'different',
            expected: baseValue,
            actual: currentValue,
          });
        }
      }
    }
  }
}

// Secrets management
export class SecretsManager {
  private secrets: Map<string, string> = new Map();
  private encryptedSecrets: Map<string, string> = new Map();

  /**
   * Load secrets from environment variables
   */
  loadFromEnvironment(): void {
    const secretKeys = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'SESSION_SECRET',
      'DATABASE_URL',
      'REDIS_URL',
      'SENTRY_DSN',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'EMAIL_USER',
      'EMAIL_PASS',
    ];

    for (const key of secretKeys) {
      const value = process.env[key];
      if (value) {
        this.secrets.set(key, value);
        logger.debug('Secret loaded from environment', { key });
      }
    }
  }

  /**
   * Load secrets from file
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const secrets = JSON.parse(data);

      for (const [key, value] of Object.entries(secrets)) {
        this.secrets.set(key, value as string);
        logger.debug('Secret loaded from file', { key });
      }
    } catch (error) {
      logger.error('Failed to load secrets from file', { error, filePath });
      throw error;
    }
  }

  /**
   * Get secret value
   */
  get(key: string): string | undefined {
    return this.secrets.get(key);
  }

  /**
   * Set secret value
   */
  set(key: string, value: string): void {
    this.secrets.set(key, value);
    logger.debug('Secret set', { key });
  }

  /**
   * Validate required secrets
   */
  validateRequired(requiredSecrets: string[]): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const secret of requiredSecrets) {
      if (!this.secrets.has(secret)) {
        missing.push(secret);
      }
    }

    const valid = missing.length === 0;
    
    if (!valid) {
      logger.error('Required secrets validation failed', { missing });
    } else {
      logger.info('Required secrets validation passed');
    }

    return { valid, missing };
  }

  /**
   * Export secrets for environment (sanitized for logging)
   */
  exportForEnvironment(environment: string): Record<string, string> {
    const envSecrets: Record<string, string> = {};
    
    for (const [key, value] of this.secrets.entries()) {
      if (this.shouldIncludeInEnvironment(key, environment)) {
        envSecrets[key] = value;
      }
    }

    return envSecrets;
  }

  /**
   * Check if secret should be included in environment
   */
  private shouldIncludeInEnvironment(key: string, environment: string): boolean {
    // Always include core secrets
    const coreSecrets = ['JWT_SECRET', 'ENCRYPTION_KEY', 'SESSION_SECRET'];
    if (coreSecrets.includes(key)) {
      return true;
    }

    // Environment-specific logic
    switch (environment) {
      case 'production':
        return true; // Include all secrets in production
      case 'staging':
        return !key.includes('STRIPE_LIVE'); // Exclude live payment keys
      case 'development':
        return !key.includes('STRIPE_') && !key.includes('SENTRY_'); // Exclude external service keys
      default:
        return false;
    }
  }
}

// Environment validation
export class EnvironmentValidator {
  private config: EnvironmentConfig;

  constructor(config: EnvironmentConfig) {
    this.config = config;
  }

  /**
   * Validate environment configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate database configuration
    if (!this.config.database.url) {
      errors.push('Database URL is required');
    }

    // Validate security configuration
    if (this.config.security.jwtSecret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    if (this.config.security.encryptionKey.length !== 32) {
      errors.push('Encryption key must be exactly 32 characters long');
    }

    if (this.config.security.sessionSecret.length < 32) {
      errors.push('Session secret must be at least 32 characters long');
    }

    // Validate monitoring configuration
    if (this.config.monitoring.prometheusPort < 1 || this.config.monitoring.prometheusPort > 65535) {
      errors.push('Prometheus port must be between 1 and 65535');
    }

    // Validate features configuration
    if (this.config.features.maxFileSize < 1) {
      errors.push('Max file size must be greater than 0');
    }

    if (this.config.features.backupRetentionDays < 1) {
      errors.push('Backup retention days must be greater than 0');
    }

    const valid = errors.length === 0;
    
    if (!valid) {
      logger.error('Environment validation failed', { errors });
    } else {
      logger.info('Environment validation passed');
    }

    return { valid, errors };
  }

  /**
   * Validate environment readiness for deployment
   */
  validateDeploymentReadiness(): { ready: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check if all required services are accessible
    if (!this.canConnectToDatabase()) {
      issues.push('Cannot connect to database');
    }

    if (!this.canConnectToRedis()) {
      issues.push('Cannot connect to Redis');
    }

    // Check if monitoring is properly configured
    if (this.config.monitoring.sentryDsn && !this.canConnectToSentry()) {
      issues.push('Cannot connect to Sentry');
    }

    // Check if SSL is properly configured for production
    if (this.config.features.sslEnabled && !this.isSSLProperlyConfigured()) {
      issues.push('SSL is not properly configured');
    }

    const ready = issues.length === 0;
    
    if (!ready) {
      logger.warn('Environment not ready for deployment', { issues });
    } else {
      logger.info('Environment ready for deployment');
    }

    return { ready, issues };
  }

  /**
   * Check database connectivity
   */
  private canConnectToDatabase(): boolean {
    // This would implement actual database connectivity check
    // For now, return true as a placeholder
    return true;
  }

  /**
   * Check Redis connectivity
   */
  private canConnectToRedis(): boolean {
    // This would implement actual Redis connectivity check
    // For now, return true as a placeholder
    return true;
  }

  /**
   * Check Sentry connectivity
   */
  private canConnectToSentry(): boolean {
    // This would implement actual Sentry connectivity check
    // For now, return true as a placeholder
    return true;
  }

  /**
   * Check SSL configuration
   */
  private isSSLProperlyConfigured(): boolean {
    // This would implement actual SSL configuration check
    // For now, return true as a placeholder
    return true;
  }
}

// Main environment manager
export class EnvironmentManager {
  private parityValidator: EnvironmentParityValidator;
  private secretsManager: SecretsManager;
  private validators: Map<string, EnvironmentValidator> = new Map();

  constructor() {
    this.parityValidator = new EnvironmentParityValidator();
    this.secretsManager = new SecretsManager();
  }

  /**
   * Initialize environment manager
   */
  async initialize(configPath: string): Promise<void> {
    try {
      // Load environment configurations
      await this.parityValidator.loadEnvironments(configPath);
      
      // Load secrets
      this.secretsManager.loadFromEnvironment();
      
      logger.info('Environment manager initialized');
    } catch (error) {
      logger.error('Failed to initialize environment manager', { error });
      throw error;
    }
  }

  /**
   * Validate all environments
   */
  async validateAll(): Promise<{ valid: boolean; results: Record<string, any> }> {
    const results: Record<string, any> = {};

    // Validate environment parity
    const parityResult = this.parityValidator.validateParity();
    results.parity = parityResult;

    // Validate secrets
    const requiredSecrets = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'SESSION_SECRET',
      'DATABASE_URL',
    ];
    const secretsResult = this.secretsManager.validateRequired(requiredSecrets);
    results.secrets = secretsResult;

    const valid = parityResult.valid && secretsResult.valid;
    
    if (!valid) {
      logger.error('Environment validation failed', { results });
    } else {
      logger.info('All environment validations passed');
    }

    return { valid, results };
  }

  /**
   * Get environment configuration
   */
  getEnvironmentConfig(environment: string): EnvironmentConfig | undefined {
    // This would return the actual environment configuration
    // For now, return undefined as a placeholder
    return undefined;
  }

  /**
   * Get secrets for environment
   */
  getSecretsForEnvironment(environment: string): Record<string, string> {
    return this.secretsManager.exportForEnvironment(environment);
  }
} 