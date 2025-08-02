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

export interface ProgressSubscription {
  id?: string;
  _progressId: string;
  callback: (_progress: FileUploadProgress) => void;
  _lastUpdate: number;
}

export interface MemoryUsageStats {
  _heapTotal: number;
  _heapUsed: number;
  _external: number;
  _timestamp: number;
}

export interface FileValidationCache {
  _extension: boolean;
  _filename: boolean;
  _timestamp: number;
}
