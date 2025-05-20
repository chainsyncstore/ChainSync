import cors from 'cors';
import express, { Express } from 'express';
import { env } from '../config/env';

// Define CORS options
const corsOptions = {
  origin: env.ALLOWED_ORIGINS,
  methods: env.ALLOWED_METHODS.split(','),
  allowedHeaders: env.ALLOWED_HEADERS.split(','),
  credentials: true,
  optionsSuccessStatus: 204,
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
};

// Create CORS middleware
export const corsMiddleware = cors(corsOptions);

// Helper function to apply CORS to specific routes
export function applyCORS(app: Express) {
  // Apply CORS to all routes
  app.use(corsMiddleware);
  
  // Add preflight request handler
  app.options('*', cors());
}
