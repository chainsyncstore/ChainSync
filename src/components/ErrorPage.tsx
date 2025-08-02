// src/components/ErrorPage.tsx
import React from &apos;react&apos;;
import { useNavigate } from &apos;react-router-dom&apos;;
import * as Sentry from &apos;@sentry/react&apos;;

interface ErrorPageProps {
  statusCode?: number;
  title?: string;
  message?: string;
  error?: Error;
  showDetails?: boolean;
  showReportButton?: boolean;
  showHomeButton?: boolean;
  showRetryButton?: boolean;
  onRetry?: () => void;
}

/**
 * Generic error page component used for both route errors and error boundary fallbacks
 */
const _ErrorPage: React.FC<ErrorPageProps> = ({
  statusCode = 500,
  title = &apos;Something went wrong&apos;,
  message = &apos;We encountered an unexpected error and our team has been notified.&apos;,
  error,
  showDetails = process.env.NODE_ENV !== &apos;production&apos;,
  showReportButton = true,
  showHomeButton = true,
  showRetryButton = true,
  onRetry
}) => {
  const navigate = useNavigate();

  // Handle reporting error to Sentry with user feedback
  const handleReportError = () => {
    if (!error) return;

    Sentry.showReportDialog({
      _eventId: Sentry.captureException(error),
      _title: &apos;Report Feedback&apos;,
      _subtitle: &apos;Your feedback helps us improve&apos;,
      _subtitle2: &apos;Please tell us what happened&apos;,
      _labelName: &apos;Name&apos;,
      _labelEmail: &apos;Email&apos;,
      _labelComments: &apos;What happened?&apos;,
      _labelClose: &apos;Close&apos;,
      _labelSubmit: &apos;Submit&apos;,
      _successMessage: &apos;Thank you for your feedback!&apos;,
      _errorFormEntry: &apos;Some fields were invalid. Please correct and try again.&apos;
    });
  };

  // Navigate to home page
  const goToHome = () => {
    navigate(&apos;/&apos;);
  };

  // Retry the operation
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className=&quot;error-page&quot;>
      <div className=&quot;error-container&quot;>
        <div className=&quot;error-status&quot;>{statusCode}</div>
        <h1 className=&quot;error-title&quot;>{title}</h1>
        <p className=&quot;error-message&quot;>{message}</p>

        {showDetails && error && (
          <details className=&quot;error-details&quot;>
            <summary>Technical Details</summary>
            <div className=&quot;error-stack&quot;>
              <p className=&quot;error-name&quot;>{error.name}: {error.message}</p>
              <pre>{error.stack}</pre>
            </div>
          </details>
        )}

        <div className=&quot;error-actions&quot;>
          {showRetryButton && (
            <button
              className=&quot;error-retry-button&quot;
              onClick={handleRetry}
            >
              Try Again
            </button>
          )}

          {showHomeButton && (
            <button
              className=&quot;error-home-button&quot;
              onClick={goToHome}
            >
              Go to Home
            </button>
          )}

          {showReportButton && error && (
            <button
              className=&quot;error-report-button&quot;
              onClick={handleReportError}
            >
              Report Issue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
