import type { NeonDatabase } from 'drizzle-orm/neon-serverless'; // Changed from neon-http to neon-serverless
import * as schema from '@shared/schema'; // Changed to use @shared/schema for consistency

import { Logger } from '../../src/logging'; // Import the main Logger type

export type DatabaseConnection = NeonDatabase<typeof schema>;

export interface ServiceConfig {
  db: DatabaseConnection;
  logger: Logger; // Use the imported Logger type
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
