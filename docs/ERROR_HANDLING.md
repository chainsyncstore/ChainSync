# Error Handling Patterns

This document outlines the comprehensive error handling patterns implemented in the ChainSync application for React 19 compatibility and robust error management.

## Overview

The application implements a multi-layered error handling strategy that provides:
- Consistent error responses across the application
- Proper error categorization and logging
- Retry mechanisms for transient failures
- User-friendly error messages
- Comprehensive error monitoring

## Error Categories

### 1. Validation Errors (`VALIDATION`)
- Input validation failures
- Schema validation errors
- Required field missing
- Invalid data format

### 2. Authentication Errors (`AUTHENTICATION`)
- Invalid credentials
- Expired tokens
- Missing authentication
- Permission denied

### 3. Resource Errors (`RESOURCE`)
- Resource not found
- Resource already exists
- Resource locked
- Insufficient permissions

### 4. Database Errors (`DATABASE`)
- Connection failures
- Query failures
- Constraint violations
- Transaction failures

### 5. Business Logic Errors (`BUSINESS`)
- Invalid business operations
- Business rule violations
- Workflow errors
- State conflicts

### 6. System Errors (`SYSTEM`)
- Internal server errors
- Service unavailable
- Configuration errors
- Infrastructure issues

### 7. Import/Export Errors (`IMPORT_EXPORT`)
- File format errors
- Processing failures
- Validation errors
- Export failures

## Error Handling Components

### 1. AppError Class

The `AppError` class is the foundation of error handling:

```typescript
class AppError extends Error {
  code: ErrorCode;
  category: ErrorCategory;
  details?: Record<string, unknown>;
  statusCode?: number;
  retryable?: boolean;
  retryAfter?: number;
  validationErrors?: any[];
}
```

**Usage:**
```typescript
throw new AppError(
  'User not found',
  ErrorCategory.RESOURCE,
  ErrorCode.USER_NOT_FOUND,
  { userId: 123 },
  404
);
```

### 2. Error Handler Middleware

The enhanced error handler middleware provides:

- **Request Context**: Captures request details for debugging
- **Error Monitoring**: Integrates with monitoring services
- **Retry Logic**: Handles retryable errors with backoff
- **User-Friendly Messages**: Formats errors for end users

**Features:**
- Automatic error categorization
- Request ID tracking
- Development vs production error details
- Retry information for transient failures

### 3. Service Error Handling

Services use standardized error handling patterns:

```typescript
export class ServiceErrorHandler {
  static handleError(error: any, operation: string, defaultErrorCode: ErrorCode): never {
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      `Error ${operation}: ${error.message}`,
      'INTERNAL_SERVER_ERROR',
      defaultErrorCode
    );
  }
  
  static ensureExists<T>(result: T | null, entityName: string): T {
    if (!result) {
      throw new AppError(
        `${entityName} not found`,
        'NOT_FOUND',
        ErrorCode.NOT_FOUND
      );
    }
    return result;
  }
}
```

## React 19 Compatibility

### 1. Error Boundaries

React 19 error boundaries are implemented for component-level error handling:

```typescript
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, 'React Error Boundary', {
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### 2. Hook Error Handling

Custom hooks include error handling:

```typescript
export function useApiCall<T>(apiCall: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
    } catch (err) {
      const appError = err instanceof AppError ? err : 
        new AppError('API call failed', 'SYSTEM', ErrorCode.INTERNAL_SERVER_ERROR);
      setError(appError);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  return { data, error, loading, execute };
}
```

## Testing Error Handling

### 1. Test Utilities

Comprehensive test utilities for error scenarios:

```typescript
// Mock error responses
export const createApiErrorMock = (error: any, delay = 0) => {
  return vi.fn().mockImplementation(() => 
    new Promise((_, reject) => {
      setTimeout(() => reject(error), delay);
    })
  );
};

