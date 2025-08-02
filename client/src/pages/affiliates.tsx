import { useState } from &apos;react&apos;;
import { Link, useLocation } from &apos;wouter&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { AffiliateDashboard } from &apos;@/components/affiliate/affiliate-dashboard&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { z } from &apos;zod&apos;;
import { useForm } from &apos;react-hook-form&apos;;
import { zodResolver } from &apos;@hookform/resolvers/zod&apos;;
import { useMutation } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from &apos;@/components/ui/form&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { Alert, AlertDescription } from &apos;@/components/ui/alert&apos;;
import { RefreshCwIcon, ArrowLeftIcon, UserIcon, UsersIcon, DollarSign } from &apos;lucide-react&apos;;

// Form schemas
const loginSchema = z.object({
  _username: z.string().min(3, &apos;Username must be at least 3 characters&apos;),
  _password: z.string().min(6, &apos;Password must be at least 6 characters&apos;)
});

const signupSchema = z.object({
  _username: z.string().min(3, &apos;Username must be at least 3 characters&apos;),
  _password: z.string().min(6, &apos;Password must be at least 6 characters&apos;),
  _confirmPassword: z.string().min(6, &apos;Confirm password must be at least 6 characters&apos;),
  _fullName: z.string().min(2, &apos;Full name must be at least 2 characters&apos;),
  _email: z.string().email(&apos;Please enter a valid email&apos;)
}).refine((data) => data.password === data.confirmPassword, {
  _message: &quot;Passwords don&apos;t match&quot;,
  _path: [&apos;confirmPassword&apos;]
});

// Type definitions
type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

