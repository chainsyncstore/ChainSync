import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, CreditCard, LockIcon } from 'lucide-react';
import { ReferralBanner } from '@/components/affiliate/referral-banner';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';

export default function SignupPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  
  // Get referral code and plan from URL
  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get('ref');
  const selectedPlan = urlParams.get('plan') || 'basic';
  
  // Mutation for signup
  const signupMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const data = {
        username: formData.get('username') as string,
        password: formData.get('password') as string,
        email: formData.get('email') as string,
        fullName: formData.get('fullName') as string,
        plan: formData.get('plan') as string,
        referralCode: referralCode,
      };
      
      const response = await apiRequest('POST', '/api/subscriptions/signup', data);
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Account Created!",
        description: "Your account has been created successfully. You can now log in.",
      });
      
      // Try to log in automatically
      try {
        const formData = new FormData(document.querySelector('form')!);
        await login(formData.get('username') as string, formData.get('password') as string);
        navigate('/dashboard');
      } catch (error) {
        // If auto-login fails, redirect to login page
        navigate('/login');
      }
    },
    onError: (error) => {
      toast({
        title: "Signup Failed",
        description: "Could not create your account. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    signupMutation.mutate(formData);
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-neutral-100 to-white p-4">
      <div className="w-full max-w-xl">
        {/* Back to Home Link */}
        <div className="mb-6">
          <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-800 flex items-center">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
        </div>
        
        {/* Logo and Title */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-neutral-800">
            Create Your ChainSync Account
          </h1>
          <p className="text-neutral-500 mt-2">
            Start managing your retail business more efficiently
          </p>
        </div>
        
        {/* Referral Banner */}
        <ReferralBanner />
        
        {/* Selected Plan Banner */}
        {selectedPlan && (
          <div className="mb-4 p-3 bg-primary/10 rounded-md border border-primary/20 text-center">
            <p className="text-sm font-medium">
              You're signing up for the <span className="font-bold text-primary">{selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan</span>
              {referralCode && <span> with a 10% referral discount for 12 months!</span>}
            </p>
          </div>
        )}
        
        {/* Signup Form */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Enter your details to create an account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    name="fullName" 
                    placeholder="John Doe" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    required 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username" 
                    name="username" 
                    placeholder="johndoe" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password" 
                    placeholder="••••••••" 
                    required 
                    minLength={8}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plan">Subscription Plan</Label>
                <Select name="plan" defaultValue={selectedPlan}>
                  <SelectTrigger id="plan">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic (1 store) {referralCode && "- 10% off for 12 months"}</SelectItem>
                    <SelectItem value="pro">Pro (up to 10 stores) {referralCode && "- 10% off for 12 months"}</SelectItem>
                    <SelectItem value="enterprise">Enterprise (10+ stores) {referralCode && "- 10% off for 12 months"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-neutral-50 p-3 rounded-md border border-neutral-200 flex items-start">
                <LockIcon className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium">14-Day Free Trial</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    No payment required during the trial period. Cancel anytime.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={signupMutation.isPending}
              >
                {signupMutation.isPending ? "Creating Account..." : "Create Account"}
              </Button>
              <p className="text-center text-sm text-neutral-500 mt-2">
                Already have an account? <Link href="/login" className="text-primary hover:underline">Log in</Link>
              </p>
              <div className="text-xs text-center text-neutral-400 mt-4 flex items-center justify-center">
                <CreditCard className="h-3 w-3 mr-1" />
                Secure payment powered by Paystack/Flutterwave
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}