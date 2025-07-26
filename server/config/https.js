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
exports.setupSecureServer = setupSecureServer;
exports.enforceHttpsForPaymentRoutes = enforceHttpsForPaymentRoutes;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const socket_io_1 = require("socket.io");
const vite_1 = require("../vite");
/**
 * Configure server for HTTPS in production and HTTP in development
 * @param app Express application
 * @returns HTTP or HTTPS server
 */
function setupSecureServer(app) {
    // Check environment
    const isProduction = process.env.NODE_ENV === 'production';
    let server;
    if (isProduction) {
        try {
            // In production, attempt to load SSL certificates
            // These paths would be set up in a production environment
            const sslPath = process.env.SSL_PATH || '/etc/ssl/certs';
            // Check if SSL certificates exist
            if (fs.existsSync(path.join(sslPath, 'private-key.pem')) &&
                fs.existsSync(path.join(sslPath, 'certificate.pem'))) {
                const privateKey = fs.readFileSync(path.join(sslPath, 'private-key.pem'), 'utf8');
                const certificate = fs.readFileSync(path.join(sslPath, 'certificate.pem'), 'utf8');
                // Create HTTPS server
                (0, vite_1.log)('Starting HTTPS server in production mode');
                server = https.createServer({
                    key: privateKey,
                    cert: certificate,
                }, app);
            }
            else {
                (0, vite_1.log)('SSL certificates not found, falling back to HTTP server in production');
                server = http.createServer(app);
            }
        }
        catch (error) {
            console.error('Error setting up HTTPS server:', error);
            (0, vite_1.log)('Failed to set up HTTPS server, falling back to HTTP');
            server = http.createServer(app);
        }
    }
    else {
        // In development, use HTTP server
        (0, vite_1.log)('Starting HTTP server in development mode');
        server = http.createServer(app);
    }
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    return { server, io };
}
/**
 * Function to enforce HTTPS for payment-related routes in production
 */
function enforceHttpsForPaymentRoutes(req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';
    // Check if this is a payment-related route
    const isPaymentRoute = (req.path.includes('/api/payment') ||
        req.path.includes('/api/webhooks') ||
        req.path.includes('/checkout') ||
        req.path.includes('/verify-payment'));
    if (isProduction && isPaymentRoute) {
        // In production, ensure payment routes use HTTPS
        if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
            // Redirect to HTTPS version
            return res.redirect(`https://${req.hostname}${req.url}`);
        }
    }
    next();
}
