import { Loader2, AlertCircle } from 'lucide-react';
import { Redirect, Link, useLocation } from 'wouter';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/providers/auth-provider';

export default function ResetPasswordPage() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // Get token from URL query parameters
  const params = new URLSearchParams(location.split('?')[1]);
  const token = params.get('token');

  // If user is already logged in, redirect to dashboard
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  // If no token is provided, show error
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col lg:flex-row">
        <div className="flex flex-1 flex-col justify-center px-5 py-12 lg:px-8 lg:py-24">
          <div className="mx-auto w-full max-w-md">
            <div className="flex flex-col items-center mb-8">
              <Link href="/" className="text-2xl font-bold text-primary">
                ChainSync
              </Link>
            </div>

            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Invalid Reset Link</AlertTitle>
              <AlertDescription>
                The password reset link is invalid or missing. Please request a new password reset
                link.
              </AlertDescription>
              <Link
                href="/forgot-password"
                className="block mt-4 text-center text-sm font-medium text-primary hover:underline"
              >
                Request New Reset Link
              </Link>
            </Alert>
          </div>
        </div>

        {/* Hero section (same as forgot-password page) */}
        <div className="hidden bg-gradient-to-br from-primary to-indigo-600 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-8 lg:py-24">
          <div className="mx-auto max-w-md text-white">
            <h2 className="text-3xl font-bold">ChainSync</h2>
            <p className="mt-4 text-lg">
              All-in-one retail management platform for supermarkets and multi-store chains.
            </p>
            <div className="mt-8">
              <ul className="space-y-3">
                <li className="flex items-center">
                  <div className="flex-shrink-0 rounded-full bg-white/20 p-1">
                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="ml-3">Complete inventory management</span>
                </li>
                <li className="flex items-center">
                  <div className="flex-shrink-0 rounded-full bg-white/20 p-1">
                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="ml-3">Point-of-sale operations</span>
                </li>
                <li className="flex items-center">
                  <div className="flex-shrink-0 rounded-full bg-white/20 p-1">
                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="ml-3">Real-time analytics</span>
                </li>
                <li className="flex items-center">
                  <div className="flex-shrink-0 rounded-full bg-white/20 p-1">
                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="ml-3">Customer loyalty management</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Form section */}
      <div className="flex flex-1 flex-col justify-center px-5 py-12 lg:px-8 lg:py-24">
        <div className="mx-auto w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <Link href="/" className="text-2xl font-bold text-primary">
              ChainSync
            </Link>
            <h2 className="mt-2 text-center text-sm text-muted-foreground">
              Create a new password for your account
            </h2>
          </div>

          <div className="bg-card p-6 shadow-sm rounded-xl border border-border">
            <ResetPasswordForm token={token} />
          </div>
        </div>
      </div>

      {/* Hero section (same as forgot-password page) */}
      <div className="hidden bg-gradient-to-br from-primary to-indigo-600 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-8 lg:py-24">
        <div className="mx-auto max-w-md text-white">
          <h2 className="text-3xl font-bold">ChainSync</h2>
          <p className="mt-4 text-lg">
            All-in-one retail management platform for supermarkets and multi-store chains.
          </p>
          <div className="mt-8">
            <ul className="space-y-3">
              <li className="flex items-center">
                <div className="flex-shrink-0 rounded-full bg-white/20 p-1">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="ml-3">Complete inventory management</span>
              </li>
              <li className="flex items-center">
                <div className="flex-shrink-0 rounded-full bg-white/20 p-1">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="ml-3">Point-of-sale operations</span>
              </li>
              <li className="flex items-center">
                <div className="flex-shrink-0 rounded-full bg-white/20 p-1">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="ml-3">Real-time analytics</span>
              </li>
              <li className="flex items-center">
                <div className="flex-shrink-0 rounded-full bg-white/20 p-1">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="ml-3">Customer loyalty management</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
