import { Express } from 'express';
import { initTracing } from '../../src/monitoring/tracing';
import healthRouter from '../routes/health';

export function initializeTracing() {
  initTracing();
}

export function initializeHealthChecks(_app: Express) {
  app.use('/health', healthRouter);
}
