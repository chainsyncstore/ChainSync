import React, { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DebugLoginPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const { user, isAuthenticated, login } = useAuth();

  // Instead of using the normal debug-login API endpoint, we'll use a direct approach
  const handleDirectDebugLogin = async () => {
    try {
      setStatus('loading');
      setError(null);
      
      // Use regular login function with hardcoded admin credentials
      await login('admin', 'admin123');
      
      setStatus('success');
      
      // Use a timeout to ensure state has time to update before redirecting
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
    } catch (err) {
      console.error('Debug login failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };
  
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setStatus('loading');
      setError(null);
      await login(username, password);
      setStatus('success');
      
      // Use a timeout to ensure state has time to update before redirecting
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
    } catch (err) {
      console.error('Manual login failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  // Handle page content
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: '#f9fafb',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto'
      }}
    >
      <Card 
        className="w-full max-w-md" 
        style={{ 
          position: 'relative',
          zIndex: 100000,
          margin: '0 auto',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
        }}
      >
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">ChainSync Debug</CardTitle>
          <CardDescription className="text-center">
            Quick authentication for testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isAuthenticated ? (
            <div className="space-y-4">
              <Alert className="mb-4">
                <AlertDescription>
                  Logged in as <strong>{user?.username}</strong> ({user?.role})
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => window.location.href = '/dashboard'} 
                className="w-full bg-green-500 hover:bg-green-600"
              >
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center text-sm text-gray-500 mb-2">
                For quick testing, use the admin login button
              </div>
              
              <Button
                onClick={handleDirectDebugLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Logging in...' : 'One-Click Admin Login'}
              </Button>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">
                    Or Enter Credentials
                  </span>
                </div>
              </div>
              
              <form onSubmit={handleManualLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="h-10" // Taller input for easier mobile tapping
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-10" // Taller input for easier mobile tapping
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-10 mt-2" // Taller button for easier mobile tapping
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Logging in...' : 'Login'}
                </Button>
              </form>
              
              <div className="text-center text-xs text-gray-500 mt-4">
                Default accounts: admin/admin123, manager/manager123, cashier/cashier123
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}