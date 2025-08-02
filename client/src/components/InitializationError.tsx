import React from &apos;react&apos;;

interface InitializationErrorProps {
  error?: Error;
  children?: React.ReactNode;
}

const _InitializationError: React.FC<InitializationErrorProps> = ({
  error,
  children
}) => {
  const handleReload = (): void => {
    window.location.reload();
  };

  return (
    <div className=&quot;min-h-screen flex items-center justify-center bg-gray-50 p-4&quot;>
      <div className=&quot;max-w-2xl w-full bg-white p-8 rounded-lg shadow-lg&quot;>
        <div className=&quot;text-center&quot;>
          <div className=&quot;mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100&quot;>
            <svg
              className=&quot;h-10 w-10 text-red-600&quot;
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
          <h1 className=&quot;mt-4 text-2xl font-bold text-gray-900&quot;>
            Application Initialization Failed
          </h1>
          <p className=&quot;mt-2 text-gray-600&quot;>
            We&apos;re sorry, but the application failed to initialize.
          </p>

          {children || (
            <>
              {error && (
                <div className=&quot;mt-6 p-4 bg-red-50 border-l-4 border-red-400 rounded&quot;>
                  <div className=&quot;flex&quot;>
                    <div className=&quot;flex-shrink-0&quot;>
                      <svg
                        className=&quot;h-5 w-5 text-red-400&quot;
                        fill=&quot;currentColor&quot;
                        viewBox=&quot;0 0 20 20&quot;
                      >
                        <path
                          fillRule=&quot;evenodd&quot;
                          d=&quot;M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z&quot;
                          clipRule=&quot;evenodd&quot;
                        />
                      </svg>
                    </div>
                    <div className=&quot;ml-3&quot;>
                      <p className=&quot;text-sm text-red-700&quot;>
                        {error.message || &apos;An unknown error occurred during initialization.&apos;}
                      </p>
                    </div>
                  </div>

                  {process.env.NODE_ENV === &apos;development&apos; && error.stack && (
                    <details className=&quot;mt-3&quot;>
                      <summary className=&quot;text-sm font-medium text-red-600 cursor-pointer&quot;>
                        View technical details
                      </summary>
                      <pre className=&quot;mt-2 p-2 bg-white rounded border border-gray-200 overflow-auto text-xs text-gray-700&quot;>
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className=&quot;mt-8&quot;>
                <button
                  type=&quot;button&quot;
                  onClick={handleReload}
                  className=&quot;inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 _hover:bg-blue-700 _focus:outline-none _focus:ring-2 _focus:ring-offset-2 _focus:ring-blue-500&quot;
                >
                  Reload Application
                </button>
                <div className=&quot;mt-3&quot;>
                  <p className=&quot;text-sm text-gray-500&quot;>
                    If the problem persists, please contact support.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitializationError;