export default function AffiliatePage() {
  const { user, isAuthenticated, login } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  // const [activeTab, setActiveTab] = useState<string>(&quot;login&quot;); // Unused
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Login form
  const loginForm = useForm<LoginFormValues>({
    _resolver: zodResolver(loginSchema),
    _defaultValues: {
      username: &apos;&apos;,
      _password: &apos;&apos;
    }
  });

  // Signup form
  const signupForm = useForm<SignupFormValues>({
    _resolver: zodResolver(signupSchema),
    _defaultValues: {
      username: &apos;&apos;,
      _password: &apos;&apos;,
      _confirmPassword: &apos;&apos;,
      _fullName: &apos;&apos;,
      _email: &apos;&apos;
    }
  });

  // Login mutation
  const loginMutation = useMutation({
    _mutationFn: async(_data: LoginFormValues) => {
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/auth/login&apos;, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || &apos;Login failed&apos;);
      }
      return response.json();
    },
    _onSuccess: () => { // data parameter removed
      // Call login with username and password from form data
      const formData = loginForm.getValues();
      login({ _username: formData.username, _password: formData.password });

      toast({
        _title: &apos;Login successful!&apos;,
        _description: &apos;Welcome to the ChainSync Affiliate Program&apos;
      });
      // No need to redirect, we&apos;ll stay on the affiliate page
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Login failed&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Signup mutation
  const signupMutation = useMutation({
    _mutationFn: async(_data: SignupFormValues) => {
      const { confirmPassword, ...signupData } = data;

      // First attempt signup
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/auth/signup&apos;, {
        ...signupData,
        _role: &apos;affiliate&apos;, // Special role for affiliate-only users
        _becomeAffiliate: true // Flag to automatically register as affiliate
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || &apos;Registration failed&apos;);
      }

      return response.json();
    },
    _onSuccess: () => { // data parameter removed
      // Call login with username and password from form data
      const formData = signupForm.getValues();
      login({ _username: formData.username, _password: formData.password });

      toast({
        _title: &apos;Registration successful!&apos;,
        _description: &apos;Welcome to the ChainSync Affiliate Program&apos;
      });
      setIsRegistering(false);
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Registration failed&apos;,
        _description: error.message,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Submit login form
  const onLoginSubmit = (_data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  // Submit signup form
  const onSignupSubmit = (_data: SignupFormValues) => {
    signupMutation.mutate(data);
  };

  // If the user is already authenticated, show the affiliate dashboard
  if (isAuthenticated) {
    return (
      <AppShell>
        {/* Page Title */}
        <div className=&quot;mb-6&quot;>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>Affiliate Program</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>Earn commission by referring new users to ChainSync</p>
        </div>

        {/* Affiliate Dashboard */}
        <AffiliateDashboard />

        {/* Return to main app link for existing users */}
        {user?.role && user?.role !== &apos;affiliate&apos; && (
          <div className=&quot;mt-8&quot;>
            <Button
              variant=&quot;outline&quot;
              onClick={() => setLocation(&apos;/dashboard&apos;)}
              className=&quot;flex items-center&quot;
            >
              <ArrowLeftIcon className=&quot;mr-2 h-4 w-4&quot; />
              Return to Dashboard
            </Button>
          </div>
        )}
      </AppShell>
    );
  }

  // For new visitors, show login/register options
  return (
    <div className=&quot;min-h-screen bg-neutral-50&quot;>
      {/* Header */}
      <header className=&quot;w-full py-4 px-4 bg-white border-b&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl flex justify-between items-center&quot;>
          <Link href=&quot;/&quot;>
            <div className=&quot;flex items-center space-x-2 cursor-pointer&quot;>
              <svg className=&quot;w-8 h-8 text-primary&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;>
                <path d=&quot;M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z&quot; fill=&quot;currentColor&quot;/>
                <path d=&quot;M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z&quot; fill=&quot;currentColor&quot;/>
                <path d=&quot;M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z&quot; fill=&quot;currentColor&quot;/>
              </svg>
              <span className=&quot;text-xl font-bold&quot;>ChainSync</span>
            </div>
          </Link>
          <Link href=&quot;/&quot;>
            <Button variant=&quot;ghost&quot;>Back to Home</Button>
          </Link>
        </div>
      </header>

      <div className=&quot;container mx-auto max-w-screen-xl px-4 py-12&quot;>
        <div className=&quot;max-w-3xl mx-auto&quot;>
          <div className=&quot;text-center mb-8&quot;>
            <h1 className=&quot;text-3xl font-bold text-neutral-800&quot;>ChainSync Affiliate Program</h1>
            <p className=&quot;text-neutral-500 mt-2&quot;>Earn 10% commission on referred users&apos; subscriptions for 12 months</p>
          </div>

          {/* Benefits section */}
          <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4 mb-8&quot;>
            <Card className=&quot;p-4&quot;>
              <div className=&quot;flex flex-col items-center text-center&quot;>
                <UserIcon className=&quot;h-10 w-10 text-primary mb-2&quot; />
                <h3 className=&quot;font-medium&quot;>Quick Signup</h3>
                <p className=&quot;text-sm text-gray-500&quot;>Create your affiliate account in minutes</p>
              </div>
            </Card>
            <Card className=&quot;p-4&quot;>
              <div className=&quot;flex flex-col items-center text-center&quot;>
                <UsersIcon className=&quot;h-10 w-10 text-primary mb-2&quot; />
                <h3 className=&quot;font-medium&quot;>Refer Businesses</h3>
                <p className=&quot;text-sm text-gray-500&quot;>Share your unique link with potential customers</p>
              </div>
            </Card>
            <Card className=&quot;p-4&quot;>
              <div className=&quot;flex flex-col items-center text-center&quot;>
                <DollarSign className=&quot;h-10 w-10 text-primary mb-2&quot; />
                <h3 className=&quot;font-medium&quot;>Earn Commission</h3>
                <p className=&quot;text-sm text-gray-500&quot;>Get 10% of subscription payments for a year</p>
              </div>
            </Card>
          </div>

          {isRegistering ? (
            <Card className=&quot;w-full max-w-md mx-auto&quot;>
              <CardHeader>
                <CardTitle>Create Affiliate Account</CardTitle>
                <CardDescription>
                  Sign up to join our affiliate program
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className=&quot;space-y-4&quot;>
                    <FormField
                      control={signupForm.control}
                      name=&quot;fullName&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder=&quot;John Doe&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name=&quot;email&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type=&quot;email&quot; placeholder=&quot;john@example.com&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name=&quot;username&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder=&quot;johndoe&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name=&quot;password&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type=&quot;password&quot; placeholder=&quot;••••••••&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name=&quot;confirmPassword&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type=&quot;password&quot; placeholder=&quot;••••••••&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className=&quot;pt-2&quot;>
                      <Button
                        type=&quot;submit&quot;
                        className=&quot;w-full&quot;
                        disabled={signupMutation.isPending}
                      >
                        {signupMutation.isPending ? (
                          <><RefreshCwIcon className=&quot;mr-2 h-4 w-4 animate-spin&quot; /> Creating Account...</>
                        ) : (
                          <>Create Account</>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className=&quot;flex flex-col space-y-4&quot;>
                <div className=&quot;text-center w-full&quot;>
                  <Button
                    variant=&quot;link&quot;
                    onClick={() => setIsRegistering(false)}
                    className=&quot;text-sm&quot;
                  >
                    Already have an account? Log in
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <Card className=&quot;w-full max-w-md mx-auto&quot;>
              <CardHeader>
                <CardTitle>Login to your Affiliate Account</CardTitle>
                <CardDescription>
                  Log in to access your affiliate dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className=&quot;space-y-4&quot;>
                    <FormField
                      control={loginForm.control}
                      name=&quot;username&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder=&quot;johndoe&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name=&quot;password&quot;
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type=&quot;password&quot; placeholder=&quot;••••••••&quot; {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className=&quot;pt-2&quot;>
                      <Button
                        type=&quot;submit&quot;
                        className=&quot;w-full&quot;
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <><RefreshCwIcon className=&quot;mr-2 h-4 w-4 animate-spin&quot; /> Logging in...</>
                        ) : (
                          <>Log in</>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter>
                {/* Removed &quot;Don&apos;t have an account? Sign up&quot; button */}
              </CardFooter>
            </Card>
          )}

          {/* Program details */}
          <div className=&quot;mt-12 bg-white p-6 rounded-lg border&quot;>
            <h2 className=&quot;text-xl font-bold mb-4&quot;>Affiliate Program Details</h2>
            <div className=&quot;space-y-4&quot;>
              <div>
                <h3 className=&quot;font-medium&quot;>How It Works</h3>
                <p className=&quot;text-sm text-gray-600 mt-1&quot;>
                  When you share your unique referral link and someone signs up through it, they receive a 10% discount on their subscription for 12 months. You earn 10% commission on all their payments for 12 months.
                </p>
              </div>
              <div>
                <h3 className=&quot;font-medium&quot;>Commission Structure</h3>
                <p className=&quot;text-sm text-gray-600 mt-1&quot;>
                  10% commission on all subscription payments made by your referred users for 12 months.
                </p>
              </div>
              <div>
                <h3 className=&quot;font-medium&quot;>Payment Methods</h3>
                <p className=&quot;text-sm text-gray-600 mt-1&quot;>
                  Paystack for Nigerian affiliates and Flutterwave for international users. Minimum payout is ₦10,000 or $10.
                </p>
              </div>
              <div>
                <h3 className=&quot;font-medium&quot;>Payment Schedule</h3>
                <p className=&quot;text-sm text-gray-600 mt-1&quot;>
                  Payments are processed monthly for all qualifying earnings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
