import React from 'react';

interface InitializationErrorProps {
  error?: Error;
  children?: React.ReactNode;
}

const InitializationError: React.FC<InitializationErrorProps> = ({ 
  error, 
  children 
}) => {
  const handleReload = (): void => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-2xl w-full bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg
              className="h-10 w-10 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Application Initialization Failed
          </h1>
          <p className="mt-2 text-gray-600">
            We're sorry, but the application failed to initialize.
          </p>
          
          {children || (
            <>
              {error && (
                <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">
                        {error.message || 'An unknown error occurred during initialization.'}
                      </p>
                    </div>
                  </div>
                  
                  {process.env.NODE_ENV === 'development' && error.stack && (
                    <details className="mt-3">
                      <summary className="text-sm font-medium text-red-600 cursor-pointer">
                        View technical details
                      </summary>
                      <pre className="mt-2 p-2 bg-white rounded border border-gray-200 overflow-auto text-xs text-gray-700">
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              
              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleReload}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Reload Application
                </button>
                <div className="mt-3">
                  <p className="text-sm text-gray-500">
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
