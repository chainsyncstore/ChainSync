import { NeonDatabase } from '@neondatabase/serverless';
import { Request, Response, NextFunction } from 'express';
import { File } from 'multer';
import { Pool } from 'pg';

// Environment Variables
interface EnvConfig {
  sessionSecret: string;
  sessionCookieName: string;
  databaseUrl: string;
  port: string;
  environment: 'development' | 'production' | 'test';
  // Add other environment variables as needed
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvConfig {}
  }
}

// Database Types
interface Database extends NeonDatabase {
  pool: Pool;
}

// User Types
interface User {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  storeId?: number;
}

// Express Session Types
declare module 'express-session' {
  interface SessionData {
    userId: string;
    userRole: 'admin' | 'manager' | 'cashier';
    storeId?: number;
    lastActivity: Date;
  }
}

// Customer Types
interface Customer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  storeId: number;
  createdAt: Date;
  updatedAt: Date;
}

// Loyalty Types
interface LoyaltyMember {
  id: number;
  customerId: number;
  loyaltyId: string;
  currentPoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  enrollmentDate: Date;
  lastActivity: Date;
  tier: LoyaltyTier;
}

interface LoyaltyTier {
  id: number;
  name: string;
  minPoints: number;
  benefits: string[];
}

// File Upload Types
interface FileUploadConfig {
  maxFileSize: number;
  maxTotalUploadSize: number;
  allowedMimeTypes: string[];
  maxFiles: number;
  destination: string;
  filename: (req: Request, file: File, cb: (error: Error | null, filename: string) => void) => void;
  allowedFileExtensions: string[];
  cleanupInterval: number;
  cacheTTL: number;
  maxUploadAttempts: number;
  uploadRateLimit: number;
}

// Middleware Types
interface AuthMiddleware {
  login: RequestHandler;
  register: RequestHandler;
  refreshToken: RequestHandler;
  protect: RequestHandler;
}

interface RateLimitMiddleware {
  protect: RequestHandler;
}

// Socket Types
interface SocketHandler {
  initialize: (io: Server) => void;
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
