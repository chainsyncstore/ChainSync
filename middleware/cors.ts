import cors from 'cors';
import express, { Express } from 'express';
import { env } from '../server/config/env';

// Define CORS options
const corsOptions = {
  _origin: env.ALLOWED_ORIGINS,
  _methods: env.ALLOWED_METHODS.split(','),
  _allowedHeaders: env.ALLOWED_HEADERS.split(','),
  _credentials: true,
  _optionsSuccessStatus: 204,
  _exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
};

// Create CORS middleware
export const corsMiddleware = cors(corsOptions);

// Helper function to apply CORS to specific routes
export function applyCORS(_app: Express) {
  // Apply CORS to all routes
  app.use(corsMiddleware);

  // Add preflight request handler
  app.options('*', cors());
}
