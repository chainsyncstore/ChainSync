import { ErrorCategory, ErrorCode } from './error';

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

export interface AppError {
  category: ErrorCategory;
  code: ErrorCode;
  message: string;
  data?: Record<string, any>;
  status: number;
  retryable?: boolean;
  retryDelay?: number;
  description?: string;
  stack?: string;
}
