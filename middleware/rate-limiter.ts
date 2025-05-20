import rateLimit from 'express-rate-limit';
import express, { Express } from 'express';
import { env } from '../config/env';

// API rate limiter
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 seconds
  max: env.RATE_LIMIT_MAX_REQUESTS, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  }
});

// Payment API rate limiter (more strict)
export const paymentLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 seconds
  max: Math.floor(env.RATE_LIMIT_MAX_REQUESTS / 2), // Half the normal limit for payment APIs
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many payment requests from this IP, please try again later.'
    }
  }
});

// Auth rate limiter (even more strict)
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 seconds
  max: 5, // Only 5 attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please wait a few minutes before trying again.'
    }
  }
});

// Helper function to apply rate limiting to specific routes
export function applyRateLimiters(app: Express) {
  // Apply general rate limiting to all routes
  app.use(apiLimiter);
  
  // Apply more strict rate limiting to payment routes
  app.use('/api/payments/*', paymentLimiter);
  
  // Apply most strict rate limiting to auth routes
  app.use('/api/auth/*', authLimiter);
}
