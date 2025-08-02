import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'environment-parity' });

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