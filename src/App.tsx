// src/App.tsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorPage from './components/ErrorPage';
import NotFound from './components/NotFound';
import { initializeMonitoring } from './monitoring/alerts';

// Import your actual components here
// import Dashboard from './pages/Dashboard';
// import Login from './pages/Login';
// import Transactions from './pages/Transactions';
// import Customers from './pages/Customers';
// import NotFound from './pages/NotFound';

// Initialize monitoring in production
if (process.env.NODE_ENV === 'production') {
  initializeMonitoring();
}

/**
 * Custom fallback component for route-level errors
 */
const RouteErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <ErrorPage 
    error={error} 
    onRetry={resetError} 
    title="Page Error" 
    message="We've encountered an error with this page and our team has been notified."
  />
);

/**
 * SentryRoutes wraps Routes with error boundary and monitoring
 */
const SentryRoutes = Sentry.withErrorBoundary(
  Routes,
  {
    fallback: ({ error, resetError }) => (
      <RouteErrorFallback error={error as Error} resetError={resetError} />
    ),
  }
);

/**
 * Main application component
 */
function App() {
  useEffect(() => {
    // Set user context for Sentry when user logs in
    const setUserContext = () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (user.id) {
        Sentry.setUser({
          id: user.id,
          username: user.username,
          role: user.role
        });
      } else {
        Sentry.setUser(null);
      }
    };
    
    // Set initial user context
    setUserContext();
    
    // Listen for login/logout events
    window.addEventListener('auth-change', setUserContext);
    
    return () => {
      window.removeEventListener('auth-change', setUserContext);
    };
  }, []);
  
  return (
    <ErrorBoundary
      fallback={
        <div className="app-error">
          <h1>ChainSync</h1>
          <div className="error-message">
            <h2>Application Error</h2>
            <p>
              We're sorry, but something went wrong. Our team has been notified and we're working to fix the issue.
            </p>
            <button onClick={() => window.location.reload()}>Refresh Application</button>
          </div>
        </div>
      }
    >
      <Router>
        <SentryRoutes>
          {/* Define your routes here */}
          {/* <Route path="/" element={<Dashboard />} /> */}
          {/* <Route path="/login" element={<Login />} /> */}
          {/* <Route path="/transactions" element={<Transactions />} /> */}
          {/* <Route path="/customers" element={<Customers />} /> */}
          <Route path="*" element={<NotFound />} />
        </SentryRoutes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
