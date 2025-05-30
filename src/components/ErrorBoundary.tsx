// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showReset?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component to catch JavaScript errors in child component trees
 * Prevents the entire application from crashing when an error occurs
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
    
    // Log error details to console in development
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Store error info for rendering
    this.setState({
      error,
      errorInfo
    });
    
    // Call onError prop if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Otherwise, render our default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-container">
            <h2>Something went wrong</h2>
            <p>We've encountered an error and our team has been notified.</p>
            
            {process.env.NODE_ENV !== 'production' && (
              <details className="error-details">
                <summary>View error details</summary>
                <pre>{this.state.error?.toString()}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}
            
            {this.props.showReset && (
              <button
                className="error-boundary-reset"
                onClick={this.resetErrorBoundary}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      );
    }

    // When there's no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;

/**
 * Higher-order component to wrap components with an ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
): React.ComponentType<P> {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const WrappedComponent = (props: P): JSX.Element => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${displayName})`;
  
  return WrappedComponent;
}

/**
 * Custom hook for handling errors in function components
 */
export function useErrorHandler(): (error: unknown) => void {
  return (error: unknown): void => {
    if (error instanceof Error) {
      // Report to Sentry in production
      if (process.env.NODE_ENV === 'production') {
        Sentry.captureException(error);
      }
      
      // Re-throw to be caught by the nearest error boundary
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    } else if (error) {
      // Convert non-Error objects to Error
      const convertedError = new Error(
        typeof error === 'string' ? error : 'An unknown error occurred'
      );
      
      if (process.env.NODE_ENV === 'production') {
        Sentry.captureException(convertedError, {
          extra: { originalError: error }
        });
      }
      
      throw convertedError;
    }
  };
}
