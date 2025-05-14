import React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth, LoginCredentials } from '@/providers/auth-provider';
import { Link } from 'wouter';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

// Form schema
const formSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export type LoginFormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);

  // Initialize form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
  });

  // Handle form submission
  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    
    try {
      // Extract credentials from form values
      const credentials: LoginCredentials = {
        username: values.username,
        password: values.password,
        rememberMe: values.rememberMe,
      };
      
      // Call login function from auth provider
      await login(credentials);
    } catch (err) {
      // Show error in form
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('An unknown error occurred. Please try again.');
      }
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Login to ChainSync</CardTitle>
        <CardDescription>
          Enter your credentials to access your account. You can use the "Remember Me" option to stay logged in on this device.
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your username" 
                      autoComplete="username"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link href="/forgot-password">
                      <span className="text-xs text-primary hover:underline cursor-pointer">
                        Forgot Password?
                      </span>
                    </Link>
                  </div>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Enter your password"
                      autoComplete="current-password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Remember me</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/signup">
            <span className="text-primary hover:underline cursor-pointer">
              Sign up
            </span>
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
