import crypto from 'crypto';
import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ component: 'secrets-manager' });

export interface SecretConfig {
  key: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  defaultValue?: string;
}

export class SecretsManager {
  private secrets = new Map<string, string>();
  private encryptionKey: Buffer;

  constructor() {
    // Initialize encryption key from environment or generate one
    const keyString = process.env.ENCRYPTION_KEY;
    if (keyString) {
      this.encryptionKey = Buffer.from(keyString, 'hex');
    } else {
      this.encryptionKey = crypto.randomBytes(32);
      logger.warn('No ENCRYPTION_KEY found, generated temporary key. This should not happen in production!');
    }
  }

  // Encrypt sensitive data
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // Decrypt sensitive data
  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Store secret securely
  setSecret(key: string, value: string): void {
    this.secrets.set(key, this.encrypt(value));
    logger.info('Secret stored', { key });
  }

  // Retrieve secret
  getSecret(key: string): string | undefined {
    const encrypted = this.secrets.get(key);
    if (!encrypted) {
      return undefined;
    }
    return this.decrypt(encrypted);
  }

  // Load secrets from environment
  loadFromEnvironment(configs: SecretConfig[]): void {
    for (const config of configs) {
      const value = process.env[config.key] || config.defaultValue;
      
      if (!value && config.required) {
        throw new Error(`Required secret ${config.key} is missing: ${config.description}`);
      }

      if (value && config.validator && !config.validator(value)) {
        throw new Error(`Invalid value for secret ${config.key}: ${config.description}`);
      }

      if (value) {
        this.setSecret(config.key, value);
        logger.info('Secret loaded from environment', { 
          key: config.key, 
          description: config.description 
        });
      }
    }
  }

  // Validate all required secrets are present
  validateSecrets(configs: SecretConfig[]): boolean {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const config of configs) {
      const value = this.getSecret(config.key);
      
      if (!value && config.required) {
        missing.push(config.key);
        continue;
      }

      if (value && config.validator && !config.validator(value)) {
        invalid.push(config.key);
      }
    }

    if (missing.length > 0) {
      logger.error('Missing required secrets', { missing });
      return false;
    }

    if (invalid.length > 0) {
      logger.error('Invalid secret values', { invalid });
      return false;
    }

    return true;
  }

  // Clear all secrets (for cleanup)
  clearSecrets(): void {
    this.secrets.clear();
    logger.info('All secrets cleared');
  }
}

// Secret configurations
export const SECRET_CONFIGS: SecretConfig[] = [
  {
    key: 'JWT_SECRET',
    required: true,
    description: 'Secret key for JWT token signing',
    validator: (value) => value.length >= 32
  },
  {
    key: 'JWT_REFRESH_SECRET',
    required: true,
    description: 'Secret key for JWT refresh token signing',
    validator: (value) => value.length >= 32
  },
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection URL',
    validator: (value) => value.startsWith('postgresql://') || value.startsWith('postgres://')
  },
  {
    key: 'REDIS_URL',
    required: false,
    description: 'Redis connection URL for caching',
    validator: (value) => value.startsWith('redis://') || value.startsWith('rediss://')
  },
  {
    key: 'ENCRYPTION_KEY',
    required: true,
    description: 'Key for encrypting sensitive data (64 hex characters)',
    validator: (value) => /^[0-9a-fA-F]{64}$/.test(value)
  },
  {
    key: 'SESSION_SECRET',
    required: true,
    description: 'Secret for session management',
    validator: (value) => value.length >= 32
  },
  {
    key: 'SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error tracking'
  },
  {
    key: 'STRIPE_SECRET_KEY',
    required: false,
    description: 'Stripe secret key for payments',
    validator: (value) => value.startsWith('sk_')
  },
  {
    key: 'SENDGRID_API_KEY',
    required: false,
    description: 'SendGrid API key for email sending',
    validator: (value) => value.startsWith('SG.')
  },
  {
    key: 'FLUTTERWAVE_SECRET_KEY',
    required: false,
    description: 'Flutterwave secret key for payments'
  },
  {
    key: 'PAYSTACK_SECRET_KEY',
    required: false,
    description: 'Paystack secret key for payments',
    validator: (value) => value.startsWith('sk_')
  }
];

// Global secrets manager instance
export const secretsManager = new SecretsManager();

// Initialize secrets on module load
try {
  secretsManager.loadFromEnvironment(SECRET_CONFIGS);
  
  if (!secretsManager.validateSecrets(SECRET_CONFIGS)) {
    logger.error('Secret validation failed');
    process.exit(1);
  }
  
  logger.info('Secrets manager initialized successfully');
} catch (error) {
  logger.error('Failed to initialize secrets manager', error as Error);
  process.exit(1);
}
