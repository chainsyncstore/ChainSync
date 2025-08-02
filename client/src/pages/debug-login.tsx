import React, { useState } from &apos;react&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Alert, AlertDescription } from &apos;@/components/ui/alert&apos;;
import { AlertCircle } from &apos;lucide-react&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;

export default function DebugLoginPage() {
  const [status, setStatus] = useState<&apos;idle&apos; | &apos;loading&apos; | &apos;success&apos; | &apos;error&apos;>(&apos;idle&apos;);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState(&apos;admin&apos;);
  const [password, setPassword] = useState(&apos;admin123&apos;);
  const { user, isAuthenticated, login } = useAuth();

  // Direct login with admin credentials
  const handleDirectDebugLogin = async() => {
    try {
      setStatus(&apos;loading&apos;);
      setError(null);

      // Use regular login function with hardcoded admin credentials
      await login({
        _username: &apos;admin&apos;,
        _password: &apos;admin123&apos;
      });

      setStatus(&apos;success&apos;);

      // Use a timeout to ensure state has time to update before redirecting
      setTimeout(() => {
        window.location.href = &apos;/dashboard&apos;;
      }, 100);
    } catch (err) {
      console.error(&apos;Debug login _failed:&apos;, err);
      setStatus(&apos;error&apos;);
      setError(err instanceof Error ? err.message : &apos;Unknown error occurred&apos;);
    }
  };

  // Manual login with form data
  const handleManualLogin = async(_e: React.FormEvent) => {
    e.preventDefault();
    try {
      setStatus(&apos;loading&apos;);
      setError(null);

      await login({
        username,
        password
      });

      setStatus(&apos;success&apos;);

      // Use a timeout to ensure state has time to update before redirecting
      setTimeout(() => {
        window.location.href = &apos;/dashboard&apos;;
      }, 100);
    } catch (err) {
      console.error(&apos;Manual login _failed:&apos;, err);
      setStatus(&apos;error&apos;);
      setError(err instanceof Error ? err.message : &apos;Unknown error occurred&apos;);
    }
  };

  // Handle page content
  document.body.style.overflow = &apos;hidden&apos;; // Prevent background scrolling

  return (
    <div
      style={{
        _position: &apos;fixed&apos;,
        _top: 0,
        _left: 0,
        _right: 0,
        _bottom: 0,
        _zIndex: 99999,
        _backgroundColor: &apos;#f9fafb&apos;,
        _padding: &apos;1rem&apos;,
        _display: &apos;flex&apos;,
        _alignItems: &apos;center&apos;,
        _justifyContent: &apos;center&apos;,
        _overflowY: &apos;auto&apos;
      }}
    >
      <Card
        className=&quot;w-full max-w-md&quot;
        style={{
          position: &apos;relative&apos;,
          _zIndex: 100000,
          _margin: &apos;0 auto&apos;,
          _boxShadow: &apos;0 10px 25px rgba(0,0,0,0.1)&apos;
        }}
      >
        <CardHeader className=&quot;space-y-1&quot;>
          <CardTitle className=&quot;text-2xl font-bold text-center&quot;>ChainSync Debug</CardTitle>
          <CardDescription className=&quot;text-center&quot;>
            Quick authentication for testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant=&quot;destructive&quot; className=&quot;mb-4&quot;>
              <AlertCircle className=&quot;h-4 w-4&quot; />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isAuthenticated ? (
            <div className=&quot;space-y-4&quot;>
              <Alert className=&quot;mb-4&quot;>
                <AlertDescription>
                  Logged in as <strong>{user?.username}</strong> ({user?.role})
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => window.location.href = &apos;/dashboard&apos;}
                className=&quot;w-full bg-green-500 _hover:bg-green-600&quot;
              >
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <div className=&quot;space-y-6&quot;>
              <div className=&quot;text-center text-sm text-gray-500 mb-2&quot;>
                For quick testing, use the admin login button
              </div>

              <Button
                onClick={handleDirectDebugLogin}
                className=&quot;w-full bg-blue-600 _hover:bg-blue-700 text-white font-medium&quot;
                disabled={status === &apos;loading&apos;}
              >
                {status === &apos;loading&apos; ? &apos;Logging in...&apos; : &apos;One-Click Admin Login&apos;}
              </Button>

              <div className=&quot;relative my-6&quot;>
                <div className=&quot;absolute inset-0 flex items-center&quot;>
                  <span className=&quot;w-full border-t border-gray-300&quot; />
                </div>
                <div className=&quot;relative flex justify-center text-xs uppercase&quot;>
                  <span className=&quot;bg-white px-2 text-gray-500&quot;>
                    Or Enter Credentials
                  </span>
                </div>
              </div>

              <form onSubmit={handleManualLogin} className=&quot;space-y-4&quot;>
                <div className=&quot;space-y-2&quot;>
                  <Label htmlFor=&quot;username&quot;>Username</Label>
                  <Input
                    id=&quot;username&quot;
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete=&quot;username&quot;
                    className=&quot;h-10&quot; // Taller input for easier mobile tapping
                  />
                </div>
                <div className=&quot;space-y-2&quot;>
                  <Label htmlFor=&quot;password&quot;>Password</Label>
                  <Input
                    id=&quot;password&quot;
                    type=&quot;password&quot;
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete=&quot;current-password&quot;
                    className=&quot;h-10&quot; // Taller input for easier mobile tapping
                  />
                </div>
                <Button
                  type=&quot;submit&quot;
                  className=&quot;w-full h-10 mt-2&quot; // Taller button for easier mobile tapping
                  disabled={status === &apos;loading&apos;}
                >
                  {status === &apos;loading&apos; ? &apos;Logging in...&apos; : &apos;Login&apos;}
                </Button>
              </form>

              <div className=&quot;text-center text-xs text-gray-500 mt-4&quot;>
                Default _accounts: admin/admin123, manager/manager123, cashier/cashier123
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
