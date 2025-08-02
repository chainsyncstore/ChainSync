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
export function createRequestHandler(): (_req: Request, _res: Response, _next: NextFunction)
   = > void {
  return (_req: Request, _res: Response, _next: NextFunction) => {
    // Sentry disabled - no-op
    next();
  };
}

/**
 * Create Sentry error handler middleware (no-op)
 */
export function createErrorHandler(): (_err: any, _req: Request, _res: Response, _next: NextFunction)
   = > void {
  return (_err: any, _req: Request, _res: Response, _next: NextFunction) => {
    // Sentry disabled - no-op
    next(err);
  };
}

/**
 * Configure Sentry for Express application (no-op)
 */
export function configureSentry(_app: Express): void {
  console.log('Sentry configuration skipped (disabled)');
}
