import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, CreditCard, LockIcon, Eye, EyeOff, AlertCircle, Check, Loader2 } from 'lucide-react';
import { ReferralBanner } from '@/components/affiliate/referral-banner';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Define types for form data
interface SignupFormData {
  fullName: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  plan: 'basic' | 'pro' | 'enterprise';
  acceptTerms: boolean;
}

// Error response type
interface ApiError {
  message: string;
  field?: string;
}

// Password strength indicator component
const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  if (!password) return null;
  
  // Check password requirements
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  // Calculate strength score (0-5)
  const strengthScore = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial
  ].filter(Boolean).length;
  
  // Determine color based on strength
  const strengthColor = [
    'bg-red-500',           // 0: Very Weak
    'bg-red-500',           // 1: Weak
    'bg-yellow-500',        // 2: Fair
    'bg-yellow-400',        // 3: Good
    'bg-green-500',         // 4: Strong
    'bg-green-600'          // 5: Very Strong
  ][strengthScore];
  
  const strengthText = [
    'Very Weak',
    'Weak',
    'Fair',
    'Good', 
    'Strong',
    'Very Strong'
  ][strengthScore];
  
  return (
    <div className="mt-1">
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${strengthColor} transition-all duration-300`}
          style={{ width: `${(strengthScore / 5) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Password strength: <span className="font-medium">{strengthText}</span>
      </p>
    </div>
  );
};

// Password requirement component
const PasswordRequirement = ({ meets, label }: { meets: boolean; label: string }) => (
  <div className="flex items-center mt-1">
    {meets ? (
      <Check className="h-3.5 w-3.5 text-green-500 mr-2" />
    ) : (
      <AlertCircle className="h-3.5 w-3.5 text-red-500 mr-2" />
    )}
    <span className={cn('text-xs', meets ? 'text-green-600' : 'text-red-600')}>
      {label}
    </span>
  </div>
);

