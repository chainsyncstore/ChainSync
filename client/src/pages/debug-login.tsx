import React, { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DebugLoginPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const { user, isAuthenticated, login } = useAuth();

  const handleDebugLogin = async () => {
    try {
      setStatus('loading');
      setError(null);
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
  
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setStatus('loading');
      setError(null);
      await login(username, password);
      setStatus('success');
      
      // Navigate to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Manual login failed:', err);
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
            Authentication testing page
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
            <Tabs defaultValue="auto" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="auto">One-Click Login</TabsTrigger>
                <TabsTrigger value="manual">Manual Login</TabsTrigger>
              </TabsList>
              <TabsContent value="auto" className="space-y-4">
                <div className="text-center text-sm text-muted-foreground mb-4">
                  Click the button below to automatically login as an admin user
                </div>
                <Button
                  onClick={handleDebugLogin}
                  className="w-full"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Logging in...' : 'Login as Admin'}
                </Button>
              </TabsContent>
              <TabsContent value="manual" className="space-y-4">
                <form onSubmit={handleManualLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
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
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Logging in...' : 'Login'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}