"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDialogflowConfig = verifyDialogflowConfig;
exports.dialogflowWebhookAuth = dialogflowWebhookAuth;
exports.enforceHttpsForDialogflowRoutes = enforceHttpsForDialogflowRoutes;
const crypto_1 = __importDefault(require("crypto"));
const vite_1 = require("../vite");
/**
 * Verify that the Dialogflow client is properly initialized with credentials
 * @returns Boolean indicating if Dialogflow is properly configured
 */
function verifyDialogflowConfig() {
    const googleCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const projectId = process.env.DIALOGFLOW_PROJECT_ID;
    if (!googleCredentialsPath) {
        (0, vite_1.log)('Warning: GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Dialogflow functionality will be limited.');
        return false;
    }
    if (!projectId) {
        (0, vite_1.log)('Warning: DIALOGFLOW_PROJECT_ID environment variable not set. Dialogflow functionality will be limited.');
        return false;
    }
    return true;
}
/**
 * Middleware to secure Dialogflow webhook endpoints
 * This middleware validates requests to Dialogflow webhook endpoints
 *
 * @param secret The secret used to verify webhook signatures
 * @returns Express middleware function
 */
function dialogflowWebhookAuth(secret) {
    return (req, res, next) => {
        // Only apply to Dialogflow webhook routes
        if (!req.path.includes('/webhooks/dialogflow')) {
            return next();
        }
        try {
            // Implement signature verification similar to payment webhooks
            const signature = req.headers['x-dialogflow-signature'];
            if (!signature && process.env.NODE_ENV === 'production') {
                (0, vite_1.log)('Error: Missing Dialogflow webhook signature');
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized: Missing signature'
                });
            }
            // In production, verify the signature
            if (process.env.NODE_ENV === 'production' && signature) {
                const requestBody = JSON.stringify(req.body);
                const expectedSignature = crypto_1.default
                    .createHmac('sha256', secret)
                    .update(requestBody)
                    .digest('hex');
                if (signature !== expectedSignature) {
                    (0, vite_1.log)('Error: Invalid Dialogflow webhook signature');
                    return res.status(401).json({
                        success: false,
                        error: 'Unauthorized: Invalid signature'
                    });
                }
            }
            // Signature is valid or we're in development mode
            next();
        }
        catch (error) {
            console.error('Dialogflow webhook authentication error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during webhook authentication'
            });
        }
    };
}
/**
 * Ensure all Dialogflow API requests use HTTPS in production
 */
function enforceHttpsForDialogflowRoutes(req, res, next) {
    // Only enforce HTTPS in production
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }
    // Check if this is a Dialogflow-related route
    const isDialogflowRoute = (req.path.includes('/api/ai/') ||
        req.path.includes('/webhooks/dialogflow'));
    if (isDialogflowRoute) {
        // In production, ensure Dialogflow routes use HTTPS
        if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
            // Redirect to HTTPS version
            return res.redirect(`https://${req.hostname}${req.url}`);
        }
    }
    next();
}
