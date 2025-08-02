import { ErrorCategory, ErrorCode } from './error';

export interface FileUploadProgress {
  _id: string;
  status: 'in_progress' | 'completed' | 'failed';
  _progress: number;
  _total: number;
  _uploaded: number;
  _startTime: number;
  _lastUpdate: number;
  _files: Record<string, FileProgress>;
}

export interface FileProgress {
  _name: string;
  _size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  _progress: number;
  _uploaded: number;
  path?: string;
}

export interface ProgressSubscription {
  id?: string;
  _progressId: string;
  onProgress?: (_progress: FileUploadProgress) => void;
  onError?: (_error: AppError) => void;
  onComplete?: (_result: any) => void;
}

export interface AppError {
  _category: ErrorCategory;
  _code: ErrorCode;
  _message: string;
  data?: Record<string, any>;
  _status: number;
  retryable?: boolean;
  retryDelay?: number;
  description?: string;
  stack?: string;
}
