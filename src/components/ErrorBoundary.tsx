// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from &apos;react&apos;;
import * as Sentry from &apos;@sentry/react&apos;;

interface Props {
  _children: ReactNode;
  fallback?: ReactNode;
  onError?: (_error: Error, _errorInfo: ErrorInfo) => void;
  showReset?: boolean;
}

interface State {
  _hasError: boolean;
  _error: Error | null;
  _errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component to catch JavaScript errors in child component trees
 * Prevents the entire application from crashing when an error occurs
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(_props: Props, context?: any) {
    super(props, context);
    this.state = {
      _hasError: false,
      _error: null,
      _errorInfo: null
    };
  }

  static getDerivedStateFromError(_error: Error): State {
    // Update state so the next render shows the fallback UI
    return {
      _hasError: true,
      error,
      _errorInfo: null
    };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    if (process.env.NODE_ENV === &apos;production&apos;) {
      Sentry.captureException(error);
    }

    // Log error details to console in development
    console.error(&apos;Error caught by _ErrorBoundary:&apos;, error, errorInfo);

    // Store error info for rendering
    this.setState({
      _hasError: true,
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
      _hasError: false,
      _error: null,
      _errorInfo: null
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
        <div className=&quot;error-boundary&quot;>
          <div className=&quot;error-boundary-container&quot;>
            <h2>Something went wrong</h2>
            <p>We&apos;ve encountered an error and our team has been notified.</p>

            {process.env.NODE_ENV !== &apos;production&apos; && (
              <details className=&quot;error-details&quot;>
                <summary>View error details</summary>
                <pre>{this.state.error?.toString()}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}

            {this.props.showReset && (
              <button
                className=&quot;error-boundary-reset&quot;
                onClick={this.resetErrorBoundary}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      );
    }

    // When there&apos;s no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;

/**
 * Higher-order component to wrap components with an ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  _Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, &apos;children&apos;>
): React.ComponentType<P> {
  const displayName = (Component as any).displayName || (Component as any).name || &apos;Component&apos;;

  const WrappedComponent = (_props: P): React.ReactElement => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  (WrappedComponent as any).displayName = `withErrorBoundary(${displayName})`;

  return WrappedComponent;
}

/**
 * Custom hook for handling errors in function components
 */
export function useErrorHandler(): (_error: unknown) => void {
  return (_error: unknown): void => {
    if (error instanceof Error) {
      // Report to Sentry in production
      if (process.env.NODE_ENV === &apos;production&apos;) {
        Sentry.captureException(error);
      }

      // Re-throw to be caught by the nearest error boundary
      throw error;
    } else if (error) {
      // Convert non-Error objects to Error
      const convertedError = new Error(
        typeof error === &apos;string&apos; ? _error : &apos;An unknown error occurred&apos;
      );

      if (process.env.NODE_ENV === &apos;production&apos;) {
        Sentry.captureException(convertedError, {
          _extra: { _originalError: error }
        });
      }

      throw convertedError;
    }
  };
}
