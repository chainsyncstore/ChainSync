// src/monitoring/setup.ts
// Sentry integration disabled - using no-op implementations

import { Express } from 'express';

/**
 * Initialize monitoring (disabled)
 */
export function initializeMonitoring(): void {
  console.log('Monitoring initialization is disabled');
}

/**
 * Setup monitoring for Express app (disabled)
 */
export function setupMonitoring(app?: Express): void {
  console.log('Monitoring setup is disabled');
}
