// server/services/encryption.ts
// Data encryption service for sensitive data at rest
import * as crypto from 'crypto';
import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ component: 'encryption-service' });

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits
  tagLength: 16, // 128 bits
  saltLength: 32, // 256 bits
  iterations: 100000, // PBKDF2 iterations
};

/**
 * Encryption service for sensitive data
 * Provides methods for encrypting and decrypting data at rest
 */
export class EncryptionService {
  private masterKey: Buffer;
  
  constructor(masterKey?: string) {
    // Use environment variable or generate a new key
    const keySource = masterKey || process.env.ENCRYPTION_MASTER_KEY;
    
    if (!keySource) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_MASTER_KEY environment variable is required in production');
      }
      logger.warn('No encryption master key provided, using development key');
      this.masterKey = crypto.randomBytes(ENCRYPTION_CONFIG.keyLength);
    } else {
      // Derive key from password using PBKDF2
      this.masterKey = crypto.pbkdf2Sync(
        keySource,
        'chainsync-salt',
        ENCRYPTION_CONFIG.iterations,
        ENCRYPTION_CONFIG.keyLength,
        'sha256'
      );
    }
  }
  
  /**
   * Encrypt sensitive data
   * @param data - Data to encrypt
   * @param context - Optional context for key derivation
   * @returns Encrypted data as base64 string
   */
  encrypt(data: string, context?: string): string {
    try {
      // Generate a random IV
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
      
      // Derive encryption key from master key and context
      const encryptionKey = this.deriveKey(context);
      
      // Create cipher
      const cipher = crypto.createCipher(ENCRYPTION_CONFIG.algorithm, encryptionKey);
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      const result = Buffer.concat([iv, Buffer.from(encrypted, 'hex')]);
      
      logger.debug('Data encrypted successfully', {
        dataLength: data.length,
        context: context || 'default'
      });
      
      return result.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', { error, context });
      throw new Error('Failed to encrypt data');
    }
  }
  
  /**
   * Decrypt sensitive data
   * @param encryptedData - Base64 encoded encrypted data
   * @param context - Optional context for key derivation (must match encryption context)
   * @returns Decrypted data
   */
  decrypt(encryptedData: string, context?: string): string {
    try {
      // Convert from base64
      const data = Buffer.from(encryptedData, 'base64');
      
      // Extract IV, encrypted data, and tag
      const iv = data.subarray(0, ENCRYPTION_CONFIG.ivLength);
      const tag = data.subarray(data.length - ENCRYPTION_CONFIG.tagLength);
      const encrypted = data.subarray(ENCRYPTION_CONFIG.ivLength, data.length - ENCRYPTION_CONFIG.tagLength);
      
      // Derive decryption key from master key and context
      const decryptionKey = this.deriveKey(context);
      
      // Create decipher
      const decipher = crypto.createDecipher(ENCRYPTION_CONFIG.algorithm, decryptionKey);
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      logger.debug('Data decrypted successfully', {
        dataLength: decrypted.length,
        context: context || 'default'
      });
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error, context });
      throw new Error('Failed to decrypt data');
    }
  }
  
  /**
   * Derive encryption key from master key and context
   * @param context - Optional context for key derivation
   * @returns Derived key
   */
  private deriveKey(context?: string): Buffer {
    const salt = crypto.pbkdf2Sync(
      context || 'default',
      'chainsync-key-salt',
      1000,
      ENCRYPTION_CONFIG.keyLength,
      'sha256'
    );
    
    return crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      1000,
      ENCRYPTION_CONFIG.keyLength,
      'sha256'
    );
  }
  
  /**
   * Hash sensitive data (one-way encryption)
   * @param data - Data to hash
   * @param salt - Optional salt
   * @returns Hashed data
   */
  static hash(data: string, salt?: string): { hash: string; salt: string } {
    const generatedSalt = salt || crypto.randomBytes(ENCRYPTION_CONFIG.saltLength).toString('hex');
    const hash = crypto.pbkdf2Sync(data, generatedSalt, ENCRYPTION_CONFIG.iterations, 64, 'sha512');
    
    return {
      hash: hash.toString('hex'),
      salt: generatedSalt
    };
  }
  
  /**
   * Verify hashed data
   * @param data - Original data
   * @param hash - Stored hash
   * @param salt - Stored salt
   * @returns True if data matches hash
   */
  static verifyHash(data: string, hash: string, salt: string): boolean {
    const computedHash = crypto.pbkdf2Sync(data, salt, ENCRYPTION_CONFIG.iterations, 64, 'sha512');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), computedHash);
  }
  
  /**
   * Generate a secure random token
   * @param length - Token length in bytes
   * @returns Random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Generate a secure random password
   * @param length - Password length
   * @returns Random password
   */
  static generatePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Export utility functions
export const { hash, verifyHash, generateToken, generatePassword } = EncryptionService; 