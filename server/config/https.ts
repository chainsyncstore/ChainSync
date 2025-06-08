import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';

import express from 'express';

import { log } from '../vite';

/**
 * Configure server for HTTPS in production and HTTP in development
 * @param app Express application
 * @returns HTTP or HTTPS server
 */
export function setupSecureServer(app: express.Express): http.Server | https.Server {
  // Check environment
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    try {
      // In production, attempt to load SSL certificates
      // These paths would be set up in a production environment
      const sslPath = process.env.SSL_PATH || '/etc/ssl/certs';

      // Check if SSL certificates exist
      if (
        fs.existsSync(path.join(sslPath, 'private-key.pem')) &&
        fs.existsSync(path.join(sslPath, 'certificate.pem'))
      ) {
        const privateKey = fs.readFileSync(path.join(sslPath, 'private-key.pem'), 'utf8');
        const certificate = fs.readFileSync(path.join(sslPath, 'certificate.pem'), 'utf8');

        // Create HTTPS server
        log('Starting HTTPS server in production mode');
        return https.createServer(
          {
            key: privateKey,
            cert: certificate,
          },
          app
        );
      } else {
        log('SSL certificates not found, falling back to HTTP server in production');
        return http.createServer(app);
      }
    } catch (error: unknown) {
      console.error('Error setting up HTTPS server:', error);
      log('Failed to set up HTTPS server, falling back to HTTP');
      return http.createServer(app);
    }
  } else {
    // In development, use HTTP server
    log('Starting HTTP server in development mode');
    return http.createServer(app);
  }
}

/**
 * Function to enforce HTTPS for payment-related routes in production
 */
export function enforceHttpsForPaymentRoutes(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Check if this is a payment-related route
  const isPaymentRoute =
    req.path.includes('/api/payment') ||
    req.path.includes('/api/webhooks') ||
    req.path.includes('/checkout') ||
    req.path.includes('/verify-payment');

  if (isProduction && isPaymentRoute) {
    // In production, ensure payment routes use HTTPS
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS version
      return res.redirect(`https://${req.hostname}${req.url}`);
    }
  }

  next();
}
