// src/monitoring/sentryIntegration.ts
// Sentry integration disabled - using no-op implementations

import { Express, Request, Response, NextFunction } from 'express';

/**
 * Initialize Sentry monitoring (disabled)
 */
export function initializeSentry(): void {
  console.log('Sentry integration is disabled');
}

/**
 * Create Sentry request handler middleware (no-op)
 */
export function createRequestHandler(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    // Sentry disabled - no-op
    next();
  };
}

/**
 * Create Sentry error handler middleware (no-op)
 */
export function createErrorHandler(): (err: any, req: Request, res: Response, next: NextFunction) => void {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    // Sentry disabled - no-op
    next(err);
  };
}

/**
 * Configure Sentry for Express application (no-op)
 */
export function configureSentry(app: Express): void {
  console.log('Sentry configuration skipped (disabled)');
}