// Test error boundaries
export const triggerError = (component: ReactElement) => {
  const error = new Error('Test error');
  const errorInfo = { componentStack: 'Test stack' };
  
  // Simulate error boundary trigger
  const errorBoundary = render(<ErrorBoundary>{component}</ErrorBoundary>);
  // Trigger error and verify error page renders
};
```

### 2. Error Scenario Testing

Test files include comprehensive error scenarios:

```typescript
describe('Error Handling', () => {
  test('handles network errors gracefully', async () => {
    const mockApi = createApiErrorMock(new Error('Network error'));
    
    render(<Component apiCall={mockApi} />);
    
    await waitFor(() => {
      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });
  });

  test('retries transient errors', async () => {
    const mockApi = createApiErrorMock(
      new AppError('Temporary error', 'SYSTEM', ErrorCode.TEMPORARY_UNAVAILABLE, {}, 503, true)
    );
    
    // Verify retry logic
  });
});
```

## Error Monitoring

### 1. Error Context

Every error includes rich context for debugging:

```typescript
interface ErrorContext {
  requestId?: string;
  userId?: string;
  storeId?: string;
  operation?: string;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  method?: string;
  path?: string;
  query?: any;
  body?: any;
}
```

### 2. Monitoring Integration

Error monitoring can be integrated with services like Sentry:

```typescript
class SentryErrorMonitor implements ErrorMonitor {
  captureError(error: AppError, context: ErrorContext): void {
    Sentry.captureException(error, {
      tags: {
        category: error.category,
        code: error.code,
        requestId: context.requestId
      },
      extra: {
        context,
        details: error.details
      }
    });
  }
}
```

## Best Practices

### 1. Error Creation

- Always use `AppError` for application errors
- Provide meaningful error messages
- Include relevant context in error details
- Set appropriate HTTP status codes

### 2. Error Handling

- Handle errors at the appropriate level
- Don't swallow errors without logging
- Provide user-friendly error messages
- Implement retry logic for transient failures

### 3. Error Logging

- Log errors with sufficient context
- Use structured logging
- Include request IDs for tracing
- Separate sensitive information

### 4. Error Testing

- Test error scenarios thoroughly
- Mock external service failures
- Verify error boundaries work correctly
- Test retry mechanisms

## Error Codes Reference

### Client Errors (4xx)
- `BAD_REQUEST`: Invalid request
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Access denied
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Input validation failed
- `CONFLICT`: Resource conflict
- `TOO_MANY_REQUESTS`: Rate limit exceeded

### Server Errors (5xx)
- `INTERNAL_SERVER_ERROR`: Unexpected server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable
- `DATABASE_ERROR`: Database operation failed
- `PROCESSING_ERROR`: Data processing failed

### Business Errors
- `INSUFFICIENT_STOCK`: Not enough inventory
- `INSUFFICIENT_BALANCE`: Insufficient funds
- `INVALID_OPERATION`: Business rule violation
- `RESOURCE_LOCKED`: Resource temporarily unavailable

## Migration Guide

### From Legacy Error Handling

1. Replace generic `Error` with `AppError`
2. Add appropriate error categories
3. Include error codes
4. Add error context where possible
5. Update error handling middleware
6. Test error scenarios

### React 19 Specific Changes

1. Update error boundaries for React 19
2. Use new error handling hooks
3. Update test utilities for React 19
4. Verify error monitoring compatibility

## Troubleshooting

### Common Issues

1. **Error not being caught**: Ensure error boundaries are properly configured
2. **Missing error context**: Check that error handlers include context
3. **Inconsistent error responses**: Verify error handler middleware is applied
4. **Test failures**: Update test utilities for React 19 compatibility

### Debugging

1. Check error logs for detailed context
2. Use request IDs to trace error flows
3. Verify error monitoring integration
4. Test error scenarios in development

## Conclusion

This comprehensive error handling system provides:
- Robust error management across the application
- React 19 compatibility
- Consistent error responses
- Comprehensive testing support
- Production-ready error monitoring

The system is designed to be maintainable, testable, and user-friendly while providing detailed debugging information for developers. 