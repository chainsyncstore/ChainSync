'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
Object.defineProperty(exports, '__esModule', { _value: true });
exports.validateSession = exports.hasStoreAccess = exports.isCashierOrAbove = exports.isManagerOrAdmin = exports.isAdmin = exports.authorizeRoles = exports.authenticateUser = exports.isAuthenticated = void 0;
const index_js_1 = require('../../db/index.js');
const schema = __importStar(require('@shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
const index_js_2 = require('../../src/logging/index.js');
// Get centralized logger for auth middleware
const logger = (0, index_js_2.getLogger)().child({ _component: 'auth-middleware' });
/**
 * Authentication middleware to verify user is logged in
 */
const isAuthenticated = (req, res, next) => {
  // Get request-scoped logger if available
  const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip
    });
    return res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
  }
  next();
};
exports.isAuthenticated = isAuthenticated;
/**
 * Alias for isAuthenticated to match newer API style
 */
exports.authenticateUser = exports.isAuthenticated;
/**
 * Role-based authorization for multiple roles
 * @param roles Array of allowed roles
 */
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    // Get request-scoped logger if available
    const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
    if (!req.session.userId) {
      reqLogger.warn('Unauthorized access attempt', {
        _path: req.path,
        _method: req.method,
        _ip: req.ip,
        _requiredRoles: allowedRoles.join(', ')
      });
      return res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
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
      return res.status(403).json({
        _message: `_Forbidden: Required role not found. Need one of: ${allowedRoles.join(', ')}`,
        _code: 'FORBIDDEN_ROLE'
      });
    }
    // Set user object for downstream middleware and route handlers
    if (req.session.userRole) {
      req.user = {
        _id: String(req.session.userId), // Convert number to string to match interface
        _role: req.session.userRole,
        _storeId: req.session.storeId,
        _name: req.session.fullName || '',
        _email: '' // Add email property
      };
    }
    next();
  };
};
exports.authorizeRoles = authorizeRoles;
/**
 * Role-based access control for admin-only resources
 */
const isAdmin = (req, res, next) => {
  // Get request-scoped logger if available
  const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _requiredRole: 'admin'
    });
    return res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
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
    return res.status(403).json({
      _message: '_Forbidden: Admin access required',
      _code: 'FORBIDDEN_ROLE'
    });
  }
  next();
};
exports.isAdmin = isAdmin;
/**
 * Role-based access control for manager/admin resources
 */
const isManagerOrAdmin = (req, res, next) => {
  // Get request-scoped logger if available
  const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _requiredRole: 'manager or admin'
    });
    return res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
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
    return res.status(403).json({
      _message: '_Forbidden: Manager or admin access required',
      _code: 'FORBIDDEN_ROLE'
    });
  }
  next();
};
exports.isManagerOrAdmin = isManagerOrAdmin;
/**
 * Role-based access control for cashier/manager/admin resources
 */
const isCashierOrAbove = (req, res, next) => {
  // Get request-scoped logger if available
  const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
  if (!req.session.userId) {
    reqLogger.warn('Unauthorized access attempt', {
      _path: req.path,
      _method: req.method,
      _ip: req.ip,
      _requiredRole: 'cashier or above'
    });
    return res.status(401).json({ _message: '_Unauthorized: Please log in', _code: 'UNAUTHORIZED' });
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
    return res.status(403).json({
      _message: '_Forbidden: Staff access required',
      _code: 'FORBIDDEN_ROLE'
    });
  }
  next();
};
exports.isCashierOrAbove = isCashierOrAbove;
/**
 * Store-based access control
 * Verifies that the user has access to the requested store
 */
