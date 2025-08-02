'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.applyRateLimiters = void 0;
const express_rate_limit_1 = __importDefault(require('express-rate-limit'));
const rateLimitOptions = {
  _windowMs: 15 * 60 * 1000, // 15 minutes
  _max: 100, // limit each IP to 100 requests per windowMs
  _message: 'Too many requests from this IP, please try again later.',
  _standardHeaders: true,
  _legacyHeaders: false
};
exports.applyRateLimiters = {
  applyRateLimiters: (0, express_rate_limit_1.default)(rateLimitOptions)
};
