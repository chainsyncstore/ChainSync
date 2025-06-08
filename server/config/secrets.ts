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
    // Initialize encryption key from environment
    const keyString = process.env.ENCRYPTION_KEY;

    // In production, ENCRYPTION_KEY must be provided
    const isProduction = process.env.NODE_ENV === 'production';

    if (!keyString) {
      if (isProduction) {
        // Fail fast in production if encryption key is missing
        const errorMsg = 'CRITICAL SECURITY ERROR: ENCRYPTION_KEY is required in production';
        logger.error(errorMsg);
        throw new Error(errorMsg);
      } else {
        // In development/test, generate a temporary key with warning
        this.encryptionKey = crypto.randomBytes(32);
        logger.warn(
          'No ENCRYPTION_KEY found, generated temporary key. ' +
            'This is only acceptable in development environments.'
        );
        return;
      }
    }

    // Validate key format and length
    if (!/^[a-fA-F0-9]{64}$/.test(keyString)) {
      const errorMsg = 'ENCRYPTION_KEY must be a 64-character hexadecimal string';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Convert the validated key to a buffer
    this.encryptionKey = Buffer.from(keyString, 'hex');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM with proper IV handling
   * @param text The plain text to encrypt
   * @returns The encrypted text with IV prepended (format: iv:authTag:encrypted)
   */
  encrypt(text: string): string {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher with proper IV
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag
      const authTag = cipher.getAuthTag().toString('hex');

      // Return the IV, authentication tag, and encrypted text
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error: unknown) {
      logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM with proper IV and authentication
   * @param encryptedText The encrypted text in format: iv:authTag:encrypted
   * @returns The decrypted plain text
   */
  decrypt(encryptedText: string): string {
    try {
      // Split the encrypted text into IV, auth tag, and encrypted data
      const parts = encryptedText.split(':');

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Create decipher with proper IV
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);

      // Set the authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: unknown) {
      logger.error('Decryption failed', { error });
      throw new Error(
        'Failed to decrypt data. The data may be corrupted or the encryption key may have changed.'
      );
    }
  }

  /**
   * Store a secret securely with encryption
   * @param key The unique key for the secret
   * @param value The secret value to encrypt and store
   */
  setSecret(key: string, value: string): void {
    if (!key || !value) {
      throw new Error('Key and value are required for storing secrets');
    }

    this.secrets.set(key, this.encrypt(value));
    logger.info('Secret stored', { key });
  }

  /**
   * Retrieve and decrypt a secret
   * @param key The unique key for the secret to retrieve
   * @returns The decrypted secret value or undefined if not found
   */
  getSecret(key: string): string | undefined {
    const encrypted = this.secrets.get(key);
    if (!encrypted) {
      return undefined;
    }

    try {
      return this.decrypt(encrypted);
    } catch (error: unknown) {
      logger.error(`Failed to decrypt secret: ${key}`, { error });
      return undefined;
    }
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
          description: config.description,
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
    validator: value => value.length >= 32,
  },
  {
    key: 'JWT_REFRESH_SECRET',
    required: true,
    description: 'Secret key for JWT refresh token signing',
    validator: value => value.length >= 32,
  },
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection URL',
    validator: value => value.startsWith('postgresql://') || value.startsWith('postgres://'),
  },
  {
    key: 'REDIS_URL',
    required: false,
    description: 'Redis connection URL for caching',
    validator: value => value.startsWith('redis://') || value.startsWith('rediss://'),
  },
  {
    key: 'ENCRYPTION_KEY',
    required: true,
    description: 'Key for encrypting sensitive data (64 hex characters)',
    validator: value => /^[0-9a-fA-F]{64}$/.test(value),
  },
  {
    key: 'SESSION_SECRET',
    required: true,
    description: 'Secret for session management',
    validator: value => value.length >= 32,
  },
  {
    key: 'SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error tracking',
  },
  {
    key: 'STRIPE_SECRET_KEY',
    required: false,
    description: 'Stripe secret key for payments',
    validator: value => value.startsWith('sk_'),
  },
  {
    key: 'SENDGRID_API_KEY',
    required: false,
    description: 'SendGrid API key for email sending',
    validator: value => value.startsWith('SG.'),
  },
  {
    key: 'FLUTTERWAVE_SECRET_KEY',
    required: false,
    description: 'Flutterwave secret key for payments',
  },
  {
    key: 'PAYSTACK_SECRET_KEY',
    required: false,
    description: 'Paystack secret key for payments',
    validator: value => value.startsWith('sk_'),
  },
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
} catch (error: unknown) {
  logger.error('Failed to initialize secrets manager', error as Error);
  process.exit(1);
}
