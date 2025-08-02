import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ _component: 'environment-parity' });

// Environment configuration schema
const EnvironmentConfigSchema = z.object({
  _name: z.string(),
  _domain: z.string().url(),
  _database: z.object({
    _url: z.string().url(),
    _ssl: z.boolean(),
    _maxConnections: z.number().min(1).max(100),
    _idleTimeoutMillis: z.number().min(1000)
  }),
  _redis: z.object({
    _url: z.string().url(),
    _maxRetriesPerRequest: z.number().min(1).max(10),
    _retryDelayOnFailover: z.number().min(50).max(1000)
  }),
  _security: z.object({
    _jwtSecret: z.string().min(32),
    _encryptionKey: z.string().length(32),
    _sessionSecret: z.string().min(32),
    _corsOrigin: z.string().url(),
    _rateLimitWindow: z.number().min(1000),
    _rateLimitMax: z.number().min(1)
  }),
  _monitoring: z.object({
    _logLevel: z.enum(['error', 'warn', 'info', 'debug']),
    _sentryDsn: z.string().url().optional(),
    _prometheusPort: z.number().min(1).max(65535),
    _healthCheckInterval: z.number().min(1000)
  }),
  _features: z.object({
    _sslEnabled: z.boolean(),
    _compressionEnabled: z.boolean(),
    _cacheTTL: z.number().min(0),
    _maxFileSize: z.number().min(1),
    _backupRetentionDays: z.number().min(1)
  })
});

type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

// Environment parity validator
export class EnvironmentParityValidator {
  private _environments: Map<string, EnvironmentConfig> = new Map();

  /**
   * Load environment configurations
   */
  async loadEnvironments(_configPath: string): Promise<void> {
    try {
      const configDir = await fs.readdir(configPath);

      for (const file of configDir) {
        if (file.endsWith('.json')) {
          const envName = path.basename(file, '.json');
          const configData = await fs.readFile(path.join(configPath, file), 'utf8');
          const config = EnvironmentConfigSchema.parse(JSON.parse(configData));

          this.environments.set(envName, config);
          logger.info('Environment configuration loaded', { _environment: envName });
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
  validateParity(): { _valid: boolean; _differences: Record<string, any[]> } {
    const _differences: Record<string, any[]> = {};
    const environments = Array.from(this.environments.keys());

    if (environments.length < 2) {
      logger.warn('Need at least 2 environments to validate parity');
      return { _valid: true, differences };
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
      const _envDifferences: any[] = [];

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
    _base: any,
    _current: any,
    _differences: any[],
    _path: string
  ): void {
    const baseKeys = Object.keys(base);
    const currentKeys = Object.keys(current);

    // Check for missing keys
    for (const key of baseKeys) {
      if (!currentKeys.includes(key)) {
        differences.push({
          _path: path ? `${path}.${key}` : key,
          _type: 'missing',
          _expected: base[key],
          _actual: undefined
        });
      }
    }

    // Check for extra keys
    for (const key of currentKeys) {
      if (!baseKeys.includes(key)) {
        differences.push({
          _path: path ? `${path}.${key}` : key,
          _type: 'extra',
          _expected: undefined,
          _actual: current[key]
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
            _path: currentPath,
            _type: 'different',
            _expected: baseValue,
            _actual: currentValue
          });
        }
      }
    }
  }
}
