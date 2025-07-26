"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSession = exports.hasStoreAccess = exports.isCashierOrAbove = exports.isManagerOrAdmin = exports.isAdmin = exports.authorizeRoles = exports.authenticateUser = exports.isAuthenticated = void 0;
const index_js_1 = require("../../db/index.js");
const schema = __importStar(require("@shared/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const index_js_2 = require("../../src/logging/index.js");
// Get centralized logger for auth middleware
const logger = (0, index_js_2.getLogger)().child({ component: 'auth-middleware' });
/**
 * Authentication middleware to verify user is logged in
 */
const isAuthenticated = (req, res, next) => {
    // Get request-scoped logger if available
    const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
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
exports.authorizeRoles = authorizeRoles;
/**
 * Role-based access control for admin-only resources
 */
const isAdmin = (req, res, next) => {
    // Get request-scoped logger if available
    const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
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
exports.isAdmin = isAdmin;
/**
 * Role-based access control for manager/admin resources
 */
const isManagerOrAdmin = (req, res, next) => {
    // Get request-scoped logger if available
    const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
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
exports.isManagerOrAdmin = isManagerOrAdmin;
/**
 * Role-based access control for cashier/manager/admin resources
 */
const isCashierOrAbove = (req, res, next) => {
    // Get request-scoped logger if available
    const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
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
exports.hasStoreAccess = hasStoreAccess;
/**
 * Validate user session before processing requests
 * Checks that user still exists in database and has correct permissions
 */
const validateSession = async (req, res, next) => {
    // Get request-scoped logger if available
    const reqLogger = (0, index_js_2.getRequestLogger)(req) || logger;
    reqLogger.debug('Validating session', {
        path: req.path,
        method: req.method,
        sessionID: req.sessionID,
        hasUserId: !!req.session.userId
    });
    if (req.session.userId) {
        try {
            // Verify user still exists and is valid
            const user = await index_js_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.users.id, req.session.userId),
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
                await new Promise((resolve) => {
                    req.session.destroy((err) => {
                        if (err) {
                            reqLogger.error('Error destroying session', err, { sessionID: req.sessionID });
                        }
                        else {
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
                await new Promise((resolve) => {
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
                req.session.userRole = user.role;
            }
            // Session is valid
            reqLogger.debug('User session validated', {
                userId: user.id,
                role: user.role
            });
            // Update user context in request for downstream use
            req.user = {
                id: user.id,
                email: user.email,
                role: user.role
            };
        }
        catch (error) {
            reqLogger.error('Error validating session', error instanceof Error ? error : new Error(String(error)), {
                path: req.path,
                sessionID: req.sessionID
            });
            // Continue processing request, but session may be invalid
            // This prevents one DB error from blocking all requests
        }
    }
    else {
        reqLogger.debug('No user ID in session', {
            path: req.path,
            method: req.method,
            sessionID: req.sessionID,
            isPublicRoute: req.path.startsWith('/api/public/')
        });
    }
    next();
};
exports.validateSession = validateSession;
