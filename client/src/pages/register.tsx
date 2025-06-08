import React from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { RegisterForm } from '@/components/auth/register-form';
import { useAuth } from '@/providers/auth-provider';

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();

  // Redirect to dashboard if user is already logged in
  React.useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard');
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Form Section */}
      <div className="w-full md:w-1/2 p-8 flex flex-col justify-center">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm font-medium text-gray-500 hover:text-gray-800 flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
        </div>

        <RegisterForm />
      </div>

      {/* Hero Section */}
      <div className="w-full md:w-1/2 bg-primary-600 hidden md:flex flex-col justify-center p-8 bg-gradient-to-br from-primary to-primary-foreground">
        <div className="max-w-md mx-auto text-white">
          <h1 className="text-4xl font-bold mb-4">Join ChainSync Today</h1>
          <p className="text-primary-50 mb-8">
            ChainSync is the all-in-one retail management platform designed for supermarkets and
            multi-store chains, supporting both online and offline operations with real-time
            synchronization.
          </p>

          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Inventory Management</h3>
                <p className="text-primary-100 text-sm">
                  Track and manage your inventory across multiple stores with ease.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Point-of-Sale Operations</h3>
                <p className="text-primary-100 text-sm">
                  Efficient POS system that works both online and offline.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">AI-Powered Insights</h3>
                <p className="text-primary-100 text-sm">
                  Make data-driven decisions with our intelligent analytics system.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
