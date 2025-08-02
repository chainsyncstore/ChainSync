import React from &apos;react&apos;;
import { Link, useLocation } from &apos;wouter&apos;;
import { ArrowLeft } from &apos;lucide-react&apos;;
import { RegisterForm } from &apos;@/components/auth/register-form&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();

  // Redirect to dashboard if user is already logged in
  React.useEffect(() => {
    if (!isLoading && user) {
      navigate(&apos;/dashboard&apos;);
    }
  }, [user, isLoading, navigate]);

  return (
    <div className=&quot;min-h-screen flex flex-col _md:flex-row&quot;>
      {/* Form Section */}
      <div className=&quot;w-full _md:w-1/2 p-8 flex flex-col justify-center&quot;>
        <div className=&quot;mb-6&quot;>
          <Link href=&quot;/&quot; className=&quot;text-sm font-medium text-gray-500 _hover:text-gray-800 flex items-center&quot;>
            <ArrowLeft className=&quot;h-4 w-4 mr-1&quot; />
            Back to Home
          </Link>
        </div>

        <RegisterForm />
      </div>

      {/* Hero Section */}
      <div className=&quot;w-full _md:w-1/2 bg-primary-600 hidden _md:flex flex-col justify-center p-8 bg-gradient-to-br from-primary to-primary-foreground&quot;>
        <div className=&quot;max-w-md mx-auto text-white&quot;>
          <h1 className=&quot;text-4xl font-bold mb-4&quot;>
            Join ChainSync Today
          </h1>
          <p className=&quot;text-primary-50 mb-8&quot;>
            ChainSync is the all-in-one retail management platform designed for supermarkets and multi-store chains,
            supporting both online and offline operations with real-time synchronization.
          </p>

          <div className=&quot;space-y-4&quot;>
            <div className=&quot;flex items-start&quot;>
              <div className=&quot;bg-white/20 p-2 rounded-full mr-4&quot;>
                <svg
                  xmlns=&quot;http://www.w3.org/2000/svg&quot;
                  className=&quot;h-5 w-5&quot;
                  fill=&quot;none&quot;
                  viewBox=&quot;0 0 24 24&quot;
                  stroke=&quot;currentColor&quot;
                >
                  <path
                    strokeLinecap=&quot;round&quot;
                    strokeLinejoin=&quot;round&quot;
                    strokeWidth={2}
                    d=&quot;M5 13l4 4L19 7&quot;
                  />
                </svg>
              </div>
              <div>
                <h3 className=&quot;font-medium&quot;>Inventory Management</h3>
                <p className=&quot;text-primary-100 text-sm&quot;>Track and manage your inventory across multiple stores with ease.</p>
              </div>
            </div>

            <div className=&quot;flex items-start&quot;>
              <div className=&quot;bg-white/20 p-2 rounded-full mr-4&quot;>
                <svg
                  xmlns=&quot;http://www.w3.org/2000/svg&quot;
                  className=&quot;h-5 w-5&quot;
                  fill=&quot;none&quot;
                  viewBox=&quot;0 0 24 24&quot;
                  stroke=&quot;currentColor&quot;
                >
                  <path
                    strokeLinecap=&quot;round&quot;
                    strokeLinejoin=&quot;round&quot;
                    strokeWidth={2}
                    d=&quot;M5 13l4 4L19 7&quot;
                  />
                </svg>
              </div>
              <div>
                <h3 className=&quot;font-medium&quot;>Point-of-Sale Operations</h3>
                <p className=&quot;text-primary-100 text-sm&quot;>Efficient POS system that works both online and offline.</p>
              </div>
            </div>

            <div className=&quot;flex items-start&quot;>
              <div className=&quot;bg-white/20 p-2 rounded-full mr-4&quot;>
                <svg
                  xmlns=&quot;http://www.w3.org/2000/svg&quot;
                  className=&quot;h-5 w-5&quot;
                  fill=&quot;none&quot;
                  viewBox=&quot;0 0 24 24&quot;
                  stroke=&quot;currentColor&quot;
                >
                  <path
                    strokeLinecap=&quot;round&quot;
                    strokeLinejoin=&quot;round&quot;
                    strokeWidth={2}
                    d=&quot;M5 13l4 4L19 7&quot;
                  />
                </svg>
              </div>
              <div>
                <h3 className=&quot;font-medium&quot;>AI-Powered Insights</h3>
                <p className=&quot;text-primary-100 text-sm&quot;>Make data-driven decisions with our intelligent analytics system.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
