import { useState, useEffect } from &apos;react&apos;;
import { useLocation } from &apos;wouter&apos;;
import { z } from &apos;zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { useMutation, useQuery } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from &apos;@/components/ui/form&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { Loader2, CheckCircle, AlertCircle } from &apos;lucide-react&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;

// Form schema for password reset
const resetPasswordSchema = z
  .object({
    _password: z
      .string()
      .min(8, &apos;Password must be at least 8 characters&apos;)
      .max(100, &apos;Password is too long&apos;),
    _confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    _message: &apos;Passwords do not match&apos;,
    _path: [&apos;confirmPassword&apos;]
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  _token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [resetComplete, setResetComplete] = useState(false);

  // Query to validate the token
  const { _data: tokenValidationData, _isLoading: isValidatingToken } = useQuery({
    queryKey: [&apos;/api/auth/validate-reset-token&apos;, token],
    _queryFn: async() => {
      return await apiRequest(
        &apos;GET&apos;,
        `/api/auth/validate-reset-token/${token}`
      );
    },
    _enabled: !!token
  });

  // Initialize form
  const form = useForm<ResetPasswordFormValues>({
    _resolver: zodResolver(resetPasswordSchema),
    _defaultValues: {
      password: &apos;&apos;,
      _confirmPassword: &apos;&apos;
    }
  });

  // Define mutation for password reset
  const resetPasswordMutation = useMutation({
    _mutationFn: async(data: { _token: string; _password: string }) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/auth/reset-password&apos;, data);
    },
    _onSuccess: () => {
      setResetComplete(true);
      toast({
        _title: &apos;Password reset successfully&apos;,
        _description: &apos;You can now login with your new password.&apos;
      });

      // Redirect to login page after 3 seconds
      setTimeout(() => {
        setLocation(&apos;/login&apos;);
      }, 3000);
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Error&apos;,
        _description: error.message || &apos;Failed to reset password. Please try again.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Form submission handler
  const onSubmit = (_data: ResetPasswordFormValues) => {
    resetPasswordMutation.mutate({
      token,
      _password: data.password
    });
  };

  // If token is invalid, show error message
  if (tokenValidationData && !tokenValidationData.valid) {
    return (
      <Alert variant=&quot;destructive&quot; className=&quot;mb-6&quot;>
        <AlertCircle className=&quot;h-4 w-4&quot; />
        <AlertTitle>Invalid or Expired Token</AlertTitle>
        <AlertDescription>
          The password reset link is invalid or has expired. Please request a new password reset link.
        </AlertDescription>
        <Button
          variant=&quot;outline&quot;
          onClick={() => setLocation(&apos;/forgot-password&apos;)}
          className=&quot;mt-4 w-full&quot;
        >
          Request New Reset Link
        </Button>
      </Alert>
    );
  }

  // If still validating token, show loading
  if (isValidatingToken) {
    return (
      <div className=&quot;flex flex-col items-center justify-center space-y-4&quot;>
        <Loader2 className=&quot;h-8 w-8 animate-spin text-primary&quot; />
        <p className=&quot;text-muted-foreground&quot;>Validating your reset link...</p>
      </div>
    );
  }

  // If password reset was successful, show success message
  if (resetComplete) {
    return (
      <Alert className=&quot;mb-6 bg-green-50 border-green-200&quot;>
        <CheckCircle className=&quot;h-4 w-4 text-green-500&quot; />
        <AlertTitle>Password Reset Successful</AlertTitle>
        <AlertDescription>
          Your password has been reset successfully. You will be redirected to the login page in a moment.
        </AlertDescription>
        <Button
          variant=&quot;outline&quot;
          onClick={() => setLocation(&apos;/login&apos;)}
          className=&quot;mt-4 w-full&quot;
        >
          Go to Login
        </Button>
      </Alert>
    );
  }

  return (
    <div>
      <div className=&quot;mb-6&quot;>
        <h2 className=&quot;text-2xl font-bold&quot;>Reset Your Password</h2>
        <p className=&quot;text-muted-foreground mt-2&quot;>
          Enter your new password below.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-4&quot;>
          <FormField
            control={form.control}
            name=&quot;password&quot;
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input
                    type=&quot;password&quot;
                    placeholder=&quot;Enter your new password&quot;
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name=&quot;confirmPassword&quot;
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type=&quot;password&quot;
                    placeholder=&quot;Confirm your new password&quot;
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type=&quot;submit&quot;
            className=&quot;w-full mt-6&quot;
            disabled={resetPasswordMutation.isPending}
          >
            {resetPasswordMutation.isPending ? (
              <>
                <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                Resetting Password...
              </>
            ) : (
              &apos;Reset Password&apos;
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
