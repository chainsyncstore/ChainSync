import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AppShell } from '@/components/layout/app-shell';
import { AffiliateDashboard } from '@/components/affiliate/affiliate-dashboard';
import { useAuth } from '@/providers/auth-provider';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCwIcon, ArrowLeftIcon, UserIcon, UsersIcon, DollarSign } from 'lucide-react';

// Form schemas
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Type definitions
type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

export default function AffiliatePage() {
  const { user, isAuthenticated, login } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("login");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Signup form
  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      email: "",
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      const response = await apiRequest('POST', '/api/auth/login', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Call login with username and password from form data
      const formData = loginForm.getValues();
      login(formData.username, formData.password);
      
      toast({
        title: "Login successful!",
        description: "Welcome to the ChainSync Affiliate Program",
      });
      // No need to redirect, we'll stay on the affiliate page
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormValues) => {
      const { confirmPassword, ...signupData } = data;
      const response = await apiRequest('POST', '/api/auth/signup', {
        ...signupData,
        role: "affiliate", // Special role for affiliate-only users
        becomeAffiliate: true // Flag to automatically register as affiliate
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Call login with username and password from form data
      const formData = signupForm.getValues();
      login(formData.username, formData.password);
      
      toast({
        title: "Registration successful!",
        description: "Welcome to the ChainSync Affiliate Program",
      });
      setIsRegistering(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Submit login form
  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  // Submit signup form
  const onSignupSubmit = (data: SignupFormValues) => {
    signupMutation.mutate(data);
  };

  // If the user is already authenticated, show the affiliate dashboard
  if (isAuthenticated) {
    return (
      <AppShell>
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800">Affiliate Program</h1>
          <p className="text-neutral-500 mt-1">Earn commission by referring new users to ChainSync</p>
        </div>
        
        {/* Affiliate Dashboard */}
        <AffiliateDashboard />

        {/* Return to main app link for existing users */}
        {user?.role !== 'affiliate' && user?.role !== undefined && (
          <div className="mt-8">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/dashboard')}
              className="flex items-center"
            >
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </div>
        )}
      </AppShell>
    );
  }

  // For new visitors, show login/register options  
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="w-full py-4 px-4 bg-white border-b">
        <div className="container mx-auto max-w-screen-xl flex justify-between items-center">
          <Link href="/">
            <div className="flex items-center space-x-2 cursor-pointer">
              <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/>
                <path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/>
                <path d="M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z" fill="currentColor"/>
              </svg>
              <span className="text-xl font-bold">ChainSync</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost">Back to Home</Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-screen-xl px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-neutral-800">ChainSync Affiliate Program</h1>
            <p className="text-neutral-500 mt-2">Earn 10% commission on referred users' subscriptions for 12 months</p>
          </div>

          {/* Benefits section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-4">
              <div className="flex flex-col items-center text-center">
                <UserIcon className="h-10 w-10 text-primary mb-2" />
                <h3 className="font-medium">Quick Signup</h3>
                <p className="text-sm text-gray-500">Create your affiliate account in minutes</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex flex-col items-center text-center">
                <UsersIcon className="h-10 w-10 text-primary mb-2" />
                <h3 className="font-medium">Refer Businesses</h3>
                <p className="text-sm text-gray-500">Share your unique link with potential customers</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex flex-col items-center text-center">
                <DollarSign className="h-10 w-10 text-primary mb-2" />
                <h3 className="font-medium">Earn Commission</h3>
                <p className="text-sm text-gray-500">Get 10% of subscription payments for a year</p>
              </div>
            </Card>
          </div>

          {isRegistering ? (
            <Card className="w-full max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Create Affiliate Account</CardTitle>
                <CardDescription>
                  Sign up to join our affiliate program
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="johndoe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="pt-2">
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={signupMutation.isPending}
                      >
                        {signupMutation.isPending ? (
                          <><RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" /> Creating Account...</>
                        ) : (
                          <>Create Account</>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <div className="text-center w-full">
                  <Button 
                    variant="link" 
                    onClick={() => setIsRegistering(false)}
                    className="text-sm"
                  >
                    Already have an account? Log in
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <Card className="w-full max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Affiliate Login</CardTitle>
                <CardDescription>
                  Log in to access your affiliate dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="johndoe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="pt-2">
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <><RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" /> Logging in...</>
                        ) : (
                          <>Log in</>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <div className="text-center w-full">
                  <Button 
                    variant="link" 
                    onClick={() => setIsRegistering(true)}
                    className="text-sm"
                  >
                    Don't have an account? Sign up
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )}

          {/* Program details */}
          <div className="mt-12 bg-white p-6 rounded-lg border">
            <h2 className="text-xl font-bold mb-4">Affiliate Program Details</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">How It Works</h3>
                <p className="text-sm text-gray-600 mt-1">
                  When you share your unique referral link and someone signs up through it, they receive a 10% discount on their subscription for 12 months. You earn 10% commission on all their payments for 12 months.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Commission Structure</h3>
                <p className="text-sm text-gray-600 mt-1">
                  10% commission on all subscription payments made by your referred users for 12 months.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Payment Methods</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Paystack for Nigerian affiliates and Flutterwave for international users. Minimum payout is ₦10,000 or $10.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Payment Schedule</h3>
                <p className="text-sm text-gray-600 mt-1">
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