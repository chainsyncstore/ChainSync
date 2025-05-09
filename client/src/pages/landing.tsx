import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Check, ShieldCheck, CreditCard, Calendar, Store, LineChart, BarChart, Brain, ArrowRight, Package, Database, Send, Zap } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn, formatCurrency } from '@/lib/utils';
import { useCurrency } from '@/providers/currency-provider';
import { CurrencySelector } from '@/components/currency-selector';

export default function LandingPage() {
  const { currency, currencySymbol } = useCurrency();
  
  // Define pricing constants based on the currency - using useMemo to optimize performance
  const pricingData = React.useMemo(() => {
    // Basic plan pricing 
    const basic = currency === 'NGN' ? 20000 : 
                  currency === 'USD' ? 20 : 
                  currency === 'EUR' ? 18 : 
                  currency === 'GBP' ? 16 : 20000;
    
    // Pro plan pricing
    const pro = currency === 'NGN' ? 100000 : 
                currency === 'USD' ? 100 : 
                currency === 'EUR' ? 90 : 
                currency === 'GBP' ? 80 : 100000;
    
    // Additional stores cost
    const additionalStores = currency === 'NGN' ? 50000 : 
                            currency === 'USD' ? 50 : 
                            currency === 'EUR' ? 45 : 
                            currency === 'GBP' ? 40 : 50000;
                            
    return { basic, pro, additionalStores };
  }, [currency]);
  
  const pricingBasic = pricingData.basic;
  const pricingPro = pricingData.pro;
  const additionalStoresCost = pricingData.additionalStores;
  
  return (
    <div className="flex flex-col min-h-screen bg-white w-full">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-100 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-screen-xl px-4 flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/>
              <path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/>
              <path d="M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z" fill="currentColor"/>
            </svg>
            <span className="text-xl font-bold">ChainSync</span>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-sm font-medium text-neutral-600 hover:text-primary">Features</a>
            <a href="#pricing" className="text-sm font-medium text-neutral-600 hover:text-primary">Pricing</a>
            <a href="#faq" className="text-sm font-medium text-neutral-600 hover:text-primary">FAQ</a>
          </div>
          <div className="flex items-center space-x-4">
            <CurrencySelector />
            <Link href="/login">
              <Button variant="outline" size="sm">Login</Button>
            </Link>
            <Link href="#trial">
              <Button size="sm">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-white to-neutral-50">
        <div className="container mx-auto max-w-screen-xl grid gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div className="flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-700">
                AI-Powered Retail Management for Single Stores & Multi-Location Chains
              </h1>
              <p className="text-xl text-neutral-600 md:text-2xl/relaxed">
                Try ChainSync free for 2 weeks—verify your card, no upfront payment.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <a href="#trial" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-white shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a href="#features" className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                Learn More
              </a>
            </div>
          </div>
          <div className="mx-auto flex justify-center">
            {/* Placeholder for dashboard preview - replace with actual image later */}
            <div className="w-full max-w-[600px] overflow-hidden rounded-lg border bg-white shadow-xl">
              <div className="flex h-14 items-center border-b px-4">
                <div className="flex space-x-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </div>
                <div className="ml-4 h-4 w-40 rounded-full bg-neutral-100" />
              </div>
              <div className="grid grid-cols-12 gap-4 p-4">
                <div className="col-span-3 h-[300px] rounded-md bg-neutral-100" />
                <div className="col-span-9 grid gap-4">
                  <div className="h-32 rounded-md bg-neutral-100" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-40 rounded-md bg-neutral-100" />
                    <div className="h-40 rounded-md bg-neutral-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="w-full py-12 md:py-24 bg-white">
        <div className="container mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                Features
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                Everything you need to manage your retail business
              </h2>
              <p className="mx-auto max-w-[600px] text-neutral-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                ChainSync combines powerful tools with an intuitive interface to streamline your operations.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 mt-12">
            <div className="flex flex-col items-center space-y-4 rounded-lg border p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <LineChart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Multi-Store Sales Analytics</h3>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Real-time performance tracking</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Comparative store metrics</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Customizable reporting</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Sales forecasting</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col items-center space-y-4 rounded-lg border p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Smart Inventory Sync</h3>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Cross-location inventory visibility</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Automated reorder suggestions</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Barcode & RFID integration</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Works offline & syncs automatically</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col items-center space-y-4 rounded-lg border p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">AI Task Assignment</h3>
              <ul className="space-y-2 text-sm text-neutral-500">
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Intelligent staff scheduling</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Predictive task prioritization</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Performance monitoring</span>
                </li>
                <li className="flex items-start">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Automated workflow optimization</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section id="pricing" className="w-full py-12 md:py-24 bg-neutral-50">
        <div className="container mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                Pricing
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                Choose the perfect plan for your business
              </h2>
              <p className="mx-auto max-w-[600px] text-neutral-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Scale as you grow with flexible pricing options.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 mt-12">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Basic</CardTitle>
                <CardDescription>For single-store operations</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mt-4 flex items-baseline">
                  <span className="text-3xl font-bold">
                    {currency === 'NGN' 
                      ? `₦${pricingBasic/1000}K` 
                      : formatCurrency(pricingBasic)}
                  </span>
                  <span className="ml-1 text-neutral-500">/month</span>
                </div>
                <ul className="mt-6 space-y-4">
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>1 store location</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Basic analytics dashboard</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Inventory management</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>AI assistant with basic features</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>3 user accounts</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <a href="#trial" className="w-full">
                  <Button className="w-full" variant="outline">Start Free Trial</Button>
                </a>
              </CardFooter>
            </Card>
            <Card className="flex flex-col border-primary bg-primary/5 relative">
              <div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                Most Popular
              </div>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>For growing businesses</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mt-4 flex items-baseline">
                  <span className="text-3xl font-bold">
                    {currency === 'NGN' 
                      ? `₦${pricingPro/1000}K` 
                      : formatCurrency(pricingPro)}
                  </span>
                  <span className="ml-1 text-neutral-500">/month</span>
                </div>
                <ul className="mt-6 space-y-4">
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Up to 10 store locations</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Advanced analytics & reporting</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Advanced AI with inventory optimization</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Unlimited user accounts</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <a href="#trial" className="w-full">
                  <Button className="w-full">Start Free Trial</Button>
                </a>
              </CardFooter>
            </Card>
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <CardDescription>For large-scale operations</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mt-4 flex items-baseline">
                  <span className="text-3xl font-bold">Custom</span>
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  10+ stores ({currency === 'NGN' 
                    ? `+₦${additionalStoresCost/1000}K per 10 additional` 
                    : `+${formatCurrency(additionalStoresCost)} per 10 additional`})
                </p>
                <ul className="mt-6 space-y-4">
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Unlimited store locations</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Custom AI model training</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Dedicated account manager</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mr-2 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Premium SLA</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <a href="#contact" className="w-full">
                  <Button className="w-full" variant="outline">Contact Sales</Button>
                </a>
              </CardFooter>
            </Card>
          </div>
          <div className="mt-8 text-center">
            <p className="flex items-center justify-center font-medium text-primary">
              <Calendar className="mr-2 h-5 w-5 text-primary" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-700 font-bold">
                15% discount for annual billing
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Free Trial Section */}
      <section id="trial" className="w-full py-12 md:py-24 bg-white">
        <div className="container mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 xl:gap-16">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                  Start your 14-day free trial today
                </h2>
                <p className="text-neutral-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Experience the full power of ChainSync risk-free. Cancel anytime—no charges until your trial ends.
                </p>
              </div>
              <div className="space-y-2 text-neutral-600">
                <p className="font-medium">How it works:</p>
                <ol className="ml-4 space-y-4 mt-4">
                  <li className="flex items-start">
                    <div className="mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">1</div>
                    <div>
                      <p className="font-medium">Sign up for an account</p>
                      <p className="text-sm text-neutral-500">Create your ChainSync account with basic details</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">2</div>
                    <div>
                      <p className="font-medium">Verify your payment card</p>
                      <p className="text-sm text-neutral-500">Card verification only - no charges during trial</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">3</div>
                    <div>
                      <p className="font-medium">Access full features for 14 days</p>
                      <p className="text-sm text-neutral-500">Explore all ChainSync has to offer</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">4</div>
                    <div>
                      <p className="font-medium">Auto-billing after trial</p>
                      <p className="text-sm text-neutral-500">Continue seamlessly or cancel anytime before trial ends</p>
                    </div>
                  </li>
                </ol>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href="/signup" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-white shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  Start Free Trial
                </Link>
              </div>
            </div>
            <div className="flex flex-col justify-center space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk-Free Guarantee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <ShieldCheck className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium">Cancel anytime</p>
                      <p className="text-sm text-neutral-500">No charges until your 14-day trial ends</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CreditCard className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium">Secure card verification</p>
                      <p className="text-sm text-neutral-500">We use industry-standard encryption for all transactions</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Store className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium">Full access to all features</p>
                      <p className="text-sm text-neutral-500">Try every part of ChainSync during your trial</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Zap className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium">Instant setup</p>
                      <p className="text-sm text-neutral-500">Get started in minutes with guided onboarding</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="w-full py-12 md:py-16 bg-neutral-50">
        <div className="container mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tighter md:text-3xl">
                Flexible Payment Options
              </h2>
              <p className="mx-auto max-w-[600px] text-neutral-500 md:text-lg">
                We support multiple secure payment methods for your convenience.
              </p>
            </div>
          </div>
          <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span>Nigeria</span>
                  <img src="https://flagcdn.com/w40/ng.png" alt="Nigeria Flag" className="ml-2 h-5" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="h-12 w-36 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-full w-full bg-neutral-100 rounded flex items-center justify-center text-primary font-bold">Paystack</div>
                  </div>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <span>Card payments</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <span>Bank transfers</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <span>USSD payments</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span>Global</span>
                  <svg className="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="h-12 w-36 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-full w-full bg-neutral-100 rounded flex items-center justify-center text-primary font-bold">Flutterwave</div>
                  </div>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <span>Multi-currency support</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <span>International cards</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    <span>Mobile money</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <div className="flex h-12 items-center justify-center rounded-md border bg-white px-6 shadow-sm">
              <div className="text-xs font-medium text-neutral-500">PCI DSS Compliant</div>
            </div>
            <div className="flex h-12 items-center justify-center rounded-md border bg-white px-6 shadow-sm">
              <div className="text-xs font-medium text-neutral-500">256-bit Encryption</div>
            </div>
            <div className="flex h-12 items-center justify-center rounded-md border bg-white px-6 shadow-sm">
              <div className="text-xs font-medium text-neutral-500">Secure Data Storage</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section id="faq" className="w-full py-12 md:py-24 bg-white">
        <div className="container mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                FAQs
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Frequently Asked Questions
              </h2>
            </div>
          </div>
          <div className="mx-auto max-w-3xl mt-8">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Why do you need my card details for a free trial?</AccordionTrigger>
                <AccordionContent>
                  Card verification is required to prevent trial abuse and prepare for seamless transition after your trial. 
                  We only validate your card - no charges will be made until your 14-day trial period ends.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Can I switch plans during my subscription?</AccordionTrigger>
                <AccordionContent>
                  Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately with prorated 
                  billing for the remainder of your billing cycle. Downgrades will take effect at the beginning of your next billing period.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>How do I cancel my subscription?</AccordionTrigger>
                <AccordionContent>
                  You can cancel your subscription at any time from your account settings page. If you cancel during the 14-day 
                  trial, your card will not be charged. If you cancel after the trial period, your subscription will remain active 
                  until the end of your current billing cycle.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Does ChainSync work offline?</AccordionTrigger>
                <AccordionContent>
                  Yes, ChainSync has robust offline capabilities. You can continue processing sales, updating inventory, and accessing 
                  essential data even without an internet connection. All changes will automatically sync when connectivity is restored.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>Is my data secure?</AccordionTrigger>
                <AccordionContent>
                  Absolutely. We use industry-standard encryption protocols to protect your data. All payment processing is PCI DSS compliant, 
                  and we employ advanced security measures to ensure your business information remains safe.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-6">
                <AccordionTrigger>How many users can I add to my account?</AccordionTrigger>
                <AccordionContent>
                  The Basic plan includes up to 3 user accounts. The Pro plan includes unlimited user accounts with customizable 
                  role-based access controls. Enterprise plans offer advanced user management features including detailed permission settings.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-7">
                <AccordionTrigger>Do you have an affiliate program?</AccordionTrigger>
                <AccordionContent>
                  Yes! Our affiliate program lets you earn 10% commission on all referred subscriptions for 12 months. 
                  Your referrals also receive a 10% discount for their first year. Sign up for an account and visit the 
                  Affiliate Program section to get your unique referral link and start earning.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="w-full py-12 md:py-24 bg-primary text-white">
        <div className="container mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Ready to transform your retail business?
              </h2>
              <p className="mx-auto max-w-[600px] text-white/80 md:text-xl">
                Start your 14-day free trial today and experience the power of ChainSync.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Link href="/signup" className="inline-flex h-12 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-primary shadow transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 md:py-16 border-t">
        <div className="container mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-2">
                <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/>
                  <path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/>
                  <path d="M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z" fill="currentColor"/>
                </svg>
                <span className="text-lg font-bold">ChainSync</span>
              </div>
              <p className="text-sm text-neutral-500">
                AI-powered retail management for single stores & multi-location chains.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-neutral-500 hover:text-primary">
                  <span className="sr-only">Twitter</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path>
                  </svg>
                </a>
                <a href="#" className="text-neutral-500 hover:text-primary">
                  <span className="sr-only">LinkedIn</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
                <a href="#" className="text-neutral-500 hover:text-primary">
                  <span className="sr-only">Facebook</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd"></path>
                  </svg>
                </a>
              </div>
            </div>
            <div className="flex flex-col space-y-4">
              <div className="text-lg font-semibold">Product</div>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-sm text-neutral-500 hover:text-primary">Features</a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-neutral-500 hover:text-primary">Pricing</a>
                </li>
                <li>
                  <Link href="/affiliates" className="text-sm text-neutral-500 hover:text-primary">Affiliate Program</Link>
                </li>
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">API</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">Integrations</a>
                </li>
              </ul>
            </div>
            <div className="flex flex-col space-y-4">
              <div className="text-lg font-semibold">Company</div>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">About</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">Blog</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">Careers</a>
                </li>
                <li>
                  <a href="#contact" className="text-sm text-neutral-500 hover:text-primary">Contact</a>
                </li>
              </ul>
            </div>
            <div className="flex flex-col space-y-4">
              <div className="text-lg font-semibold">Legal</div>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">Terms</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">Privacy</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">Cookies</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-neutral-500 hover:text-primary">Security</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-neutral-500">
            <p>© {new Date().getFullYear()} ChainSync. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      {/* Sticky CTA */}
      <div className="sticky bottom-4 w-full hidden sm:block z-50 pointer-events-none">
        <div className="container px-4">
          <div className="flex justify-end">
            <a href="#trial" className="pointer-events-auto inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}