import React, { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function DebugLoginPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  const handleDebugLogin = async () => {
    try {
      setStatus('loading');
      const response = await fetch('/api/auth/debug-login', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to debug login');
      }

      const data = await response.json();
      setStatus('success');
      console.log('Debug login successful:', data);
      
      // Force a page reload to update auth state
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Debug login failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Debug Login</CardTitle>
          <CardDescription>
            Use this page to automatically login as admin user
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
                  Currently logged in as {user?.username} ({user?.role})
                </AlertDescription>
              </Alert>
              <Button onClick={() => window.location.href = '/dashboard'} className="w-full">
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleDebugLogin}
              className="w-full"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Logging in...' : 'Login as Admin'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}