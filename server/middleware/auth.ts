import { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import * as schema from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { getLogger, getRequestLogger } from '../../src/logging/index.js';

// Get centralized logger for auth middleware
const logger = getLogger().child({ component: 'auth-middleware' });

// Define user interface for express requests

declare module 'express-session' {
  interface SessionData {
    userId: number;
    userRole: string;
    storeId?: number;
    fullName: string;
  }
}

/**
 * Authentication middleware to verify user is logged in
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;
  
  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({ message: 'Unauthorized: Please log in', code: 'UNAUTHORIZED' });
  }
  
  next();
};

/**
 * Alias for isAuthenticated to match newer API style
 */
export const authenticateUser = isAuthenticated;

/**
 * Role-based authorization for multiple roles
 * @param roles Array of allowed roles
 */
export const authorizeRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get request-scoped logger if available
    const reqLogger = getRequestLogger(req) || logger;
    
    if (!req.session.userId) {
      reqLogger.warn('Unauthorized access attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        requiredRoles: allowedRoles.join(', ')
      });
      return res.status(401).json({ message: 'Unauthorized: Please log in', code: 'UNAUTHORIZED' });
    }
    
    if (!req.session.userRole || !allowedRoles.includes(req.session.userRole)) {
      reqLogger.warn('Forbidden access attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.session.userId,
        userRole: req.session.userRole,
        requiredRoles: allowedRoles.join(', ')
      });
      return res.status(403).json({ 
        message: `Forbidden: Required role not found. Need one of: ${allowedRoles.join(', ')}`, 
        code: 'FORBIDDEN_ROLE'
      });
    }
    
    // Set user object for downstream middleware and route handlers
    if (req.session.userRole) {
        req.user = {
          id: String(req.session.userId), // Convert number to string to match interface
          role: req.session.userRole,
          storeId: req.session.storeId,
          name: req.session.fullName || '',
          email: '' // Add email property
        };
      }
    
    next();
  };
};

/**
 * Role-based access control for admin-only resources
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;
  
  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      requiredRole: 'admin'
    });
    return res.status(401).json({ message: 'Unauthorized: Please log in', code: 'UNAUTHORIZED' });
  }
  
  if (req.session.userRole !== 'admin') {
    reqLogger.warn('Forbidden access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.session.userId,
      userRole: req.session.userRole,
      requiredRole: 'admin'
    });
    return res.status(403).json({ 
      message: 'Forbidden: Admin access required', 
      code: 'FORBIDDEN_ROLE'
    });
  }
  
  next();
};

/**
 * Role-based access control for manager/admin resources
 */
export const isManagerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;
  
  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      requiredRole: 'manager or admin'
    });
    return res.status(401).json({ message: 'Unauthorized: Please log in', code: 'UNAUTHORIZED' });
  }
  
  if (req.session.userRole !== 'manager' && req.session.userRole !== 'admin') {
    reqLogger.warn('Forbidden access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.session.userId,
      userRole: req.session.userRole,
      requiredRole: 'manager or admin'
    });
    return res.status(403).json({ 
      message: 'Forbidden: Manager or admin access required', 
      code: 'FORBIDDEN_ROLE'
    });
  }
  
  next();
};

/**
 * Role-based access control for cashier/manager/admin resources
 */
export const isCashierOrAbove = (req: Request, res: Response, next: NextFunction) => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;
  
  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      requiredRole: 'cashier or above'
    });
    return res.status(401).json({ message: 'Unauthorized: Please log in', code: 'UNAUTHORIZED' });
  }
  
  const validRoles = ['cashier', 'manager', 'admin'];
  if (!req.session.userRole || !validRoles.includes(req.session.userRole)) {
    reqLogger.warn('Forbidden access attempt', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.session.userId,
      userRole: req.session.userRole,
      requiredRole: 'cashier or above'
    });
    return res.status(403).json({ 
      message: 'Forbidden: Staff access required', 
      code: 'FORBIDDEN_ROLE'
    });
  }
  
  next();
};

/**
 * Store-based access control
 * Verifies that the user has access to the requested store
 */
