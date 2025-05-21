import { createRoot } from 'react-dom/client';
import { StrictMode, Suspense } from 'react';
import App from './App';
import './index.css';
import { initializeApp } from './utils/initializeApp';
import ErrorBoundary from './components/ErrorBoundary';
import InitializationError from './components/InitializationError';

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-gray-600 text-xl">Loading application...</div>
  </div>
);

// Initialize the application
const initApp = async () => {
  // Show loading state immediately
  const root = createRoot(document.getElementById('root')!);
  root.render(
    <StrictMode>
      <LoadingFallback />
    </StrictMode>
  );

  try {
    // Initialize the application
    const result = await initializeApp();

    if (!result.success) {
      throw result.error || new Error('Failed to initialize application');
    }

    // Render the app inside error boundary
    root.render(
      <StrictMode>
        <ErrorBoundary 
          fallback={
            <div className="p-4">
              <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
              <p>Please refresh the page or try again later.</p>
            </div>
          }
        >
          <Suspense fallback={<LoadingFallback />}>
            <App />
          </Suspense>
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (error) {
    console.error('Fatal error during app initialization:', error);
    
    // Show error UI
    root.render(
      <StrictMode>
        <InitializationError 
          error={error instanceof Error ? error : new Error(String(error))} 
        />
      </StrictMode>
    );
  }
};

// Start the application
initApp().catch(error => {
  console.error('Fatal error in initialization:', error);
  
  // Final fallback in case something goes wrong during initialization
  const root = createRoot(document.getElementById('root')!);
  root.render(
    <div className="m-4 p-8 text-center text-red-800 bg-red-100 border border-red-300 rounded">
      <h1 className="text-2xl font-bold mb-2">Critical Error</h1>
      <p className="mb-4">The application failed to start. Please try refreshing the page.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Refresh Page
      </button>
    </div>
  );
});
