import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '@server/db/schema'; // Assuming this is the correct path to your Drizzle schema

export type DatabaseConnection = NeonHttpDatabase<typeof schema>;

export interface ServiceConfig {
  db: DatabaseConnection;
  logger: {
    info: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
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

export type ServiceFunction<T> = (...args: unknown[]) => Promise<ServiceResult<T>>;
