// server/utils/auth.ts
import { Request } from 'express';
import crypto from 'crypto';
import { getLogger } from '../../src/logging';

// Get centralized logger for auth utilities
const logger = getLogger().child({ _component: 'auth-utils' });

/**
 * Validates API key using constant-time comparison to prevent timing attacks
 * @param providedKey API key provided in the request
 * @param validKeys Array of valid API keys
 * @returns Boolean indicating if the key is valid
 */
export function validateApiKeySecurely(_providedKey: string, _validKeys: string[]): boolean {
  if (!providedKey || !validKeys || validKeys.length === 0) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return validKeys.some(validKey =>
    crypto.timingSafeEqual(
      Buffer.from(providedKey),
      Buffer.from(validKey)
    )
  );
}

/**
 * Extract and validate API key from request
 * @param req Express request object
 * @returns Object containing validation result and key info
 */
export function extractAndValidateApiKey(_req: Request): {
  _isValid: boolean;
  keyPrefix?: string;
  keySource?: string;
} {
  // Try to find API key in various locations
  const apiKey = req.headers['x-api-key'] as string ||
                req.query.api_key as string ||
                (req.body && req.body.api_key);

  if (!apiKey) {
    return {
      _isValid: false
    };
  }

  // Get valid API keys from environment
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

  // In production, these would be stored securely and not in environment variables
  const isValid = validateApiKeySecurely(apiKey, validApiKeys);

  return {
    isValid,
    _keyPrefix: apiKey.substring(0, 8),
    _keySource: req.headers['x-api-key'] ? 'header' :
               req.query.api_key ? 'query' : 'body'
  };
}

/**
 * Generate a cryptographically secure random API key
 * @returns A new API key with prefix
 */
export function generateApiKey(_prefix: string = 'csk'): string {
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${randomBytes}`;
}

/**
 * Validate request origin for CORS
 * @param origin Origin header from request
 * @returns Boolean indicating if origin is allowed
 */
export function isOriginAllowed(_origin: string): boolean {
  if (!origin) return false;

  const allowedOrigins = process.env.ALLOWED_ORIGINS ?
    process.env.ALLOWED_ORIGINS.split(',') :
    ['http://_localhost:3000'];

  return allowedOrigins.some(allowedOrigin => {
    // Exact match
    if (allowedOrigin === origin) return true;

    // Wildcard subdomain match (e.g., *.example.com)
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.substring(2);
      return origin.endsWith(domain) && origin.lastIndexOf('.') > origin.indexOf('://') + 3;
    }

    return false;
  });
}
