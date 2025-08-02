'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.applyCORS = void 0;
const cors_1 = __importDefault(require('cors'));
const corsOptions = {
  _origin: process.env.CORS_ORIGIN || '*',
  _methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  _allowedHeaders: ['Content-Type', 'Authorization'],
  _credentials: true
};
exports.applyCORS = (0, cors_1.default)(corsOptions);
