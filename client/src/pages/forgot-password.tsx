import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { Redirect, Link } from &apos;wouter&apos;;
import { ForgotPasswordForm } from &apos;@/components/auth/forgot-password-form&apos;;
import { Loader2 } from &apos;lucide-react&apos;;

export default function ForgotPasswordPage() {
  const { user, isLoading } = useAuth();

  // If user is already logged in, redirect to dashboard
  if (isLoading) {
    return (
      <div className=&quot;flex h-screen items-center justify-center&quot;>
        <Loader2 className=&quot;h-8 w-8 animate-spin text-primary&quot; />
      </div>
    );
  }

  if (user) {
    return <Redirect to=&quot;/&quot; />;
  }

  return (
    <div className=&quot;flex min-h-screen flex-col _lg:flex-row&quot;>
      {/* Form section */}
      <div className=&quot;flex flex-1 flex-col justify-center px-5 py-12 _lg:px-8 _lg:py-24&quot;>
        <div className=&quot;mx-auto w-full max-w-md&quot;>
          <div className=&quot;flex flex-col items-center mb-8&quot;>
            <Link href=&quot;/&quot; className=&quot;text-2xl font-bold text-primary&quot;>
              ChainSync
            </Link>
            <h2 className=&quot;mt-2 text-center text-sm text-muted-foreground&quot;>
              Forgot your password? No problem.
            </h2>
          </div>

          <div className=&quot;bg-card p-6 shadow-sm rounded-xl border border-border&quot;>
            <ForgotPasswordForm />
          </div>
        </div>
      </div>

      {/* Hero section */}
      <div className=&quot;hidden bg-gradient-to-br from-primary to-indigo-600 _lg:flex _lg:flex-1 _lg:flex-col _lg:justify-center _lg:px-8 _lg:py-24&quot;>
        <div className=&quot;mx-auto max-w-md text-white&quot;>
          <h2 className=&quot;text-3xl font-bold&quot;>ChainSync</h2>
          <p className=&quot;mt-4 text-lg&quot;>
            All-in-one retail management platform for supermarkets and multi-store chains.
          </p>
          <div className=&quot;mt-8&quot;>
            <ul className=&quot;space-y-3&quot;>
              <li className=&quot;flex items-center&quot;>
                <div className=&quot;flex-shrink-0 rounded-full bg-white/20 p-1&quot;>
                  <svg className=&quot;h-5 w-5 text-white&quot; viewBox=&quot;0 0 20 20&quot; fill=&quot;currentColor&quot;>
                    <path fillRule=&quot;evenodd&quot; d=&quot;M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z&quot; clipRule=&quot;evenodd&quot; />
                  </svg>
                </div>
                <span className=&quot;ml-3&quot;>Complete inventory management</span>
              </li>
              <li className=&quot;flex items-center&quot;>
                <div className=&quot;flex-shrink-0 rounded-full bg-white/20 p-1&quot;>
                  <svg className=&quot;h-5 w-5 text-white&quot; viewBox=&quot;0 0 20 20&quot; fill=&quot;currentColor&quot;>
                    <path fillRule=&quot;evenodd&quot; d=&quot;M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z&quot; clipRule=&quot;evenodd&quot; />
                  </svg>
                </div>
                <span className=&quot;ml-3&quot;>Point-of-sale operations</span>
              </li>
              <li className=&quot;flex items-center&quot;>
                <div className=&quot;flex-shrink-0 rounded-full bg-white/20 p-1&quot;>
                  <svg className=&quot;h-5 w-5 text-white&quot; viewBox=&quot;0 0 20 20&quot; fill=&quot;currentColor&quot;>
                    <path fillRule=&quot;evenodd&quot; d=&quot;M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z&quot; clipRule=&quot;evenodd&quot; />
                  </svg>
                </div>
                <span className=&quot;ml-3&quot;>Real-time analytics</span>
              </li>
              <li className=&quot;flex items-center&quot;>
                <div className=&quot;flex-shrink-0 rounded-full bg-white/20 p-1&quot;>
                  <svg className=&quot;h-5 w-5 text-white&quot; viewBox=&quot;0 0 20 20&quot; fill=&quot;currentColor&quot;>
                    <path fillRule=&quot;evenodd&quot; d=&quot;M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z&quot; clipRule=&quot;evenodd&quot; />
                  </svg>
                </div>
                <span className=&quot;ml-3&quot;>Customer loyalty management</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
