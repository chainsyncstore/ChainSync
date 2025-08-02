import React from &apos;react&apos;;
import { z } from &apos;zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { useLocation } from &apos;wouter&apos;;
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from &apos;@/components/ui/form&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from &apos;@/components/ui/card&apos;;
import { Alert, AlertDescription } from &apos;@/components/ui/alert&apos;;
import { AlertCircle, Loader2 } from &apos;lucide-react&apos;;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from &apos;@/components/ui/select&apos;;
import { useMutation } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import type { LoginCredentials } from &apos;@/providers/auth-provider&apos;;

// Form schema with validation
const formSchema = z.object({
  _fullName: z.string().min(2, &apos;Full name must be at least 2 characters&apos;),
  _email: z.string().email(&apos;Please provide a valid email address&apos;),
  _username: z.string().min(3, &apos;Username must be at least 3 characters&apos;),
  _password: z.string().min(6, &apos;Password must be at least 6 characters&apos;),
  _confirmPassword: z.string(),
  _role: z.enum([&apos;cashier&apos;, &apos;manager&apos;, &apos;admin&apos;], {
    _required_error: &apos;Please select a role&apos;
  }),
  _storeId: z.number().optional()
}).refine(data => data.password === data.confirmPassword, {
  _message: &apos;Passwords do not match&apos;,
  _path: [&apos;confirmPassword&apos;]
});

export type RegisterFormValues = z.infer<typeof formSchema>;

export function RegisterForm() {
  const { toast } = useToast();
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [formError, setFormError] = React.useState<string | null>(null);

  // Initialize form
  const form = useForm<RegisterFormValues>({
    _resolver: zodResolver(formSchema),
    _defaultValues: {
      fullName: &apos;&apos;,
      _email: &apos;&apos;,
      _username: &apos;&apos;,
      _password: &apos;&apos;,
      _confirmPassword: &apos;&apos;,
      _role: &apos;cashier&apos;
    }
  });

  // Register user mutation
  const registerMutation = useMutation({
    _mutationFn: async(_values: RegisterFormValues) => {
      const userData = {
        _fullName: values.fullName,
        _email: values.email,
        _username: values.username,
        _password: values.password,
        _role: values.role,
        _storeId: values.storeId || null
      };

      return await apiRequest(&apos;POST&apos;, &apos;/api/auth/register&apos;, userData);
    },
    _onSuccess: async(data, variables) => {
      toast({
        _title: &apos;Registration Successful&apos;,
        _description: &apos;Your account has been created successfully.&apos;
      });

      // Try to log in automatically
      try {
        const _credentials: LoginCredentials = {
          _username: variables.username,
          _password: variables.password
        };

        await login(credentials);
        navigate(&apos;/dashboard&apos;);
      } catch (err) {
        // If auto-login fails, redirect to login page
        navigate(&apos;/login&apos;);
      }
    },
    _onError: (_error: Error) => {
      setFormError(error.message);

      toast({
        _title: &apos;Registration Failed&apos;,
        _description: error.message || &apos;Could not create your account. Please try again.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Handle form submission
  async function onSubmit(_values: RegisterFormValues) {
    setFormError(null);
    await registerMutation.mutateAsync(values);
  }

  return (
    <Card className=&quot;w-full max-w-md mx-auto&quot;>
      <CardHeader className=&quot;space-y-1&quot;>
        <CardTitle className=&quot;text-2xl font-bold&quot;>Create an Account</CardTitle>
        <CardDescription>
          Enter your details to create your account and join ChainSync
        </CardDescription>
      </CardHeader>
      <CardContent>
        {formError && (
          <Alert variant=&quot;destructive&quot; className=&quot;mb-4&quot;>
            <AlertCircle className=&quot;h-4 w-4 mr-2&quot; />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className=&quot;space-y-4&quot;>
            <FormField
              control={form.control}
              name=&quot;fullName&quot;
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder=&quot;John Doe&quot;
                      autoComplete=&quot;name&quot;
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name=&quot;email&quot;
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type=&quot;email&quot;
                      placeholder=&quot;john@example.com&quot;
                      autoComplete=&quot;email&quot;
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name=&quot;username&quot;
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder=&quot;johndoe&quot;
                      autoComplete=&quot;username&quot;
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className=&quot;grid grid-cols-2 gap-4&quot;>
              <FormField
                control={form.control}
                name=&quot;password&quot;
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type=&quot;password&quot;
                        placeholder=&quot;********&quot;
                        autoComplete=&quot;new-password&quot;
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
                        placeholder=&quot;********&quot;
                        autoComplete=&quot;new-password&quot;
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name=&quot;role&quot;
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder=&quot;Select your role&quot; />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value=&quot;cashier&quot;>Cashier</SelectItem>
                      <SelectItem value=&quot;manager&quot;>Manager</SelectItem>
                      <SelectItem value=&quot;admin&quot;>Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type=&quot;submit&quot;
              className=&quot;w-full&quot;
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                  Creating Account...
                </>
              ) : (
                &apos;Create Account&apos;
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className=&quot;flex justify-center&quot;>
        <p className=&quot;text-sm text-gray-500&quot;>
          Already have an account?{&apos; &apos;}
          <Button variant=&quot;link&quot; className=&quot;p-0&quot; onClick={() => navigate(&apos;/login&apos;)}>
            Log in
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
}
