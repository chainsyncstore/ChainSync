/**
 * Centralized type definitions for user-related interfaces
 * 
 * This ensures consistency across the application for user objects,
 * particularly in authentication middleware and request handlers.
 */

/**
 * Represents a user in the system with consistent property naming
 */
export interface User {
  /**
   * User's unique identifier
   */
  id: string;
  
  /**
   * User's role (admin, manager, cashier, viewer)
   */
  role: string;
  
  /**
   * User's store identifier (optional)
   */
  storeId?: number;
  
  /**
   * User's display name
   */
  name: string;
  
  /**
   * User's email address
   */
  email?: string;
  
  /**
   * User's permissions
   */
  permissions?: string[];
  
  /**
   * Current session identifier
   */
  sessionId?: string;
}

/**
 * Extends Express Request interface to include user property
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user information
       */
      user?: User;
    }
  }
}
