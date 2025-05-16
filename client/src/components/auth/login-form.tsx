import React from 'react';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

// Simplified form schema for Replit Auth
const formSchema = z.object({
  rememberMe: z.boolean().optional(),
});

export function LoginForm() {
  const { isLoading, error } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [rememberMe, setRememberMe] = React.useState<boolean>(false);

  // Handle login with Replit Auth
  function handleLogin() {
    setFormError(null);
    // Redirect directly to the login endpoint
    window.location.href = rememberMe 
      ? `/api/login?remember=true` 
      : '/api/login';
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Login to ChainSync</CardTitle>
        <CardDescription>
          Sign in with your account to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(error || formError) && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>
              {formError || (error instanceof Error ? error.message : 'Authentication error')}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <div className="space-y-1 leading-none">
              <label className="text-sm font-medium leading-none">Remember me</label>
            </div>
          </div>

          <Button 
            onClick={handleLogin} 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              'Sign in with Replit'
            )}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Don't have an account? Sign up with Replit when you login.
        </p>
      </CardFooter>
    </Card>
  );
}
