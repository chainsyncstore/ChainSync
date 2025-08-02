'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.applyRateLimiters = void 0;
const express_rate_limit_1 = __importDefault(require('express-rate-limit'));
const rateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
};
exports.applyRateLimiters = {
  applyRateLimiters: (0, express_rate_limit_1.default)(rateLimitOptions)
};
