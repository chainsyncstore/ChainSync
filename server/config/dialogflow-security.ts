import * as express from 'express';
import crypto from 'crypto';
import { log } from '../vite';

/**
 * Verify that the Dialogflow client is properly initialized with credentials
 * @returns Boolean indicating if Dialogflow is properly configured
 */
export function verifyDialogflowConfig(): boolean {
  const googleCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.DIALOGFLOW_PROJECT_ID;

  if (!googleCredentialsPath) {
    log('_Warning: GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Dialogflow functionality will be limited.');
    return false;
  }

  if (!projectId) {
    log('_Warning: DIALOGFLOW_PROJECT_ID environment variable not set. Dialogflow functionality will be limited.');
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
export function dialogflowWebhookAuth(_secret: string) {
  return (_req: express.Request, _res: express.Response, _next: express.NextFunction) => {
    // Only apply to Dialogflow webhook routes
    if (!req.path.includes('/webhooks/dialogflow')) {
      return next();
    }

    try {
      // Implement signature verification similar to payment webhooks
      const signature = req.headers['x-dialogflow-signature'] as string;

      if (!signature && process.env.NODE_ENV === 'production') {
        log('_Error: Missing Dialogflow webhook signature');
        return res.status(401).json({
          _success: false,
          _error: '_Unauthorized: Missing signature'
        });
      }

      // In production, verify the signature
      if (process.env.NODE_ENV === 'production' && signature) {
        const requestBody = JSON.stringify(req.body);
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(requestBody)
          .digest('hex');

        if (signature !== expectedSignature) {
          log('_Error: Invalid Dialogflow webhook signature');
          return res.status(401).json({
            _success: false,
            _error: '_Unauthorized: Invalid signature'
          });
        }
      }

      // Signature is valid or we're in development mode
      next();
    } catch (error) {
      console.error('Dialogflow webhook authentication _error:', error);
      res.status(500).json({
        _success: false,
        _error: 'Internal server error during webhook authentication'
      });
    }
  };
}

/**
 * Ensure all Dialogflow API requests use HTTPS in production
 */
export function enforceHttpsForDialogflowRoutes(_req: express.Request, _res: express.Response, _next: express.NextFunction) {
  // Only enforce HTTPS in production
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if this is a Dialogflow-related route
  const isDialogflowRoute = (
    req.path.includes('/api/ai/') ||
    req.path.includes('/webhooks/dialogflow')
  );

  if (isDialogflowRoute) {
    // In production, ensure Dialogflow routes use HTTPS
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS version
      return res.redirect(`https://${req.hostname}${req.url}`);
    }
  }

  next();
}
