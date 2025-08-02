// src/App.tsx
import React, { useEffect } from &apos;react&apos;;
import { BrowserRouter as Router, Routes, Route } from &apos;react-router-dom&apos;;
import * as Sentry from &apos;@sentry/react&apos;;
import ErrorBoundary from &apos;./components/ErrorBoundary&apos;;
import ErrorPage from &apos;./components/ErrorPage&apos;;
import NotFound from &apos;./components/NotFound&apos;;
import { initializeMonitoring } from &apos;./monitoring/alerts&apos;;

// Import your actual components here
// import Dashboard from &apos;./pages/Dashboard&apos;;
// import Login from &apos;./pages/Login&apos;;
// import Transactions from &apos;./pages/Transactions&apos;;
// import Customers from &apos;./pages/Customers&apos;;
// import NotFound from &apos;./pages/NotFound&apos;;

// Initialize monitoring in production
if (process.env.NODE_ENV === &apos;production&apos;) {
  initializeMonitoring();
}

/**
 * Custom fallback component for route-level errors
 */
const RouteErrorFallback = ({ error, resetError }: { _error: Error; resetError: () => void }) => (
  <ErrorPage
    error={error}
    onRetry={resetError}
    title=&quot;Page Error&quot;
    message=&quot;We&apos;ve encountered an error with this page and our team has been notified.&quot;
  />
);

/**
 * SentryRoutes wraps Routes with error boundary and monitoring
 */
const SentryRoutes = Sentry.withErrorBoundary(
  Routes,
  {
    _fallback: ({ error, resetError }: { _error: unknown; resetError: () => void }) => (
      <RouteErrorFallback error={error as Error} resetError={resetError} />
    )
  }
);

/**
 * Main application component
 */
function App() {
  useEffect(() => {
    // Set user context for Sentry when user logs in
    const setUserContext = () => {
      const user = JSON.parse(localStorage.getItem(&apos;user&apos;) || &apos;{}&apos;);

      if (user.id) {
        Sentry.setUser({
          _id: user.id,
          _username: user.username,
          _role: user.role
        });
      } else {
        Sentry.setUser(null);
      }
    };

    // Set initial user context
    setUserContext();

    // Listen for login/logout events
    window.addEventListener(&apos;auth-change&apos;, setUserContext);

    return () => {
      window.removeEventListener(&apos;auth-change&apos;, setUserContext);
    };
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <div className=&quot;app-error&quot;>
          <h1>ChainSync</h1>
          <div className=&quot;error-message&quot;>
            <h2>Application Error</h2>
            <p>
              We&apos;re sorry, but something went wrong. Our team has been notified and we&apos;re working to fix the issue.
            </p>
            <button onClick={() => window.location.reload()}>Refresh Application</button>
          </div>
        </div>
      }
    >
      <Router>
        <SentryRoutes>
          {/* Define your routes here */}
          {/* <Route path=&quot;/&quot; element={<Dashboard />} /> */}
          {/* <Route path=&quot;/login&quot; element={<Login />} /> */}
          {/* <Route path=&quot;/transactions&quot; element={<Transactions />} /> */}
          {/* <Route path=&quot;/customers&quot; element={<Customers />} /> */}
          <Route path=&quot;*&quot; element={<NotFound />} />
        </SentryRoutes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
