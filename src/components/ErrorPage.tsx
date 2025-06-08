// src/components/ErrorPage.tsx
import * as Sentry from '@sentry/react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

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
const ErrorPage: React.FC<ErrorPageProps> = ({
  statusCode = 500,
  title = 'Something went wrong',
  message = 'We encountered an unexpected error and our team has been notified.',
  error,
  showDetails = process.env.NODE_ENV !== 'production',
  showReportButton = true,
  showHomeButton = true,
  showRetryButton = true,
  onRetry,
}) => {
  const navigate = useNavigate();

  // Handle reporting error to Sentry with user feedback
  const handleReportError = () => {
    if (!error) return;

    Sentry.showReportDialog({
      eventId: Sentry.captureException(error),
      title: 'Report Feedback',
      subtitle: 'Your feedback helps us improve',
      subtitle2: 'Please tell us what happened',
      labelName: 'Name',
      labelEmail: 'Email',
      labelComments: 'What happened?',
      labelClose: 'Close',
      labelSubmit: 'Submit',
      successMessage: 'Thank you for your feedback!',
      errorFormEntry: 'Some fields were invalid. Please correct and try again.',
    });
  };

  // Navigate to home page
  const goToHome = () => {
    navigate('/');
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
    <div className="error-page">
      <div className="error-container">
        <div className="error-status">{statusCode}</div>
        <h1 className="error-title">{title}</h1>
        <p className="error-message">{message}</p>

        {showDetails && error && (
          <details className="error-details">
            <summary>Technical Details</summary>
            <div className="error-stack">
              <p className="error-name">
                {error.name}: {error.message}
              </p>
              <pre>{error.stack}</pre>
            </div>
          </details>
        )}

        <div className="error-actions">
          {showRetryButton && (
            <button className="error-retry-button" onClick={handleRetry}>
              Try Again
            </button>
          )}

          {showHomeButton && (
            <button className="error-home-button" onClick={goToHome}>
              Go to Home
            </button>
          )}

          {showReportButton && error && (
            <button className="error-report-button" onClick={handleReportError}>
              Report Issue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
