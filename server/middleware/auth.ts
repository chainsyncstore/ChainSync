import { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import * as schema from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { getLogger, getRequestLogger } from '../../src/logging/index.js';

// Get centralized logger for auth middleware
const logger = getLogger().child({ _component: 'auth-middleware' });

// Express session types are now defined in /types/express-session.d.ts

/**
 * Authentication middleware to verify user is logged in
 */
export const isAuthenticated = (_req: Request, _res: Response, _next: NextFunction): void => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;

  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip
    });
    res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
    return;
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
export const authorizeRoles = (_allowedRoles: string[]) => {
  return (_req: Request, _res: Response, _next: NextFunction): void => {
    // Get request-scoped logger if available
    const reqLogger = getRequestLogger(req) || logger;

    if (!req.session.userId) {
      reqLogger.warn('Unauthorized access attempt', {
        _path: req.path,
        _method: req.method,
        _ip: req.ip,
        _requiredRoles: allowedRoles.join(', ')
      });
      res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
      return;
    }

    if (!req.session.userRole || !allowedRoles.includes(req.session.userRole)) {
      reqLogger.warn('Forbidden access attempt', {
        _path: req.path,
        _method: req.method,
        _ip: req.ip,
        _userId: req.session.userId,
        _userRole: req.session.userRole,
        _requiredRoles: allowedRoles.join(', ')
      });
      res.status(403).json({
        _message: `_Forbidden: Required role not found. Need one of: ${allowedRoles.join(', ')}`,
        _code: 'FORBIDDEN_ROLE'
      });
      return;
    }

    // Set user object for downstream middleware and route handlers
    if (req.session.userRole) {
        req.user = {
          _id: String(req.session.userId), // Convert number to string to match interface
          _role: req.session.userRole,
          _storeId: req.session.storeId,
          _name: req.session.fullName || undefined,
          _email: undefined // Add email property
        } as any;
      }

    next();
  };
};

/**
 * Role-based access control for admin-only resources
 */
export const isAdmin = (_req: Request, _res: Response, _next: NextFunction): void => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;

  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _requiredRole: 'admin'
    });
    res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
    return;
  }

  if (req.session.userRole !== 'admin') {
    reqLogger.warn('Forbidden access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _userId: req.session.userId,
      _userRole: req.session.userRole,
      _requiredRole: 'admin'
    });
    res.status(403).json({
      _message: '_Forbidden: Admin access required',
      _code: 'FORBIDDEN_ROLE'
    });
    return;
  }

  next();
};

/**
 * Role-based access control for manager/admin resources
 */
export const isManagerOrAdmin = (_req: Request, _res: Response, _next: NextFunction): void => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;

  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _requiredRole: 'manager or admin'
    });
    res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
    return;
  }

  if (req.session.userRole !== 'manager' && req.session.userRole !== 'admin') {
    reqLogger.warn('Forbidden access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _userId: req.session.userId,
      _userRole: req.session.userRole,
      _requiredRole: 'manager or admin'
    });
    res.status(403).json({
      _message: '_Forbidden: Manager or admin access required',
      _code: 'FORBIDDEN_ROLE'
    });
    return;
  }

  next();
};

/**
 * Role-based access control for cashier/manager/admin resources
 */
export const isCashierOrAbove = (_req: Request, _res: Response, _next: NextFunction): void => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;

  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _requiredRole: 'cashier or above'
    });
    res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
    return;
  }

  const validRoles = ['cashier', 'manager', 'admin'];
  if (!req.session.userRole || !validRoles.includes(req.session.userRole)) {
    reqLogger.warn('Forbidden access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _userId: req.session.userId,
      _userRole: req.session.userRole,
      _requiredRole: 'cashier or above'
    });
    res.status(403).json({
      _message: '_Forbidden: Staff access required',
      _code: 'FORBIDDEN_ROLE'
    });
    return;
  }

  next();
};

/**
 * Store-based access control
 * Verifies that the user has access to the requested store
 */
