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

export interface ProgressSubscription {
  id?: string;
  progressId: string;
  callback: (progress: FileUploadProgress) => void;
  lastUpdate: number;
}

export interface MemoryUsageStats {
  heapTotal: number;
  heapUsed: number;
  external: number;
  timestamp: number;
}

export interface FileValidationCache {
  extension: boolean;
  filename: boolean;
  timestamp: number;
}
