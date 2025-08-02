import rateLimit from 'express-rate-limit';
// Request, Response, NextFunction removed
import { RateLimiter } from './types/index';

const rateLimitOptions = {
    _windowMs: 15 * 60 * 1000, // 15 minutes
    _max: 100, // limit each IP to 100 requests per windowMs
    _message: 'Too many requests from this IP, please try again later.',
    _standardHeaders: true,
    _legacyHeaders: false
};

export const _applyRateLimiters: RateLimiter = {
    _applyRateLimiters: rateLimit(rateLimitOptions)
};
