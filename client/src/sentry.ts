import * as Sentry from '@sentry/react';

// Initialize Sentry for React client
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || undefined,
  environment: import.meta.env.VITE_NODE_ENV || import.meta.env.MODE || 'development',
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // Lower sample rate in production
  beforeSend(event) {
    // Filter out development-only errors
    if (import.meta.env.DEV && event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value?.includes('Non-Error promise rejection captured')) {
        return null; // Don't send development noise
      }
    }
    return event;
  },
});

// Export Sentry for use in error boundaries and manual error reporting
export { Sentry };
export const ErrorBoundary = Sentry.ErrorBoundary;
export const withErrorBoundary = Sentry.withErrorBoundary;
export const captureException = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;
