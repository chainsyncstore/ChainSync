import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '@server/db/schema'; // Assuming this is the correct path to your Drizzle schema

export type DatabaseConnection = NeonHttpDatabase<typeof schema>;

export interface ServiceConfig {
  db: DatabaseConnection;
  logger: {
    info: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  };
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ServiceFunction<T> = (...args: any[]) => Promise<ServiceResult<T>>;
