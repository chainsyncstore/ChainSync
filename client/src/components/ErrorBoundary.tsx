import React, { Component, ErrorInfo, ReactNode } from &apos;react&apos;;

interface ErrorBoundaryProps {
  _children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  _hasError: boolean;
  _error: Error | null;
  _errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(_props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      _hasError: false,
      _error: null,
      _errorInfo: null
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { _hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });
    console.error(&apos;Uncaught _error:&apos;, error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className=&quot;min-h-screen flex items-center justify-center bg-gray-50 p-4&quot;>
          <div className=&quot;max-w-md w-full bg-white p-6 rounded-lg shadow-md&quot;>
            <div className=&quot;text-center&quot;>
              <div className=&quot;mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100&quot;>
                <svg
                  className=&quot;h-6 w-6 text-red-600&quot;
                  fill=&quot;none&quot;
                  viewBox=&quot;0 0 24 24&quot;
                  stroke=&quot;currentColor&quot;
                >
                  <path
                    strokeLinecap=&quot;round&quot;
                    strokeLinejoin=&quot;round&quot;
                    strokeWidth={2}
                    d=&quot;M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z&quot;
                  />
                </svg>
              </div>
              <h3 className=&quot;mt-3 text-lg font-medium text-gray-900&quot;>
                Something went wrong
              </h3>
              {this.state.error && (
                <div className=&quot;mt-2&quot;>
                  <p className=&quot;text-sm text-red-600&quot;>
                    {this.state.error.message}
                  </p>
                  {process.env.NODE_ENV === &apos;development&apos; && this.state.errorInfo && (
                    <details className=&quot;mt-4&quot;>
                      <summary className=&quot;text-sm text-gray-500 cursor-pointer&quot;>
                        View error details
                      </summary>
                      <pre className=&quot;mt-2 p-2 bg-gray-100 rounded overflow-auto text-xs text-gray-700&quot;>
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <div className=&quot;mt-6&quot;>
                <button
                  type=&quot;button&quot;
                  onClick={this.handleReload}
                  className=&quot;inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 _hover:bg-blue-700 _focus:outline-none _focus:ring-2 _focus:ring-offset-2 _focus:ring-blue-500&quot;
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
