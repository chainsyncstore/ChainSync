/**
 * Centralized type definitions for user-related interfaces
 *
 * This ensures consistency across the application for user objects,
 * particularly in authentication middleware and request handlers.
 */

/**
 * Represents the detailed payload of an authenticated user.
 * When accessing req.user, it will need to be cast to this type
 * from the more generic type defined in the global Express.Request augmentation.
 * e.g., const specificUser = req.user as UserPayload;
 */
export interface UserPayload {
  id: string;
  role: string;
  name?: string;
  email?: string;
  storeId?: number;
  username?: string;
  permissions?: string[];
  sessionId?: string;
  createdAt?: string | Date | number; // Added for enhanced-rate-limit
  // Index signature to allow other properties if necessary,
  // though direct usage of UserPayload is preferred after casting.
  [key: string]: unknown;
}

// Global Express.Request augmentation is handled in server/types/express.d.ts
// to ensure it's the single point of augmentation for Express types.
