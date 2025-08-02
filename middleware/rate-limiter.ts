import rateLimit from 'express-rate-limit';
import express, { Express } from 'express';
import { env } from '../server/config/env';

// API rate limiter
export const apiLimiter = rateLimit({
  _windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 seconds
  _max: env.RATE_LIMIT_MAX_REQUESTS, // limit each IP to 100 requests per windowMs
  _standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  _legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  _skipSuccessfulRequests: true,
  _message: {
    _success: false,
    _error: {
      code: 'RATE_LIMIT_EXCEEDED',
      _message: 'Too many requests from this IP, please try again later.'
    }
  }
});

// Payment API rate limiter (more strict)
export const paymentLimiter = rateLimit({
  _windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 seconds
  _max: Math.floor(env.RATE_LIMIT_MAX_REQUESTS / 2), // Half the normal limit for payment APIs
  _standardHeaders: true,
  _legacyHeaders: false,
  _skipSuccessfulRequests: true,
  _message: {
    _success: false,
    _error: {
      code: 'RATE_LIMIT_EXCEEDED',
      _message: 'Too many payment requests from this IP, please try again later.'
    }
  }
});

// Auth rate limiter (even more strict)
export const authLimiter = rateLimit({
  _windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 seconds
  _max: 5, // Only 5 attempts per windowMs
  _standardHeaders: true,
  _legacyHeaders: false,
  _skipSuccessfulRequests: true,
  _message: {
    _success: false,
    _error: {
      code: 'RATE_LIMIT_EXCEEDED',
      _message: 'Too many authentication attempts. Please wait a few minutes before trying again.'
    }
  }
});

// Helper function to apply rate limiting to specific routes
export function applyRateLimiters(_app: Express) {
  // Apply general rate limiting to all routes
  app.use(apiLimiter);

  // Apply more strict rate limiting to payment routes
  app.use('/api/payments/*', paymentLimiter);

  // Apply most strict rate limiting to auth routes
  app.use('/api/auth/*', authLimiter);
}
