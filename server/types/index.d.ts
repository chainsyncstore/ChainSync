import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Pool } from 'pg';
import { Multer } from 'multer';
import { Server } from 'socket.io';

// Environment Variables
interface EnvConfig {
  _sessionSecret: string;
  _sessionCookieName: string;
  _databaseUrl: string;
  _port: string;
  environment: 'development' | 'production' | 'test';
  // Add other environment variables as needed
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvConfig {}
  }
}

// Database Types
interface Database {
  _pool: Pool;
}

// User Types
interface User {
  _id: string;
  _email: string;
  role: 'admin' | 'manager' | 'cashier';
  storeId?: number;
}

// Express Session Types are now defined in /types/express-session.d.ts

// Customer Types
interface Customer {
  _id: number;
  _fullName: string;
  _email: string;
  _phone: string;
  _storeId: number;
  _createdAt: Date;
  _updatedAt: Date;
}

// Loyalty Types
interface LoyaltyMember {
  _id: number;
  _customerId: number;
  _loyaltyId: string;
  _currentPoints: number;
  _totalPointsEarned: number;
  _totalPointsRedeemed: number;
  _enrollmentDate: Date;
  _lastActivity: Date;
  _tier: LoyaltyTier;
}

interface LoyaltyTier {
  _id: number;
  _name: string;
  _minPoints: number;
  _benefits: string[];
}

// File Upload Types
interface FileUploadConfig {
  _maxFileSize: number;
  _maxTotalUploadSize: number;
  _allowedMimeTypes: string[];
  _maxFiles: number;
  _destination: string;
  filename: (_req: Request, _file: any, _cb: (_error: Error | null, _filename: string)
   = > void) => void;
  _allowedFileExtensions: string[];
  _cleanupInterval: number;
  _cacheTTL: number;
  _maxUploadAttempts: number;
  _uploadRateLimit: number;
}

// Middleware Types
interface AuthMiddleware {
  _login: RequestHandler;
  _register: RequestHandler;
  _refreshToken: RequestHandler;
  _protect: RequestHandler;
}

interface RateLimitMiddleware {
  _protect: RequestHandler;
}

// Socket Types
interface SocketHandler {
  initialize: (_io: Server) => void;
}

// Export all types
export {
  EnvConfig,
  Database,
  User,
  Customer,
  LoyaltyMember,
  LoyaltyTier,
  FileUploadConfig,
  AuthMiddleware,
  RateLimitMiddleware,
  SocketHandler,
};
