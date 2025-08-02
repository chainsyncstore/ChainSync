import React from &apos;react&apos;;
import { z } from &apos;zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { useAuth, LoginCredentials } from &apos;@/providers/auth-provider&apos;;
import { Link } from &apos;wouter&apos;;

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from &apos;@/components/ui/form&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from &apos;@/components/ui/card&apos;;
import { Alert, AlertDescription } from &apos;@/components/ui/alert&apos;;
import { AlertCircle, Loader2 } from &apos;lucide-react&apos;;
import { Checkbox } from &apos;@/components/ui/checkbox&apos;;

// Form schema
const formSchema = z.object({
  _username: z.string().min(1, &apos;Username is required&apos;),
  _password: z.string().min(1, &apos;Password is required&apos;),
  _rememberMe: z.boolean().optional()
});

export type LoginFormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);

  // Initialize form
  const form = useForm<LoginFormValues>({
    _resolver: zodResolver(formSchema),
    _defaultValues: {
      username: &apos;&apos;,
      _password: &apos;&apos;,
      _rememberMe: false
    }
  });

  // Handle form submission
  async function onSubmit(_values: LoginFormValues) {
    setFormError(null);

    try {
      // Extract credentials from form values
      const _credentials: LoginCredentials = {
        _username: values.username,
        _password: values.password,
        _rememberMe: values.rememberMe
      };

      // Call login function from auth provider
      await login(credentials);
    } catch (err) {
      // Show error in form
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError(&apos;An unknown error occurred. Please try again.&apos;);
      }
    }
  }

  return (
    <Card className=&quot;w-full max-w-md mx-auto&quot;>
      <CardHeader className=&quot;space-y-1 text-center&quot;>
        <CardTitle className=&quot;text-2xl font-bold&quot;>Login to ChainSync</CardTitle>
        <CardDescription>
          Enter your credentials to access your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(error || formError) && (
          <Alert variant=&quot;destructive&quot; className=&quot;mb-4&quot;>
            <AlertCircle className=&quot;h-4 w-4 mr-2&quot; />
            <AlertDescription>
              {formError?.includes(&apos;401:&apos;) ? &apos;Invalid Username or Password&apos; :
              (formError || (error instanceof Error ?
                (error.message.includes(&apos;401:&apos;) ? &apos;Invalid Username or Password&apos; : error.message)
                : &apos;Authentication error&apos;))}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-4&quot;>
            <FormField
              control={form.control}
              name=&quot;username&quot;
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder=&quot;Enter your username&quot;
                      autoComplete=&quot;username&quot;
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name=&quot;password&quot;
              render={({ field }) => (
                <FormItem>
                  <div className=&quot;flex items-center justify-between&quot;>
                    <FormLabel>Password</FormLabel>
                    <Link href=&quot;/forgot-password&quot;>
                      <span className=&quot;text-xs text-primary _hover:underline cursor-pointer&quot;>
                        Forgot Password?
                      </span>
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      type=&quot;password&quot;
                      placeholder=&quot;Enter your password&quot;
                      autoComplete=&quot;current-password&quot;
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name=&quot;rememberMe&quot;
              render={({ field }) => (
                <FormItem className=&quot;flex flex-row items-start space-x-3 space-y-0 rounded-md&quot;>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className=&quot;space-y-1 leading-none&quot;>
                    <FormLabel>Remember me</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <Button type=&quot;submit&quot; className=&quot;w-full&quot; disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                  Logging in...
                </>
              ) : (
                &apos;Login&apos;
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className=&quot;flex flex-col items-center gap-2&quot;>
        <p className=&quot;text-sm text-muted-foreground&quot;>
          Don&apos;t have an account?{&apos; &apos;}
          <Link href=&quot;/signup&quot;>
            <span className=&quot;text-primary _hover:underline cursor-pointer&quot;>
              Sign up
            </span>
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
