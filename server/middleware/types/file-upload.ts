import { AppError, ErrorCategory, ErrorCode } from './app-error'; // Updated import

export interface FileUploadProgress {
  id: string;
  status: 'in_progress' | 'completed' | 'failed';
  progress: number;
  total: number;
  uploaded: number;
  startTime: number;
  lastUpdate: number;
  files: Record<string, FileProgress>;
}

export interface FileProgress {
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  uploaded: number;
  path?: string;
}

export interface ProgressSubscription {
  progressId: string;
  onProgress?: (progress: FileUploadProgress) => void;
  onError?: (error: AppError) => void;
  onComplete?: (result: unknown) => void;
}

// Removed local AppError interface, will use the imported one from ./app-error.ts
// export interface AppError {
//   category: ErrorCategory;
//   code: ErrorCode;
//   message: string;
//   data?: Record<string, any>;
//   status: number;
//   retryable?: boolean;
//   retryDelay?: number;
//   description?: string;
//   stack?: string;
// }
