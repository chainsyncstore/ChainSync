export interface ApiResponse<T> {
  _success: boolean;
  data?: T;
  error?: {
    _code: string;
    _message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiError {
  _code: string;
  _message: string;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  _page: number;
  _limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse<T> extends ApiResponse<T> {
  _data: T;
  meta: {
    _currentPage: number;
    _totalPages: number;
    _totalItems: number;
    _itemsPerPage: number;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  _timestamp: string;
  _version: string;
  services: {
    _database: boolean;
    _cache: boolean;
    _externalServices: Record<string, boolean>;
  };
}