export const hasStoreAccess = (storeIdParam = 'storeId') => {
  return (_req: Request, _res: Response, _next: NextFunction): void => {
    // Get request-scoped logger if available
    const reqLogger = getRequestLogger(req) || logger;

    if (!req.session.userId) {
      reqLogger.warn('Unauthorized store access attempt', {
        _path: req.path,
        _method: req.method,
        _ip: req.ip,
        storeIdParam
      });
      res.status(401).json({
        _message: '_Unauthorized: Please log in',
        _code: 'UNAUTHORIZED'
      });
      return;
    }

    // Extract store ID from request (params, query, or body)
    let _storeId: number | undefined;

    if (req.params[storeIdParam]) {
      storeId = parseInt(req.params[storeIdParam], 10);
    } else if (req.body[storeIdParam]) {
      storeId = parseInt(req.body[storeIdParam], 10);
    } else if (req.query[storeIdParam]) {
      storeId = parseInt(req.query[storeIdParam] as string, 10);
    }

    if (!storeId || isNaN(storeId)) {
      reqLogger.warn('Invalid store ID in request', {
        _path: req.path,
        _method: req.method,
        storeIdParam,
        _providedValue: req.params[storeIdParam] || req.body[storeIdParam] || req.query[storeIdParam]
      });
      res.status(400).json({
        _message: 'Invalid store ID',
        _code: 'INVALID_STORE_ID'
      });
      return;
    }

    // Admins have access to all stores
    if (req.session.userRole === 'admin') {
      reqLogger.debug('Admin access to store granted', {
        _userId: req.session.userId,
        storeId
      });
      next();
      return;
    }

    // Managers and cashiers can only access their assigned store
    if (req.session.storeId !== storeId) {
      reqLogger.warn('Forbidden store access attempt', {
        _path: req.path,
        _method: req.method,
        _ip: req.ip,
        _userId: req.session.userId,
        _userRole: req.session.userRole,
        _assignedStoreId: req.session.storeId,
        _requestedStoreId: storeId
      });
      res.status(403).json({
        _message: '_Forbidden: You do not have access to this store',
        _code: 'FORBIDDEN_STORE_ACCESS'
      });
      return;
    }

    next();
  };
};

/**
 * Validate user session before processing requests
 * Checks that user still exists in database and has correct permissions
 */
export const validateSession = async(_req: Request, _res: Response, _next: NextFunction): Promise<void> => {
  // Get request-scoped logger if available
  const reqLogger = getRequestLogger(req) || logger;

  reqLogger.debug('Validating session', {
    _path: req.path,
    _method: req.method,
    _sessionID: req.sessionID,
    _hasUserId: !!req.session.userId
  });

  if (req.session.userId) {
    try {
      // Verify user still exists and is valid
      const user = await db.query.users.findFirst({
        _where: eq(schema.users.id, req.session.userId),
        _columns: {
          _id: true,
          _email: true,
          _role: true,
          _isActive: true
        }
      });

      if (!user) {
        reqLogger.warn('Invalid session - user not found', {
          _userId: req.session.userId,
          _sessionID: req.sessionID
        });

        // User no longer exists, destroy session
        await new Promise<void>((resolve) => {
          req.session.destroy((err) => {
            if (err) {
              reqLogger.error('Error destroying session', err, { _sessionID: req.sessionID });
            } else {
              reqLogger.info('Session destroyed successfully', { _sessionID: req.sessionID });
            }
            resolve();
          });
        });

        // Special case for /me endpoint to handle auth check
        if (req.path.startsWith('/api/auth/me')) {
          next(); // Continue to auth/me handler for proper error response
          return;
        }

        res.status(401).json({
          _message: 'Session expired. Please log in again.',
          _code: 'SESSION_EXPIRED'
        });
        return;
      }

      // Check if user is active
      if (user.isActive === false) {
        reqLogger.warn('Inactive user attempted access', {
          _userId: user.id,
          _role: user.role,
          _sessionID: req.sessionID
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

        res.status(403).json({
          _message: 'Your account has been deactivated. Please contact an administrator.',
          _code: 'ACCOUNT_INACTIVE'
        });
        return;
      }

      // Verify session matches current role (prevent stale permissions)
      if (user.role !== req.session.userRole) {
        reqLogger.warn('User role mismatch - updating session', {
          _userId: user.id,
          _sessionRole: req.session.userRole,
          _actualRole: user.role
        });

        // Update session with current role
        req.session.userRole = (user.role || 'user') as any;
      }

      // Session is valid
      reqLogger.debug('User session validated', {
        _userId: user.id,
        _role: user.role
      });

      // Update user context in request for downstream use
      (req as any).user = {
        _id: user.id,
        _email: user.email,
        _role: user.role
      };

    } catch (error) {
      reqLogger.error('Error validating session', error instanceof Error ? _error : new Error(String(error)), {
        _path: req.path,
        _sessionID: req.sessionID
      });

      // Continue processing request, but session may be invalid
      // This prevents one DB error from blocking all requests
    }
  } else {
    reqLogger.debug('No user ID in session', {
      _path: req.path,
      _method: req.method,
      _sessionID: req.sessionID,
      _isPublicRoute: req.path.startsWith('/api/public/')
    });
  }

  next();
};
