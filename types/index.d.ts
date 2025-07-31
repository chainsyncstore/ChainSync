import { RequestHandler, ErrorRequestHandler } from 'express';
import { Pool } from 'pg';
import type { File as MulterFile } from 'multer';

// Express types
export interface CustomRequest extends Request {
  file?: MulterFile;
  files?: {
    [fieldname: string]: MulterFile[] | MulterFile;
  };
  user?: {
    id: string;
    email: string;
    role: string;
    [key: string]: any;
  };
}

// Middleware types
export interface IMiddleware {
  [key: string]: RequestHandler | ErrorRequestHandler | ((...args: any[]) => RequestHandler);
}

export interface AuthMiddleware extends IMiddleware {
  isAuthenticated: RequestHandler;
  isAdmin: RequestHandler;
  isManagerOrAdmin: RequestHandler;
  hasStoreAccess: (storeIdParam?: string) => RequestHandler;
}

export interface ErrorHandler extends IMiddleware {
  errorHandler: ErrorRequestHandler;
}

export interface RateLimiter extends IMiddleware {
  applyRateLimiters: RequestHandler;
}

export interface FileUploadMiddleware extends IMiddleware {
  handleUpload: RequestHandler;
  getProgress: RequestHandler;
  subscribeToProgress: RequestHandler;
}

// Database types
export interface NeonDatabase {
  pool: Pool;
  query: (text: string, params?: any[]) => Promise<any>;
  begin: () => Promise<any>;
  commit: () => Promise<any>;
  rollback: () => Promise<any>;
  end: () => Promise<void>;
}

// Environment types
export interface EnvConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  sessionCookieName: string;
  corsOrigin: string;
}

// File upload types
export interface FileUploadProgress {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  total: number;
  uploaded: number;
  startTime: number;
  lastUpdate: number;
  files: Record<string, {
    name: string;
    size: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    uploaded: number;
    error?: string;
    path?: string;
  }>;
}

// Loyalty types
export interface LoyaltyMember {
  id: number;
  fullName: string;
  email: string;
  loyaltyMembers?: number;
}

export interface LoyaltyProgram {
  members: LoyaltyMember[];
  totalMembers: number;
  activeMembers: number;
}
