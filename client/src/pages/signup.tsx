import React, { useState, useEffect } from &apos;react&apos;;
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Checkbox } from &apos;@/components/ui/checkbox&apos;;
import { Link, useLocation } from &apos;wouter&apos;;
import { ArrowLeft, CreditCard, LockIcon, Eye, EyeOff, AlertCircle, Check, Loader2 } from &apos;lucide-react&apos;;
import { ReferralBanner } from &apos;@/components/affiliate/referral-banner&apos;;
import { useMutation } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { motion, AnimatePresence } from &apos;framer-motion&apos;;
import { cn } from &apos;@/lib/utils&apos;;

// Define types for form data
interface SignupFormData {
  _fullName: string;
  _email: string;
  _username: string;
  _password: string;
  _confirmPassword: string;
  plan: &apos;basic&apos; | &apos;pro&apos; | &apos;enterprise&apos;;
  _acceptTerms: boolean;
}

// Error response type
interface ApiError {
  _message: string;
  field?: string;
}

// Password strength indicator component
const PasswordStrengthIndicator = ({ password }: { _password: string }) => {
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
    &apos;bg-red-500&apos;,           // _0: Very Weak
    &apos;bg-red-500&apos;,           // _1: Weak
    &apos;bg-yellow-500&apos;,        // _2: Fair
    &apos;bg-yellow-400&apos;,        // _3: Good
    &apos;bg-green-500&apos;,         // _4: Strong
    &apos;bg-green-600&apos;          // _5: Very Strong
  ][strengthScore];

  const strengthText = [
    &apos;Very Weak&apos;,
    &apos;Weak&apos;,
    &apos;Fair&apos;,
    &apos;Good&apos;,
    &apos;Strong&apos;,
    &apos;Very Strong&apos;
  ][strengthScore];

  return (
    <div className=&quot;mt-1&quot;>
      <div className=&quot;h-1.5 w-full bg-gray-200 rounded-full overflow-hidden&quot;>
        <div
          className={`h-full ${strengthColor} transition-all duration-300`}
          style={{ _width: `${(strengthScore / 5) * 100}%` }}
        />
      </div>
      <p className=&quot;text-xs text-muted-foreground mt-1&quot;>
        Password _strength: <span className=&quot;font-medium&quot;>{strengthText}</span>
      </p>
    </div>
  );
};

// Password requirement component
const PasswordRequirement = ({ meets, label }: { _meets: boolean; _label: string }) => (
  <div className=&quot;flex items-center mt-1&quot;>
    {meets ? (
      <Check className=&quot;h-3.5 w-3.5 text-green-500 mr-2&quot; />
    ) : (
      <AlertCircle className=&quot;h-3.5 w-3.5 text-red-500 mr-2&quot; />
    )}
    <span className={cn(&apos;text-xs&apos;, meets ? &apos;text-green-600&apos; : &apos;text-red-600&apos;)}>
      {label}
    </span>
  </div>
);

