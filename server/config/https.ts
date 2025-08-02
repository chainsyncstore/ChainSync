import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { log } from '../vite';

/**
 * Configure server for HTTPS in production and HTTP in development
 * @param app Express application
 * @returns HTTP or HTTPS server
 */
export function setupSecureServer(
  _app: express.Express
): { _server: http.Server | https.Server; _io: SocketIOServer } {
  // Check environment
  const isProduction = process.env.NODE_ENV === 'production';
  let _server: http.Server | https.Server;
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
        server = https.createServer(
          {
            _key: privateKey,
            _cert: certificate
          },
          app
        );
      } else {
        log('SSL certificates not found, falling back to HTTP server in production');
        server = http.createServer(app);
      }
    } catch (error) {
      console.error('Error setting up HTTPS _server:', error);
      log('Failed to set up HTTPS server, falling back to HTTP');
      server = http.createServer(app);
    }
  } else {
    // In development, use HTTP server
    log('Starting HTTP server in development mode');
    server = http.createServer(app);
  }
  const io = new SocketIOServer(server, {
    _cors: {
      origin: '*',
      _methods: ['GET', 'POST']
    }
  });

  return { server, io };
}

/**
 * Function to enforce HTTPS for payment-related routes in production
 */
export function enforceHttpsForPaymentRoutes(_req: express.Request, _res: express.Response, _next: express.NextFunction) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Check if this is a payment-related route
  const isPaymentRoute = (
    req.path.includes('/api/payment') ||
    req.path.includes('/api/webhooks') ||
    req.path.includes('/checkout') ||
    req.path.includes('/verify-payment')
  );

  if (isProduction && isPaymentRoute) {
    // In production, ensure payment routes use HTTPS
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS version
      return res.redirect(`https://${req.hostname}${req.url}`);
    }
  }

  next();
}
