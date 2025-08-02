import { useState } from &apos;react&apos;;
import { z } from &apos;zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { useMutation } from &apos;@tanstack/react-query&apos;;
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
import { Loader2 } from &apos;lucide-react&apos;;

// Form schema for password reset request
const forgotPasswordSchema = z.object({
  _email: z.string().email(&apos;Please enter a valid email address&apos;)
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  // Initialize form
  const form = useForm<ForgotPasswordFormValues>({
    _resolver: zodResolver(forgotPasswordSchema),
    _defaultValues: {
      email: &apos;&apos;
    }
  });

  // Define mutation for password reset request
  const forgotPasswordMutation = useMutation({
    _mutationFn: async(_data: ForgotPasswordFormValues) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/auth/forgot-password&apos;, data);
    },
    _onSuccess: () => {
      setSubmitted(true);
      toast({
        _title: &apos;Password reset request sent&apos;,
        _description:
          &apos;If an account with that email exists, a password reset link has been sent.&apos;
      });
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Error&apos;,
        _description: error.message || &apos;Failed to send password reset request. Please try again.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Form submission handler
  const onSubmit = (_data: ForgotPasswordFormValues) => {
    forgotPasswordMutation.mutate(data);
  };

  // If form was submitted, show success message
  if (submitted) {
    return (
      <div className=&quot;flex flex-col items-center justify-center space-y-4 text-center&quot;>
        <h2 className=&quot;text-2xl font-bold&quot;>Check Your Email</h2>
        <p className=&quot;text-muted-foreground&quot;>
          If an account with that email exists, we&apos;ve sent a password reset link.
        </p>
        <p className=&quot;text-muted-foreground&quot;>
          Please check your inbox and spam folder. The link will expire in 1 hour.
        </p>
        <Button
          variant=&quot;outline&quot;
          onClick={() => setSubmitted(false)}
          className=&quot;mt-4&quot;
        >
          Send Another Email
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className=&quot;mb-6&quot;>
        <h2 className=&quot;text-2xl font-bold&quot;>Reset Your Password</h2>
        <p className=&quot;text-muted-foreground mt-2&quot;>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-4&quot;>
          <FormField
            control={form.control}
            name=&quot;email&quot;
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type=&quot;email&quot;
                    placeholder=&quot;Enter your email address&quot;
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className=&quot;flex justify-between items-center mt-6&quot;>
            <Button
              type=&quot;button&quot;
              variant=&quot;outline&quot;
              onClick={() => window.history.back()}
            >
              Back to Login
            </Button>
            <Button
              type=&quot;submit&quot;
              disabled={forgotPasswordMutation.isPending}
            >
              {forgotPasswordMutation.isPending ? (
                <>
                  <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                  Sending...
                </>
              ) : (
                &apos;Send Reset Link&apos;
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
