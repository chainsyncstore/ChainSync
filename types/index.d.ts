import { RequestHandler, ErrorRequestHandler } from 'express';
import { Pool } from 'pg';
import type { File as MulterFile } from 'multer';

// Express types
export interface CustomRequest extends Request {
  file?: MulterFile;
  files?: {
    [_fieldname: string]: MulterFile[] | MulterFile;
  };
  user?: {
    _id: string;
    _email: string;
    _role: string;
    [_key: string]: any;
  };
}

// Middleware types
export interface IMiddleware {
  [_key: string]: RequestHandler | ErrorRequestHandler | ((..._args: any[]) => RequestHandler);
}

export interface AuthMiddleware extends IMiddleware {
  _isAuthenticated: RequestHandler;
  _isAdmin: RequestHandler;
  _isManagerOrAdmin: RequestHandler;
  hasStoreAccess: (storeIdParam?: string) => RequestHandler;
}

export interface ErrorHandler extends IMiddleware {
  _errorHandler: ErrorRequestHandler;
}

export interface RateLimiter extends IMiddleware {
  _applyRateLimiters: RequestHandler;
}

export interface FileUploadMiddleware extends IMiddleware {
  _handleUpload: RequestHandler;
  _getProgress: RequestHandler;
  _subscribeToProgress: RequestHandler;
}

// Database types
export interface NeonDatabase {
  _pool: Pool;
  query: (_text: string, params?: any[]) => Promise<any>;
  _begin: () => Promise<any>;
  _commit: () => Promise<any>;
  _rollback: () => Promise<any>;
  _end: () => Promise<void>;
}

// Environment types
export interface EnvConfig {
  _nodeEnv: 'development' | 'production' | 'test';
  _port: number;
  _databaseUrl: string;
  _sessionSecret: string;
  _sessionCookieName: string;
  _corsOrigin: string;
}

// File upload types
export interface FileUploadProgress {
  _id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  _progress: number;
  _total: number;
  _uploaded: number;
  _startTime: number;
  _lastUpdate: number;
  _files: Record<string, {
    _name: string;
    _size: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    _progress: number;
    _uploaded: number;
    error?: string;
    path?: string;
  }>;
}

// Loyalty types
export interface LoyaltyMember {
  _id: number;
  _fullName: string;
  _email: string;
  loyaltyMembers?: number;
}

export interface LoyaltyProgram {
  _members: LoyaltyMember[];
  _totalMembers: number;
  _activeMembers: number;
}