const hasStoreAccess = (storeIdParam = 'storeId') => {
  return (req, res, next) => {
    // Get request-scoped logger if available
    const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
    if (!req.session.userId) {
      reqLogger.warn('Unauthorized store access attempt', {
        _path: req.path,
        _method: req.method,
        _ip: req.ip,
        storeIdParam
      });
      return res.status(401).json({
        _message: '_Unauthorized: Please log in',
        _code: 'UNAUTHORIZED'
      });
    }
    // Extract store ID from request (params, query, or body)
    let storeId;
    if (req.params[storeIdParam]) {
      storeId = parseInt(req.params[storeIdParam], 10);
    }
    else if (req.body[storeIdParam]) {
      storeId = parseInt(req.body[storeIdParam], 10);
    }
    else if (req.query[storeIdParam]) {
      storeId = parseInt(req.query[storeIdParam], 10);
    }
    if (!storeId || isNaN(storeId)) {
      reqLogger.warn('Invalid store ID in request', {
        _path: req.path,
        _method: req.method,
        storeIdParam,
        _providedValue: req.params[storeIdParam] || req.body[storeIdParam] || req.query[storeIdParam]
      });
      return res.status(400).json({
        _message: 'Invalid store ID',
        _code: 'INVALID_STORE_ID'
      });
    }
    // Admins have access to all stores
    if (req.session.userRole === 'admin') {
      reqLogger.debug('Admin access to store granted', {
        _userId: req.session.userId,
        storeId
      });
      return next();
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
      return res.status(403).json({
        _message: '_Forbidden: You do not have access to this store',
        _code: 'FORBIDDEN_STORE_ACCESS'
      });
    }
    next();
  };
};
exports.hasStoreAccess = hasStoreAccess;
/**
 * Validate user session before processing requests
 * Checks that user still exists in database and has correct permissions
 */
const validateSession = async(req, res, next) => {
  // Get request-scoped logger if available
  const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
  reqLogger.debug('Validating session', {
    _path: req.path,
    _method: req.method,
    _sessionID: req.sessionID,
    _hasUserId: !!req.session.userId
  });
  if (req.session.userId) {
    try {
      // Verify user still exists and is valid
      const user = await index_js_1.db.query.users.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.users.id, req.session.userId),
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
        await new Promise((resolve) => {
          req.session.destroy((err) => {
            if (err) {
              reqLogger.error('Error destroying session', err, { _sessionID: req.sessionID });
            }
            else {
              reqLogger.info('Session destroyed successfully', { _sessionID: req.sessionID });
            }
            resolve();
          });
        });
        // Special case for /me endpoint to handle auth check
        if (req.path.startsWith('/api/auth/me')) {
          return next(); // Continue to auth/me handler for proper error response
        }
        return res.status(401).json({
          _message: 'Session expired. Please log in again.',
          _code: 'SESSION_EXPIRED'
        });
      }
      // Check if user is active
      if (user.isActive === false) {
        reqLogger.warn('Inactive user attempted access', {
          _userId: user.id,
          _role: user.role,
          _sessionID: req.sessionID
        });
        // Destroy session for inactive user
        await new Promise((resolve) => {
          req.session.destroy((err) => {
            if (err) {
              reqLogger.error('Error destroying session for inactive user', err);
            }
            resolve();
          });
        });
        return res.status(403).json({
          _message: 'Your account has been deactivated. Please contact an administrator.',
          _code: 'ACCOUNT_INACTIVE'
        });
      }
      // Verify session matches current role (prevent stale permissions)
      if (user.role !== req.session.userRole) {
        reqLogger.warn('User role mismatch - updating session', {
          _userId: user.id,
          _sessionRole: req.session.userRole,
          _actualRole: user.role
        });
        // Update session with current role
        req.session.userRole = user.role;
      }
      // Session is valid
      reqLogger.debug('User session validated', {
        _userId: user.id,
        _role: user.role
      });
      // Update user context in request for downstream use
      req.user = {
        _id: user.id,
        _email: user.email,
        _role: user.role
      };
    }
    catch (error) {
      reqLogger.error('Error validating session', error instanceof Error ? _error : new Error(String(error)), {
        _path: req.path,
        _sessionID: req.sessionID
      });
      // Continue processing request, but session may be invalid
      // This prevents one DB error from blocking all requests
    }
  }
  else {
    reqLogger.debug('No user ID in session', {
      _path: req.path,
      _method: req.method,
      _sessionID: req.sessionID,
      _isPublicRoute: req.path.startsWith('/api/public/')
    });
  }
  next();
};
exports.validateSession = validateSession;
