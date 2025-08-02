import React from &apos;react&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { LoginForm } from &apos;@/components/auth/login-form&apos;;
import { useLocation } from &apos;wouter&apos;;

export default function LoginPage() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      // Redirect based on user role
      if (user?.role === &apos;cashier&apos;) {
        setLocation(&apos;/pos&apos;);
      } else {
        setLocation(&apos;/dashboard&apos;);
      }
    }
  }, [isAuthenticated, user, setLocation]);

  return (
    <div className=&quot;min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4&quot;>
      <div className=&quot;mb-8 text-center&quot;>
        <div className=&quot;flex items-center justify-center mb-4&quot;>
          <svg className=&quot;w-12 h-12 text-primary&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;>
            <path d=&quot;M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z&quot; fill=&quot;currentColor&quot;/>
            <path d=&quot;M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z&quot; fill=&quot;currentColor&quot;/>
            <path d=&quot;M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z&quot; fill=&quot;currentColor&quot;/>
          </svg>
          <h1 className=&quot;text-3xl font-bold text-gray-900 ml-2&quot;>ChainSync</h1>
        </div>
        <p className=&quot;text-gray-600&quot;>Retail Management Platform</p>
      </div>

      <LoginForm />

      <div className=&quot;mt-8 text-center text-sm text-gray-500&quot;>
        <p>© {new Date().getFullYear()} ChainSync. All rights reserved.</p>
      </div>
    </div>
  );
}