export default function SignupPage() {
  const [, navigate] = useLocation(); // location was unused
  const { toast } = useToast();
  const { login } = useAuth();

  // Get referral code and plan from URL
  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get(&apos;ref&apos;);
  const initialPlan = (urlParams.get(&apos;plan&apos;) as &apos;basic&apos; | &apos;pro&apos; | &apos;enterprise&apos;) || &apos;basic&apos;;

  // Form state
  const [formData, setFormData] = useState<SignupFormData>({
    _fullName: &apos;&apos;,
    _email: &apos;&apos;,
    _username: &apos;&apos;,
    _password: &apos;&apos;,
    _confirmPassword: &apos;&apos;,
    _plan: initialPlan,
    _acceptTerms: false
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
    { _label: &apos;At least 8 characters&apos;, _test: (_val: string) => val.length >= 8 },
    { _label: &apos;At least one uppercase letter&apos;, _test: (_val: string) => /[A-Z]/.test(val) },
    { _label: &apos;At least one lowercase letter&apos;, _test: (_val: string) => /[a-z]/.test(val) },
    { _label: &apos;At least one number&apos;, _test: (_val: string) => /[0-9]/.test(val) }
  ];

  // Debounced username availability check
  useEffect(() => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async() => {
      try {
        setIsCheckingUsername(true);
        const response = await apiRequest(&apos;GET&apos;, `/api/users/check-username?username=${formData.username}`);
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

    const timer = setTimeout(async() => {
      try {
        setIsCheckingEmail(true);
        const response = await apiRequest(&apos;GET&apos;, `/api/users/check-email?email=${encodeURIComponent(formData.email)}`);
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
  const handleChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === &apos;checkbox&apos; ? _checked : value
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
  const handlePlanSelect = (planId: &apos;basic&apos; | &apos;pro&apos; | &apos;enterprise&apos;) => {
    setFormData(prev => ({
      ...prev,
      _plan: planId
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const _newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.fullName.trim()) newErrors.fullName = &apos;Full name is required&apos;;
    if (!formData.email.trim()) newErrors.email = &apos;Email is required&apos;;
    if (!formData.username.trim()) newErrors.username = &apos;Username is required&apos;;
    if (!formData.password) newErrors.password = &apos;Password is required&apos;;

    // Email format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = &apos;Please enter a valid email address&apos;;
    }

    // Username format
    if (formData.username && !/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = &apos;Username can only contain letters, numbers, and underscores&apos;;
    }

    if (formData.username && (formData.username.length < 3 || formData.username.length > 20)) {
      newErrors.username = &apos;Username must be between 3 and 20 characters&apos;;
    }

    // Password requirements
    if (formData.password) {
      if (formData.password.length < 8) {
        newErrors.password = &apos;Password must be at least 8 characters&apos;;
      } else if (!/[A-Z]/.test(formData.password)) {
        newErrors.password = &apos;Password must contain at least one uppercase letter&apos;;
      } else if (!/[a-z]/.test(formData.password)) {
        newErrors.password = &apos;Password must contain at least one lowercase letter&apos;;
      } else if (!/[0-9]/.test(formData.password)) {
        newErrors.password = &apos;Password must contain at least one number&apos;;
      }
    }

    // Password confirmation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = &apos;Passwords do not match&apos;;
    }

    // Terms acceptance
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = &apos;You must accept the terms and conditions&apos;;
    }

    // Username and email availability
    if (formData.username && usernameAvailable === false) {
      newErrors.username = &apos;This username is already taken&apos;;
    }

    if (formData.email && emailAvailable === false) {
      newErrors.email = &apos;This email is already registered&apos;;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Mutation for signup
  const signupMutation = useMutation({
    _mutationFn: async(_data: SignupFormData) => {
      const payload = {
        _username: data.username,
        _password: data.password,
        _email: data.email,
        _fullName: data.fullName,
        _plan: data.plan,
        _referralCode: referralCode
      };

      const response = await apiRequest(&apos;POST&apos;, &apos;/api/subscriptions/signup&apos;, payload);

      if (!response.ok) {
        const errorData = await response.json() as ApiError;
        throw errorData;
      }

      return response.json();
    },
    _onSuccess: async() => { // data parameter removed
      toast({
        _title: &apos;Account Created!&apos;,
        _description: &apos;Your account has been created successfully. Redirecting to dashboard...&apos;
      });

      // Try to log in automatically
      try {
        await login({
          _username: formData.username,
          _password: formData.password
        });
        navigate(&apos;/dashboard&apos;);
      } catch (error) {
        // If auto-login fails, redirect to login page
        toast({
          _title: &apos;Login Required&apos;,
          _description: &apos;Please log in with your new credentials.&apos;
        });
        navigate(&apos;/login&apos;);
      }
    },
    _onError: (_error: ApiError) => {
      // Handle field-specific errors
      if (error.field && typeof error.field === &apos;string&apos;) { // Ensure error.field is a string
        setErrors(prev => ({
          ...prev,
          [error.field as string]: error.message
        }));
      } else {
        // General error
        toast({
          _title: &apos;Signup Failed&apos;,
          _description: error.message || &apos;Could not create your account. Please try again.&apos;,
          _variant: &apos;destructive&apos;
        });
      }
    }
  });

  const handleSubmit = (_e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (validateForm()) {
      signupMutation.mutate(formData);
    } else {
      // Scroll to the first error
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField);
        if (element) element.scrollIntoView({ _behavior: &apos;smooth&apos;, _block: &apos;center&apos; });
      }
    }
  };

  return (
    <div className=&quot;min-h-screen w-full flex flex-col items-center bg-gradient-to-b from-neutral-100 to-white p-4 overflow-y-auto&quot;>
      <div className=&quot;w-full max-w-xl my-8&quot;>
        {/* Back to Home Link */}
        <div className=&quot;mb-6&quot;>
          <Link href=&quot;/&quot; className=&quot;text-sm font-medium text-neutral-500 _hover:text-neutral-800 flex items-center&quot;>
            <ArrowLeft className=&quot;h-4 w-4 mr-1&quot; />
            Back to Home
          </Link>
        </div>

        {/* Logo and Title */}
        <div className=&quot;mb-6 text-center&quot;>
          <h1 className=&quot;text-3xl font-bold text-neutral-800&quot;>
            Create Your ChainSync Account
          </h1>
          <p className=&quot;text-neutral-500 mt-2&quot;>
            Start managing your retail business more efficiently
          </p>
        </div>

        {/* Referral Banner */}
        <ReferralBanner />

        {/* Selected Plan Banner */}
        <AnimatePresence mode=&quot;wait&quot;>
          <motion.div
            key={formData.plan}
            initial={{ _opacity: 0, _y: 10 }}
            animate={{ _opacity: 1, _y: 0 }}
            exit={{ _opacity: 0, _y: -10 }}
            transition={{ _duration: 0.3 }}
            className=&quot;mb-4&quot;
          >
            <div className=&quot;p-4 bg-primary/10 rounded-md border border-primary/20&quot;>
              <h3 className=&quot;text-base font-bold text-primary flex items-center&quot;>
                {formData.plan === &apos;basic&apos; && &apos;Basic Plan&apos;}
                {formData.plan === &apos;pro&apos; && &apos;Pro Plan&apos;}
                {formData.plan === &apos;enterprise&apos; && &apos;Enterprise Plan&apos;}
                {referralCode && formData.plan !== &apos;enterprise&apos; &&
                  <span className=&quot;ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full&quot;>10% OFF</span>
                }
              </h3>
              <p className=&quot;text-sm mt-1 text-neutral-600&quot;>
                {formData.plan === &apos;basic&apos; && &apos;Perfect for single-store operations. Includes inventory management and basic analytics.&apos;}
                {formData.plan === &apos;pro&apos; && &apos;Ideal for growing businesses with up to 10 store locations. Enhanced analytics and AI features.&apos;}
                {formData.plan === &apos;enterprise&apos; && &apos;Custom solution for large operations with 10+ stores. Includes dedicated support and premium SLA.&apos;}
              </p>
              {referralCode && formData.plan !== &apos;enterprise&apos; && (
                <p className=&quot;text-xs mt-2 text-green-700&quot;>
                  Your referral code gives you 10% off for 12 months!
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Signup Form */}
        <Card className=&quot;w-full&quot;>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Enter your details to create an account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className=&quot;space-y-4&quot;>
              <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-4&quot;>
                <div className=&quot;space-y-2&quot;>
                  <Label htmlFor=&quot;fullName&quot;>Full Name</Label>
                  <Input
                    id=&quot;fullName&quot;
                    name=&quot;fullName&quot;
                    placeholder=&quot;John Doe&quot;
                    value={formData.fullName}
                    onChange={handleChange}
                    className={errors.fullName ? &apos;border-red-500&apos; : &apos;&apos;}
                    required
                  />
                  {errors.fullName && (
                    <p className=&quot;text-xs text-red-500 mt-1&quot;>{errors.fullName}</p>
                  )}
                </div>
                <div className=&quot;space-y-2&quot;>
                  <Label htmlFor=&quot;email&quot;>Email</Label>
                  <div className=&quot;relative&quot;>
                    <Input
                      id=&quot;email&quot;
                      name=&quot;email&quot;
                      type=&quot;email&quot;
                      placeholder=&quot;john@example.com&quot;
                      value={formData.email}
                      onChange={handleChange}
                      className={errors.email ? &apos;border-red-500 pr-10&apos; : &apos;pr-10&apos;}
                      required
                    />
                    {isCheckingEmail && (
                      <Loader2 className=&quot;h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground&quot; />
                    )}
                    {emailAvailable === true && (
                      <Check className=&quot;h-4 w-4 absolute right-3 top-3 text-green-500&quot; />
                    )}
                  </div>
                  {errors.email && (
                    <p className=&quot;text-xs text-red-500 mt-1&quot;>{errors.email}</p>
                  )}
                </div>
              </div>

              <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-4&quot;>
                <div className=&quot;space-y-2&quot;>
                  <Label htmlFor=&quot;username&quot;>Username</Label>
                  <div className=&quot;relative&quot;>
                    <Input
                      id=&quot;username&quot;
                      name=&quot;username&quot;
                      placeholder=&quot;johndoe&quot;
                      value={formData.username}
                      onChange={handleChange}
                      className={errors.username ? &apos;border-red-500 pr-10&apos; : &apos;pr-10&apos;}
                      required
                    />
                    {isCheckingUsername && (
                      <Loader2 className=&quot;h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground&quot; />
                    )}
                    {usernameAvailable === true && (
                      <Check className=&quot;h-4 w-4 absolute right-3 top-3 text-green-500&quot; />
                    )}
                  </div>
                  {errors.username && (
                    <p className=&quot;text-xs text-red-500 mt-1&quot;>{errors.username}</p>
                  )}
                </div>
                <div className=&quot;space-y-2&quot;>
                  <Label htmlFor=&quot;password&quot;>Password</Label>
                  <div className=&quot;relative&quot;>
                    <Input
                      id=&quot;password&quot;
                      name=&quot;password&quot;
                      type={showPassword ? &apos;text&apos; : &apos;password&apos;}
                      placeholder=&quot;••••••••&quot;
                      value={formData.password}
                      onChange={handleChange}
                      className={errors.password ? &apos;border-red-500 pr-10&apos; : &apos;pr-10&apos;}
                      required
                    />
                    <button
                      type=&quot;button&quot;
                      onClick={() => setShowPassword(!showPassword)}
                      className=&quot;absolute right-3 top-3 text-muted-foreground _hover:text-foreground&quot;
                    >
                      {showPassword ? <EyeOff className=&quot;h-4 w-4&quot; /> : <Eye className=&quot;h-4 w-4&quot; />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className=&quot;text-xs text-red-500 mt-1&quot;>{errors.password}</p>
                  )}
                  {formData.password && <PasswordStrengthIndicator password={formData.password} />}
                  {formData.password && (
                    <div className=&quot;mt-2 space-y-1&quot;>
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

              <div className=&quot;space-y-2&quot;>
                <Label htmlFor=&quot;confirmPassword&quot;>Confirm Password</Label>
                <div className=&quot;relative&quot;>
                  <Input
                    id=&quot;confirmPassword&quot;
                    name=&quot;confirmPassword&quot;
                    type={showConfirmPassword ? &apos;text&apos; : &apos;password&apos;}
                    placeholder=&quot;••••••••&quot;
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={errors.confirmPassword ? &apos;border-red-500 pr-10&apos; : &apos;pr-10&apos;}
                    required
                  />
                  <button
                    type=&quot;button&quot;
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className=&quot;absolute right-3 top-3 text-muted-foreground _hover:text-foreground&quot;
                  >
                    {showConfirmPassword ? <EyeOff className=&quot;h-4 w-4&quot; /> : <Eye className=&quot;h-4 w-4&quot; />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className=&quot;text-xs text-red-500 mt-1&quot;>{errors.confirmPassword}</p>
                )}
              </div>

              <div className=&quot;space-y-2&quot;>
                <Label htmlFor=&quot;plan&quot;>Subscription Plan</Label>
                <div className=&quot;grid grid-cols-1 gap-2&quot;>
                  {[
                    { _id: &apos;basic&apos;, _name: &apos;Basic&apos;, _stores: &apos;1 store&apos;, _price: &apos;Free Trial&apos;, _description: &apos;Perfect for single-store operations&apos; },
                    { _id: &apos;pro&apos;, _name: &apos;Pro&apos;, _stores: &apos;Up to 10 stores&apos;, _price: &apos;Free Trial&apos;, _description: &apos;Ideal for growing businesses&apos; },
                    { _id: &apos;enterprise&apos;, _name: &apos;Enterprise&apos;, _stores: &apos;10+ stores&apos;, _price: &apos;Custom Pricing&apos;, _description: &apos;For large operations&apos; }
                  ].map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => handlePlanSelect(plan.id as &apos;basic&apos; | &apos;pro&apos; | &apos;enterprise&apos;)}
                      className={`
                        p-4 border rounded-lg cursor-pointer transition-colors
                        ${formData.plan === plan.id
                          ? &apos;border-primary bg-primary/5 ring-2 ring-primary/20&apos;
                          : &apos;border-neutral-200 _hover:border-primary/40&apos;}
                      `}
                    >
                      <div className=&quot;flex items-center justify-between&quot;>
                        <div>
                          <div className=&quot;flex items-center space-x-2&quot;>
                            <span className=&quot;font-medium&quot;>{plan.name}</span>
                            {referralCode && plan.id !== &apos;enterprise&apos; && (
                              <span className=&quot;text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full&quot;>
                                10% OFF
                              </span>
                            )}
                          </div>
                          <p className=&quot;text-sm text-muted-foreground&quot;>{plan.stores}</p>
                        </div>
                        <div className=&quot;text-right&quot;>
                          <span className=&quot;font-medium&quot;>{plan.price}</span>
                        </div>
                      </div>
                      <p className=&quot;text-xs text-muted-foreground mt-1&quot;>{plan.description}</p>
                    </div>
                  ))}
                </div>
                {errors.plan && (
                  <p className=&quot;text-xs text-red-500 mt-1&quot;>{errors.plan}</p>
                )}
              </div>

              <div className=&quot;bg-neutral-50 p-3 rounded-md border border-neutral-200 flex items-start&quot;>
                <LockIcon className=&quot;h-5 w-5 text-green-600 mr-2 mt-0.5&quot; />
                <div>
                  <h3 className=&quot;text-sm font-medium&quot;>14-Day Free Trial</h3>
                  <p className=&quot;text-xs text-neutral-500 mt-0.5&quot;>
                    No payment required during the trial period. Cancel anytime.
                  </p>
                </div>
              </div>

              <div className=&quot;flex items-start space-x-2 mt-4&quot;>
                <Checkbox
                  id=&quot;acceptTerms&quot;
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, _acceptTerms: checked === true }))
                  }
                  className={errors.acceptTerms ? &apos;border-red-500&apos; : &apos;&apos;}
                />
                <div className=&quot;grid gap-1.5 leading-none&quot;>
                  <label
                    htmlFor=&quot;acceptTerms&quot;
                    className=&quot;text-sm font-medium leading-none peer-_disabled:cursor-not-allowed peer-_disabled:opacity-70&quot;
                  >
                    I accept the terms and conditions
                  </label>
                  <p className=&quot;text-xs text-muted-foreground&quot;>
                    By creating an account, you agree to our{&apos; &apos;}
                    <Link href=&quot;/terms&quot; className=&quot;text-primary _hover:underline&quot; target=&quot;_blank&quot;>
                      Terms of Service
                    </Link>{&apos; &apos;}
                    and{&apos; &apos;}
                    <Link href=&quot;/privacy&quot; className=&quot;text-primary _hover:underline&quot; target=&quot;_blank&quot;>
                      Privacy Policy
                    </Link>.
                  </p>
                  {errors.acceptTerms && (
                    <p className=&quot;text-xs text-red-500&quot;>{errors.acceptTerms}</p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className=&quot;flex flex-col space-y-3&quot;>
              <Button
                type=&quot;submit&quot;
                className=&quot;w-full h-11&quot;
                disabled={signupMutation.isPending || isCheckingUsername || isCheckingEmail}
              >
                {signupMutation.isPending ? (
                  <>
                    <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                    Creating Account...
                  </>
                ) : (
                  &apos;Create Account&apos;
                )}
              </Button>

              {/* Error summary */}
              {Object.keys(errors).length > 0 && !signupMutation.isPending && (
                <div className=&quot;p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700&quot;>
                  <p className=&quot;font-medium&quot;>Please fix the following _errors:</p>
                  <ul className=&quot;list-disc list-inside text-xs mt-1 space-y-1&quot;>
                    {Object.entries(errors).map(([field, message]) => (
                      <li key={field}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className=&quot;text-center text-sm text-neutral-500 mt-2&quot;>
                Already have an account? <Link href=&quot;/login&quot; className=&quot;text-primary _hover:underline&quot;>Log in</Link>
              </p>

              <div className=&quot;text-xs text-center text-neutral-400 mt-2 flex items-center justify-center&quot;>
                <CreditCard className=&quot;h-3 w-3 mr-1&quot; />
                Secure payment powered by Paystack/Flutterwave
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
