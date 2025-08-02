import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ _component: 'secrets-manager' });

// Secrets management
export class SecretsManager {
  private _secrets: Map<string, string> = new Map();
  private _encryptedSecrets: Map<string, string> = new Map();
  private _encryptionKey: string;

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey || process.env.ENCRYPTION_KEY || '';
    if (!this.encryptionKey) {
      logger.warn('No encryption key provided, secrets will be stored in plain text');
    }
  }

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
      'EMAIL_PASS'
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
  async loadFromFile(_filePath: string): Promise<void> {
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
   * Save secrets to encrypted file
   */
  async saveToEncryptedFile(_filePath: string): Promise<void> {
    try {
      const _secretsObj: Record<string, string> = {};

      for (const [key, value] of this.secrets.entries()) {
        if (this.encryptionKey) {
          secretsObj[key] = this.encrypt(value);
        } else {
          secretsObj[key] = value;
        }
      }

      await fs.writeFile(filePath, JSON.stringify(secretsObj, null, 2));
      logger.info('Secrets saved to encrypted file', { filePath });
    } catch (error) {
      logger.error('Failed to save secrets to file', { error, filePath });
      throw error;
    }
  }

  /**
   * Load secrets from encrypted file
   */
  async loadFromEncryptedFile(_filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const encryptedSecrets = JSON.parse(data);

      for (const [key, encryptedValue] of Object.entries(encryptedSecrets)) {
        if (this.encryptionKey && typeof encryptedValue === 'string') {
          try {
            const decryptedValue = this.decrypt(encryptedValue as string);
            this.secrets.set(key, decryptedValue);
            logger.debug('Secret decrypted and loaded', { key });
          } catch (decryptError) {
            logger.warn('Failed to decrypt secret', { key, _error: decryptError });
            // Store as encrypted for later decryption
            this.encryptedSecrets.set(key, encryptedValue as string);
          }
        } else {
          this.secrets.set(key, encryptedValue as string);
          logger.debug('Secret loaded (not encrypted)', { key });
        }
      }
    } catch (error) {
      logger.error('Failed to load secrets from encrypted file', { error, filePath });
      throw error;
    }
  }

  /**
   * Get secret value
   */
  get(_key: string): string | undefined {
    return this.secrets.get(key);
  }

  /**
   * Set secret value
   */
  set(_key: string, _value: string): void {
    this.secrets.set(key, value);
    logger.debug('Secret set', { key });
  }

  /**
   * Validate required secrets
   */
  validateRequired(_requiredSecrets: string[]): { _valid: boolean; _missing: string[] } {
    const _missing: string[] = [];

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
  exportForEnvironment(_environment: string): Record<string, string> {
    const _envSecrets: Record<string, string> = {};

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
  private shouldIncludeInEnvironment(_key: string, _environment: string): boolean {
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
      return false;
    }
  }

  /**
   * Encrypt a value
   */
  private encrypt(_text: string): string {
    if (!this.encryptionKey) {
      return text;
    }

    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a value
   */
  private decrypt(_encryptedText: string): string {
    if (!this.encryptionKey) {
      return encryptedText;
    }

    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedData = textParts.join(':');

    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Rotate encryption key
   */
  async rotateEncryptionKey(_newKey: string): Promise<void> {
    if (!this.encryptionKey) {
      logger.warn('No current encryption key to rotate from');
      this.encryptionKey = newKey;
      return;
    }

    const oldKey = this.encryptionKey;
    this.encryptionKey = newKey;

    // Re-encrypt all secrets with new key
    const reencryptedSecrets = new Map<string, string>();

    for (const [key, value] of this.secrets.entries()) {
      reencryptedSecrets.set(key, this.encrypt(value));
    }

    // Update encrypted secrets
    for (const [key, encryptedValue] of this.encryptedSecrets.entries()) {
      try {
        const decryptedValue = this.decrypt(encryptedValue);
        reencryptedSecrets.set(key, this.encrypt(decryptedValue));
      } catch (error) {
        logger.warn('Failed to re-encrypt secret', { key, error });
      }
    }

    this.encryptedSecrets = reencryptedSecrets;
    logger.info('Encryption key rotated successfully');
  }

  /**
   * Generate secure random secret
   */
  generateSecret(_length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * List all secret keys (without values)
   */
  listSecretKeys(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Check if secret exists
   */
  has(_key: string): boolean {
    return this.secrets.has(key);
  }

  /**
   * Remove secret
   */
  remove(_key: string): boolean {
    const removed = this.secrets.delete(key);
    if (removed) {
      logger.debug('Secret removed', { key });
    }
    return removed;
  }

  /**
   * Clear all secrets
   */
  clear(): void {
    this.secrets.clear();
    this.encryptedSecrets.clear();
    logger.info('All secrets cleared');
  }
}