export const hasStoreAccess = (storeIdParam = 'storeId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get request-scoped logger if available
    const reqLogger = getRequestLogger(req) || logger;
    
    if (!req.session.userId) {
      reqLogger.warn('Unauthorized store access attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        storeIdParam
      });
      return res.status(401).json({ 
        message: 'Unauthorized: Please log in', 
        code: 'UNAUTHORIZED' 
      });
    }
    
    // Extract store ID from request (params, query, or body)
    let storeId: number | undefined;
    
    if (req.params[storeIdParam]) {
      storeId = parseInt(req.params[storeIdParam], 10);
    } else if (req.body[storeIdParam]) {
      storeId = parseInt(req.body[storeIdParam], 10);
    } else if (req.query[storeIdParam]) {
      storeId = parseInt(req.query[storeIdParam] as string, 10);
    }
    
    if (!storeId || isNaN(storeId)) {
      reqLogger.warn('Invalid store ID in request', {
        path: req.path,
        method: req.method,
        storeIdParam,
        providedValue: req.params[storeIdParam] || req.body[storeIdParam] || req.query[storeIdParam]
      });
      return res.status(400).json({ 
        message: 'Invalid store ID', 
        code: 'INVALID_STORE_ID' 
      });
    }
    
    // Admins have access to all stores
    if (req.session.userRole === 'admin') {
      reqLogger.debug('Admin access to store granted', {
        userId: req.session.userId,
        storeId
      });
      return next();
    }
    
    // Managers and cashiers can only access their assigned store
    if (req.session.storeId !== storeId) {
      reqLogger.warn('Forbidden store access attempt', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.session.userId,
        userRole: req.session.userRole,
        assignedStoreId: req.session.storeId,
        requestedStoreId: storeId
      });
      return res.status(403).json({ 
        message: 'Forbidden: You do not have access to this store', 
        code: 'FORBIDDEN_STORE_ACCESS' 
      });
    }
    
    next();
  };
};

/**
 * Validate user session before processing requests
 * Checks that user still exists in database and has correct permissions
 */
export const validateSession = async (req: Request, res: Response, next: NextFunction) => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;
  
  reqLogger.debug('Validating session', {
    path: req.path,
    method: req.method,
    sessionID: req.sessionID,
    hasUserId: !!req.session.userId
  });
  
  if (req.session.userId) {
    try {
      // Verify user still exists and is valid
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, req.session.userId),
        columns: {
          id: true,
          email: true,
          role: true,
          isActive: true
        }
      });
      
      if (!user) {
        reqLogger.warn('Invalid session - user not found', {
          userId: req.session.userId,
          sessionID: req.sessionID
        });
        
        // User no longer exists, destroy session
        await new Promise<void>((resolve) => {
          req.session.destroy((err) => {
            if (err) {
              reqLogger.error('Error destroying session', err, { sessionID: req.sessionID });
            } else {
              reqLogger.info('Session destroyed successfully', { sessionID: req.sessionID });
            }
            resolve();
          });
        });
        
        // Special case for /me endpoint to handle auth check
        if (req.path.startsWith('/api/auth/me')) {
          return next(); // Continue to auth/me handler for proper error response
        }
        
        return res.status(401).json({ 
          message: 'Session expired. Please log in again.', 
          code: 'SESSION_EXPIRED' 
        });
      }
      
      // Check if user is active
      if (user.isActive === false) {
        reqLogger.warn('Inactive user attempted access', {
          userId: user.id,
          role: user.role,
          sessionID: req.sessionID
        });
        
        // Destroy session for inactive user
        await new Promise<void>((resolve) => {
          req.session.destroy((err) => {
            if (err) {
              reqLogger.error('Error destroying session for inactive user', err);
            }
            resolve();
          });
        });
        
        return res.status(403).json({ 
          message: 'Your account has been deactivated. Please contact an administrator.', 
          code: 'ACCOUNT_INACTIVE' 
        });
      }
      
      // Verify session matches current role (prevent stale permissions)
      if (user.role !== req.session.userRole) {
        reqLogger.warn('User role mismatch - updating session', {
          userId: user.id,
          sessionRole: req.session.userRole,
          actualRole: user.role
        });
        
        // Update session with current role
        req.session.userRole = user.role as string;
      }
      
      // Session is valid
      reqLogger.debug('User session validated', {
        userId: user.id,
        role: user.role
      });
      
      // Update user context in request for downstream use
      (req as any).user = {
        id: user.id,
        email: user.email,
        role: user.role
      };
      
    } catch (error) {
      reqLogger.error('Error validating session', error instanceof Error ? error : new Error(String(error)), {
        path: req.path,
        sessionID: req.sessionID
      });
      
      // Continue processing request, but session may be invalid
      // This prevents one DB error from blocking all requests
    }
  } else {
    reqLogger.debug('No user ID in session', {
      path: req.path,
      method: req.method,
      sessionID: req.sessionID,
      isPublicRoute: req.path.startsWith('/api/public/')
    });
  }
  
  next();
};
