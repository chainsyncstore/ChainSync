import rateLimit from 'express-rate-limit';
// Request, Response, NextFunction removed
import { RateLimiter } from './types/index';

const rateLimitOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
};

export const applyRateLimiters: RateLimiter = {
    applyRateLimiters: rateLimit(rateLimitOptions)
};