export default function SignupPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  
  // Get referral code and plan from URL
  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get('ref');
  const initialPlan = (urlParams.get('plan') as 'basic' | 'pro' | 'enterprise') || 'basic';
  
  // Form state
  const [formData, setFormData] = useState<SignupFormData>({
    fullName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    plan: initialPlan,
    acceptTerms: false
  });
  
  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  
  // Password requirements
  const passwordRequirements = [
    { label: 'At least 8 characters', test: (val: string) => val.length >= 8 },
    { label: 'At least one uppercase letter', test: (val: string) => /[A-Z]/.test(val) },
    { label: 'At least one lowercase letter', test: (val: string) => /[a-z]/.test(val) },
    { label: 'At least one number', test: (val: string) => /[0-9]/.test(val) },
  ];
  
  // Debounced username availability check
  useEffect(() => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        setIsCheckingUsername(true);
        const response = await apiRequest('GET', `/api/users/check-username?username=${formData.username}`);
        const data = await response.json();
        setUsernameAvailable(!data.exists);
      } catch (error) {
        setUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.username]);
  
  // Debounced email availability check
  useEffect(() => {
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setEmailAvailable(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        setIsCheckingEmail(true);
        const response = await apiRequest('GET', `/api/users/check-email?email=${encodeURIComponent(formData.email)}`);
        const data = await response.json();
        setEmailAvailable(!data.exists);
      } catch (error) {
        setEmailAvailable(null);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.email]);
  
  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  // Handle plan selection
  const handlePlanSelect = (planId: 'basic' | 'pro' | 'enterprise') => {
    setFormData(prev => ({
      ...prev,
      plan: planId
    }));
  };
  
  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (!formData.password) newErrors.password = 'Password is required';
    
    // Email format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Username format
    if (formData.username && !/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
    if (formData.username && (formData.username.length < 3 || formData.username.length > 20)) {
      newErrors.username = 'Username must be between 3 and 20 characters';
    }
    
    // Password requirements
    if (formData.password) {
      if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      } else if (!/[A-Z]/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one uppercase letter';
      } else if (!/[a-z]/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one lowercase letter';
      } else if (!/[0-9]/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one number';
      }
    }
    
    // Password confirmation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    // Terms acceptance
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions';
    }
    
    // Username and email availability
    if (formData.username && usernameAvailable === false) {
      newErrors.username = 'This username is already taken';
    }
    
    if (formData.email && emailAvailable === false) {
      newErrors.email = 'This email is already registered';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Mutation for signup
  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      const payload = {
        username: data.username,
        password: data.password,
        email: data.email,
        fullName: data.fullName,
        plan: data.plan,
        referralCode: referralCode,
      };
      
      const response = await apiRequest('POST', '/api/subscriptions/signup', payload);
      
      if (!response.ok) {
        const errorData = await response.json() as ApiError;
        throw errorData;
      }
      
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Account Created!",
        description: "Your account has been created successfully. Redirecting to dashboard...",
      });
      
      // Try to log in automatically
      try {
        await login({
          username: formData.username,
          password: formData.password
        });
        navigate('/dashboard');
      } catch (error) {
        // If auto-login fails, redirect to login page
        toast({
          title: "Login Required",
          description: "Please log in with your new credentials.",
        });
        navigate('/login');
      }
    },
    onError: (error: any) => {
      // Handle field-specific errors
      if (error.field) {
        setErrors(prev => ({
          ...prev,
          [error.field]: error.message
        }));
      } else {
        // General error
        toast({
          title: "Signup Failed",
          description: error.message || "Could not create your account. Please try again.",
          variant: "destructive",
        });
      }
    }
  });
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (validateForm()) {
      signupMutation.mutate(formData);
    } else {
      // Scroll to the first error
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };
  
  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-gradient-to-b from-neutral-100 to-white p-4 overflow-y-auto">
      <div className="w-full max-w-xl my-8">
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
        <AnimatePresence mode="wait">
          <motion.div
            key={formData.plan}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <div className="p-4 bg-primary/10 rounded-md border border-primary/20">
              <h3 className="text-base font-bold text-primary flex items-center">
                {formData.plan === 'basic' && 'Basic Plan'}
                {formData.plan === 'pro' && 'Pro Plan'}
                {formData.plan === 'enterprise' && 'Enterprise Plan'}
                {referralCode && formData.plan !== 'enterprise' && 
                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">10% OFF</span>
                }
              </h3>
              <p className="text-sm mt-1 text-neutral-600">
                {formData.plan === 'basic' && 'Perfect for single-store operations. Includes inventory management and basic analytics.'}
                {formData.plan === 'pro' && 'Ideal for growing businesses with up to 10 store locations. Enhanced analytics and AI features.'}
                {formData.plan === 'enterprise' && 'Custom solution for large operations with 10+ stores. Includes dedicated support and premium SLA.'}
              </p>
              {referralCode && formData.plan !== 'enterprise' && (
                <p className="text-xs mt-2 text-green-700">
                  Your referral code gives you 10% off for 12 months!
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    name="fullName" 
                    placeholder="John Doe" 
                    value={formData.fullName}
                    onChange={handleChange}
                    className={errors.fullName ? 'border-red-500' : ''}
                    required 
                  />
                  {errors.fullName && (
                    <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      placeholder="john@example.com" 
                      value={formData.email}
                      onChange={handleChange}
                      className={errors.email ? 'border-red-500 pr-10' : 'pr-10'}
                      required 
                    />
                    {isCheckingEmail && (
                      <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
                    )}
                    {emailAvailable === true && (
                      <Check className="h-4 w-4 absolute right-3 top-3 text-green-500" />
                    )}
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <Input 
                      id="username" 
                      name="username" 
                      placeholder="johndoe" 
                      value={formData.username}
                      onChange={handleChange}
                      className={errors.username ? 'border-red-500 pr-10' : 'pr-10'}
                      required 
                    />
                    {isCheckingUsername && (
                      <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
                    )}
                    {usernameAvailable === true && (
                      <Check className="h-4 w-4 absolute right-3 top-3 text-green-500" />
                    )}
                  </div>
                  {errors.username && (
                    <p className="text-xs text-red-500 mt-1">{errors.username}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input 
                      id="password" 
                      name="password" 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••" 
                      value={formData.password}
                      onChange={handleChange}
                      className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                      required 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                  )}
                  {formData.password && <PasswordStrengthIndicator password={formData.password} />}
                  {formData.password && (
                    <div className="mt-2 space-y-1">
                      {passwordRequirements.map((req, index) => (
                        <PasswordRequirement 
                          key={index}
                          meets={req.test(formData.password)}
                          label={req.label}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    name="confirmPassword" 
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••" 
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={errors.confirmPassword ? 'border-red-500 pr-10' : 'pr-10'}
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plan">Subscription Plan</Label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'basic', name: 'Basic', stores: '1 store', price: 'Free Trial', description: 'Perfect for single-store operations' },
                    { id: 'pro', name: 'Pro', stores: 'Up to 10 stores', price: 'Free Trial', description: 'Ideal for growing businesses' },
                    { id: 'enterprise', name: 'Enterprise', stores: '10+ stores', price: 'Custom Pricing', description: 'For large operations' },
                  ].map((plan) => (
                    <div 
                      key={plan.id}
                      onClick={() => handlePlanSelect(plan.id as 'basic' | 'pro' | 'enterprise')}
                      className={`
                        p-4 border rounded-lg cursor-pointer transition-colors
                        ${formData.plan === plan.id 
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                          : 'border-neutral-200 hover:border-primary/40'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{plan.name}</span>
                            {referralCode && plan.id !== 'enterprise' && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                10% OFF
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{plan.stores}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{plan.price}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                    </div>
                  ))}
                </div>
                {errors.plan && (
                  <p className="text-xs text-red-500 mt-1">{errors.plan}</p>
                )}
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
              
              <div className="flex items-start space-x-2 mt-4">
                <Checkbox 
                  id="acceptTerms" 
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, acceptTerms: checked === true }))
                  }
                  className={errors.acceptTerms ? 'border-red-500' : ''}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="acceptTerms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I accept the terms and conditions
                  </label>
                  <p className="text-xs text-muted-foreground">
                    By creating an account, you agree to our{" "}
                    <Link href="/terms" className="text-primary hover:underline" target="_blank">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary hover:underline" target="_blank">
                      Privacy Policy
                    </Link>.
                  </p>
                  {errors.acceptTerms && (
                    <p className="text-xs text-red-500">{errors.acceptTerms}</p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button 
                type="submit" 
                className="w-full h-11" 
                disabled={signupMutation.isPending || isCheckingUsername || isCheckingEmail}
              >
                {signupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
              
              {/* Error summary */}
              {Object.keys(errors).length > 0 && !signupMutation.isPending && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  <p className="font-medium">Please fix the following errors:</p>
                  <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                    {Object.entries(errors).map(([field, message]) => (
                      <li key={field}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-center text-sm text-neutral-500 mt-2">
                Already have an account? <Link href="/login" className="text-primary hover:underline">Log in</Link>
              </p>
              
              <div className="text-xs text-center text-neutral-400 mt-2 flex items-center justify-center">
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
