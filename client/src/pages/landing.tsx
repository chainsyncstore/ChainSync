import React from &apos;react&apos;;
import { Link } from &apos;wouter&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from &apos;@/components/ui/card&apos;;
import { Check, ShieldCheck, CreditCard, Calendar, Store, LineChart, Brain, ArrowRight, Package, Zap } from &apos;lucide-react&apos;;
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from &apos;@/components/ui/accordion&apos;;
import { formatCurrency } from &apos;@/lib/utils&apos;;
import { useCurrency } from &apos;@/providers/currency-provider&apos;;
import { CurrencySelector } from &apos;@/components/currency-selector&apos;;

export default function LandingPage() {
  const { currency } = useCurrency();

  // Define pricing constants based on the currency - using useMemo to optimize performance
  const pricingData = React.useMemo(() => {
    // Basic plan pricing
    const basic = currency === &apos;NGN&apos; ? _20000 :
                  currency === &apos;USD&apos; ? _20 :
                  currency === &apos;EUR&apos; ? _18 :
                  currency === &apos;GBP&apos; ? _16 : 20000;

    // Pro plan pricing
    const pro = currency === &apos;NGN&apos; ? _100000 :
                currency === &apos;USD&apos; ? _100 :
                currency === &apos;EUR&apos; ? _90 :
                currency === &apos;GBP&apos; ? _80 : 100000;

    // Additional stores cost
    const additionalStores = currency === &apos;NGN&apos; ? _50000 :
                            currency === &apos;USD&apos; ? _50 :
                            currency === &apos;EUR&apos; ? _45 :
                            currency === &apos;GBP&apos; ? _40 : 50000;

    return { basic, pro, additionalStores };
  }, [currency]);

  const pricingBasic = pricingData.basic;
  const pricingPro = pricingData.pro;
  const additionalStoresCost = pricingData.additionalStores;

  return (
    <div className=&quot;flex flex-col min-h-screen bg-background text-foreground w-full&quot;>
      {/* Sticky Header */}
      <header className=&quot;sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 flex h-16 items-center justify-between&quot;>
          <div className=&quot;flex items-center space-x-2&quot;>
            <svg className=&quot;w-8 h-8 text-primary&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;>
              <path d=&quot;M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z&quot; fill=&quot;currentColor&quot;/>
              <path d=&quot;M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z&quot; fill=&quot;currentColor&quot;/>
              <path d=&quot;M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z&quot; fill=&quot;currentColor&quot;/>
            </svg>
            <span className=&quot;text-xl font-bold text-foreground&quot;>ChainSync</span>
          </div>
          <div className=&quot;hidden _md:flex items-center space-x-6&quot;>
            <a href=&quot;#features&quot; className=&quot;text-sm font-medium text-muted-foreground _hover:text-primary transition-colors&quot;>Features</a>
            <a href=&quot;#pricing&quot; className=&quot;text-sm font-medium text-muted-foreground _hover:text-primary transition-colors&quot;>Pricing</a>
            <a href=&quot;#faq&quot; className=&quot;text-sm font-medium text-muted-foreground _hover:text-primary transition-colors&quot;>FAQ</a>
          </div>
          <div className=&quot;flex items-center space-x-4&quot;>
            <CurrencySelector />
            <Link href=&quot;/login&quot;>
              <Button variant=&quot;outline&quot; size=&quot;sm&quot; className=&quot;border-border&quot;>Login</Button>
            </Link>
            <Link href=&quot;/signup?plan=basic&quot;>
              <Button size=&quot;sm&quot; className=&quot;bg-primary text-primary-foreground _hover:bg-primary/90&quot;>Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className=&quot;w-full py-12 _md:py-24 _lg:py-32 bg-gradient-to-b from-background to-background/80&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl grid gap-6 px-4 _md:px-6 _lg:grid-cols-1 _lg:gap-12 _xl:gap-16&quot;>
          <div className=&quot;flex flex-col justify-center space-y-6&quot;>
            <div className=&quot;space-y-6 text-center&quot;>
              <h1 className=&quot;text-3xl font-bold tracking-tight _sm:text-4xl _md:text-5xl _lg:text-6xl&quot;>
                <span className=&quot;bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80&quot;>
                  AI-Powered Retail Management
                </span>
                <span className=&quot;block text-foreground&quot;>
                  for Single Stores & Multi-Location Chains
                </span>
              </h1>
              <p className=&quot;mx-auto max-w-2xl text-xl text-muted-foreground _md:text-2xl/relaxed&quot;>
                Try ChainSync free for 2 weeks—verify your card, no upfront payment.
              </p>
            </div>
            <div className=&quot;flex flex-col items-center gap-4 min-[400px]:flex-row justify-center&quot;>
              <Link
                href=&quot;/signup?plan=basic&quot;
                className=&quot;inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors _hover:bg-primary/90 focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2&quot;
              >
                Start Free Trial
                <ArrowRight className=&quot;ml-2 h-4 w-4&quot; />
              </Link>
              <a
                href=&quot;#features&quot;
                className=&quot;inline-flex h-12 items-center justify-center rounded-md border border-border bg-background px-8 text-sm font-medium shadow-sm transition-colors _hover:bg-accent _hover:text-accent-foreground focus-_visible:outline-none focus-_visible:ring-2 focus-_visible:ring-ring focus-_visible:ring-offset-2&quot;
              >
                Learn More
              </a>
            </div>
          </div>
          {/* Dashboard preview section removed as requested */}
        </div>
      </section>

      {/* Key Features */}
      <section id=&quot;features&quot; className=&quot;w-full py-12 _md:py-24 bg-background&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 _md:px-6&quot;>
          <div className=&quot;flex flex-col items-center space-y-4 text-center mb-16&quot;>
            <div className=&quot;inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors _focus:outline-none _focus:ring-2 _focus:ring-ring _focus:ring-offset-2 border-transparent bg-primary/10 text-primary _hover:bg-primary/20&quot;>
              Features
            </div>
            <h2 className=&quot;text-3xl font-bold tracking-tight _sm:text-4xl&quot;>
              Powerful Features for Your Business
            </h2>
            <p className=&quot;max-w-2xl text-muted-foreground text-lg&quot;>
              Everything you need to manage your retail business efficiently and effectively
            </p>
          </div>

          <div className=&quot;mx-auto grid max-w-5xl grid-cols-1 gap-6 _md:grid-cols-3 _md:gap-8&quot;>
            <div className=&quot;flex flex-col items-center space-y-4 rounded-xl border bg-card p-6 shadow-sm transition-all _hover:shadow-md&quot;>
              <div className=&quot;flex h-16 w-16 items-center justify-center rounded-full bg-primary/10&quot;>
                <LineChart className=&quot;h-8 w-8 text-primary&quot; />
              </div>
              <h3 className=&quot;text-xl font-semibold text-foreground&quot;>Multi-Store Sales Analytics</h3>
              <ul className=&quot;space-y-3 text-sm text-muted-foreground&quot;>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Real-time performance tracking</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Comparative store metrics</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Customizable reporting</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Sales forecasting</span>
                </li>
              </ul>
            </div>

            <div className=&quot;flex flex-col items-center space-y-4 rounded-xl border bg-card p-6 shadow-sm transition-all _hover:shadow-md&quot;>
              <div className=&quot;flex h-16 w-16 items-center justify-center rounded-full bg-primary/10&quot;>
                <Package className=&quot;h-8 w-8 text-primary&quot; />
              </div>
              <h3 className=&quot;text-xl font-semibold text-foreground&quot;>Smart Inventory Sync</h3>
              <ul className=&quot;space-y-3 text-sm text-muted-foreground&quot;>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Cross-location inventory visibility</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Automated reorder suggestions</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Barcode & RFID integration</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Works offline & syncs automatically</span>
                </li>
              </ul>
            </div>

            <div className=&quot;flex flex-col items-center space-y-4 rounded-xl border bg-card p-6 shadow-sm transition-all _hover:shadow-md&quot;>
              <div className=&quot;flex h-16 w-16 items-center justify-center rounded-full bg-primary/10&quot;>
                <Brain className=&quot;h-8 w-8 text-primary&quot; />
              </div>
              <h3 className=&quot;text-xl font-semibold text-foreground&quot;>AI Task Assignment</h3>
              <ul className=&quot;space-y-3 text-sm text-muted-foreground&quot;>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Intelligent staff scheduling</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Predictive task prioritization</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrink-0 text-green-500&quot; />
                  <span>Performance monitoring</span>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <Check className=&quot;mr-2 h-5 w-5 flex-shrik-0 text-green-500&quot; />
                  <span>Automated workflow optimization</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section id=&quot;pricing&quot; className=&quot;w-full py-12 _md:py-24 bg-neutral-50&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 _md:px-6&quot;>
          <div className=&quot;flex flex-col items-center justify-center space-y-4 text-center&quot;>
            <div className=&quot;space-y-2&quot;>
              <div className=&quot;inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary&quot;>
                Pricing
              </div>
              <h2 className=&quot;text-3xl font-bold tracking-tighter _md:text-4xl/tight&quot;>
                Choose the perfect plan for your business
              </h2>
              <p className=&quot;mx-auto max-w-[600px] text-neutral-500 _md:text-xl/relaxed _lg:text-base/relaxed _xl:text-xl/relaxed&quot;>
                Scale as you grow with flexible pricing options.
              </p>
            </div>
          </div>
          <div className=&quot;mx-auto grid max-w-5xl grid-cols-1 gap-6 _md:grid-cols-3 _md:gap-8 mt-12&quot;>
            <Card className=&quot;flex flex-col&quot;>
              <CardHeader>
                <CardTitle>Basic</CardTitle>
                <CardDescription>For single-store operations</CardDescription>
              </CardHeader>
              <CardContent className=&quot;flex-1&quot;>
                <div className=&quot;mt-4 flex items-baseline&quot;>
                  <span className=&quot;text-3xl font-bold&quot;>
                    {currency === &apos;NGN&apos;
                      ? `₦${pricingBasic / 1000}K`
                      : formatCurrency(pricingBasic)}
                  </span>
                  <span className=&quot;ml-1 text-neutral-500&quot;>/month</span>
                </div>
                <ul className=&quot;mt-6 space-y-4&quot;>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>1 store location</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Basic analytics dashboard</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Inventory management</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>AI assistant with basic features</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>3 user accounts</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link href=&quot;/signup?plan=basic&quot; className=&quot;w-full&quot;>
                  <Button className=&quot;w-full&quot; variant=&quot;outline&quot;>Start Free Trial</Button>
                </Link>
              </CardFooter>
            </Card>
            <Card className=&quot;flex flex-col border-primary bg-primary/5 relative&quot;>
              <div className=&quot;absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-primary px-3 py-1 text-xs font-medium text-white&quot;>
                Most Popular
              </div>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>For growing businesses</CardDescription>
              </CardHeader>
              <CardContent className=&quot;flex-1&quot;>
                <div className=&quot;mt-4 flex items-baseline&quot;>
                  <span className=&quot;text-3xl font-bold&quot;>
                    {currency === &apos;NGN&apos;
                      ? `₦${pricingPro / 1000}K`
                      : formatCurrency(pricingPro)}
                  </span>
                  <span className=&quot;ml-1 text-neutral-500&quot;>/month</span>
                </div>
                <ul className=&quot;mt-6 space-y-4&quot;>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Up to 10 store locations</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Advanced analytics & reporting</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Advanced AI with inventory optimization</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Unlimited user accounts</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Priority support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link href=&quot;/signup?plan=pro&quot; className=&quot;w-full&quot;>
                  <Button className=&quot;w-full&quot;>Start Free Trial</Button>
                </Link>
              </CardFooter>
            </Card>
            <Card className=&quot;flex flex-col&quot;>
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <CardDescription>For large-scale operations</CardDescription>
              </CardHeader>
              <CardContent className=&quot;flex-1&quot;>
                <div className=&quot;mt-4 flex items-baseline&quot;>
                  <span className=&quot;text-3xl font-bold&quot;>Custom</span>
                </div>
                <p className=&quot;mt-2 text-sm text-neutral-500&quot;>
                  10+ stores ({currency === &apos;NGN&apos;
                    ? `+₦${additionalStoresCost / 1000}K per 10 additional`
                    : `+${formatCurrency(additionalStoresCost)} per 10 additional`})
                </p>
                <ul className=&quot;mt-6 space-y-4&quot;>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Unlimited store locations</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Custom AI model training</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Dedicated account manager</span>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <Check className=&quot;mr-2 h-5 w-5 text-green-500 flex-shrink-0&quot; />
                    <span>Premium SLA</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <a href=&quot;#contact&quot; className=&quot;w-full&quot;>
                  <Button className=&quot;w-full&quot; variant=&quot;outline&quot;>Contact Sales</Button>
                </a>
              </CardFooter>
            </Card>
          </div>
          <div className=&quot;mt-8 text-center&quot;>
            <p className=&quot;flex items-center justify-center font-medium text-primary&quot;>
              <Calendar className=&quot;mr-2 h-5 w-5 text-primary&quot; />
              <span className=&quot;bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-700 font-bold&quot;>
                15% discount for annual billing
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Free Trial Section */}
      <section id=&quot;trial&quot; className=&quot;w-full py-12 _md:py-24 bg-white&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 _md:px-6&quot;>
          <div className=&quot;grid gap-6 _lg:grid-cols-2 _lg:gap-12 _xl:gap-16&quot;>
            <div className=&quot;flex flex-col justify-center space-y-4&quot;>
              <div className=&quot;space-y-2&quot;>
                <h2 className=&quot;text-3xl font-bold tracking-tighter _md:text-4xl/tight&quot;>
                  Start your 14-day free trial today
                </h2>
                <p className=&quot;text-neutral-500 _md:text-xl/relaxed _lg:text-base/relaxed _xl:text-xl/relaxed&quot;>
                  Experience the full power of ChainSync risk-free. Cancel anytime—no charges until your trial ends.
                </p>
              </div>
              <div className=&quot;space-y-2 text-neutral-600&quot;>
                <p className=&quot;font-medium&quot;>How it works:</p>
                <ol className=&quot;ml-4 space-y-4 mt-4&quot;>
                  <li className=&quot;flex items-start&quot;>
                    <div className=&quot;mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary&quot;>1</div>
                    <div>
                      <p className=&quot;font-medium&quot;>Sign up for an account</p>
                      <p className=&quot;text-sm text-neutral-500&quot;>Create your ChainSync account with basic details</p>
                    </div>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <div className=&quot;mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary&quot;>2</div>
                    <div>
                      <p className=&quot;font-medium&quot;>Verify your payment card</p>
                      <p className=&quot;text-sm text-neutral-500&quot;>Card verification only - no charges during trial</p>
                    </div>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <div className=&quot;mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary&quot;>3</div>
                    <div>
                      <p className=&quot;font-medium&quot;>Access full features for 14 days</p>
                      <p className=&quot;text-sm text-neutral-500&quot;>Explore all ChainSync has to offer</p>
                    </div>
                  </li>
                  <li className=&quot;flex items-start&quot;>
                    <div className=&quot;mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary&quot;>4</div>
                    <div>
                      <p className=&quot;font-medium&quot;>Auto-billing after trial</p>
                      <p className=&quot;text-sm text-neutral-500&quot;>Continue seamlessly or cancel anytime before trial ends</p>
                    </div>
                  </li>
                </ol>
              </div>
              <div className=&quot;flex flex-col gap-2 min-[400px]:flex-row&quot;>
                <Link href=&quot;/signup?plan=basic&quot; className=&quot;inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-white shadow transition-colors _hover:bg-primary/90 focus-_visible:outline-none focus-_visible:ring-1 focus-_visible:ring-ring&quot;>
                  Start Free Trial
                </Link>
              </div>
            </div>
            <div className=&quot;flex flex-col justify-center space-y-4&quot;>
              <Card>
                <CardHeader>
                  <CardTitle>Risk-Free Guarantee</CardTitle>
                </CardHeader>
                <CardContent className=&quot;space-y-4&quot;>
                  <div className=&quot;flex items-start space-x-3&quot;>
                    <ShieldCheck className=&quot;h-6 w-6 text-green-500 flex-shrink-0 mt-1&quot; />
                    <div>
                      <p className=&quot;font-medium&quot;>Cancel anytime</p>
                      <p className=&quot;text-sm text-neutral-500&quot;>No charges until your 14-day trial ends</p>
                    </div>
                  </div>
                  <div className=&quot;flex items-start space-x-3&quot;>
                    <CreditCard className=&quot;h-6 w-6 text-green-500 flex-shrink-0 mt-1&quot; />
                    <div>
                      <p className=&quot;font-medium&quot;>Secure card verification</p>
                      <p className=&quot;text-sm text-neutral-500&quot;>We use industry-standard encryption for all transactions</p>
                    </div>
                  </div>
                  <div className=&quot;flex items-start space-x-3&quot;>
                    <Store className=&quot;h-6 w-6 text-green-500 flex-shrink-0 mt-1&quot; />
                    <div>
                      <p className=&quot;font-medium&quot;>Full access to all features</p>
                      <p className=&quot;text-sm text-neutral-500&quot;>Try every part of ChainSync during your trial</p>
                    </div>
                  </div>
                  <div className=&quot;flex items-start space-x-3&quot;>
                    <Zap className=&quot;h-6 w-6 text-green-500 flex-shrink-0 mt-1&quot; />
                    <div>
                      <p className=&quot;font-medium&quot;>Instant setup</p>
                      <p className=&quot;text-sm text-neutral-500&quot;>Get started in minutes with guided onboarding</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className=&quot;w-full py-12 _md:py-16 bg-neutral-50&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 _md:px-6&quot;>
          <div className=&quot;flex flex-col items-center justify-center space-y-4 text-center&quot;>
            <div className=&quot;space-y-2&quot;>
              <h2 className=&quot;text-2xl font-bold tracking-tighter _md:text-3xl&quot;>
                Flexible Payment Options
              </h2>
              <p className=&quot;mx-auto max-w-[600px] text-neutral-500 _md:text-lg&quot;>
                We support multiple secure payment methods for your convenience.
              </p>
            </div>
          </div>
          <div className=&quot;mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-6 _md:grid-cols-2&quot;>
            <Card className=&quot;flex flex-col&quot;>
              <CardHeader>
                <CardTitle className=&quot;flex items-center&quot;>
                  <span>Nigeria</span>
                  <img src=&quot;https://flagcdn.com/w40/ng.png&quot; alt=&quot;Nigeria Flag&quot; className=&quot;ml-2 h-5&quot; />
                </CardTitle>
              </CardHeader>
              <CardContent className=&quot;flex-1&quot;>
                <div className=&quot;flex items-center space-x-4 mb-4&quot;>
                  <div className=&quot;h-12 w-36 rounded-md bg-white p-2 shadow-sm&quot;>
                    <div className=&quot;h-full w-full bg-neutral-100 rounded flex items-center justify-center text-primary font-bold&quot;>Paystack</div>
                  </div>
                </div>
                <ul className=&quot;space-y-2&quot;>
                  <li className=&quot;flex items-center&quot;>
                    <Check className=&quot;mr-2 h-4 w-4 text-green-500&quot; />
                    <span>Card payments</span>
                  </li>
                  <li className=&quot;flex items-center&quot;>
                    <Check className=&quot;mr-2 h-4 w-4 text-green-500&quot; />
                    <span>Bank transfers</span>
                  </li>
                  <li className=&quot;flex items-center&quot;>
                    <Check className=&quot;mr-2 h-4 w-4 text-green-500&quot; />
                    <span>USSD payments</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card className=&quot;flex flex-col&quot;>
              <CardHeader>
                <CardTitle className=&quot;flex items-center&quot;>
                  <span>Global</span>
                  <svg className=&quot;ml-2 h-5 w-5&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot;>
                    <circle cx=&quot;12&quot; cy=&quot;12&quot; r=&quot;10&quot; stroke=&quot;currentColor&quot; strokeWidth=&quot;2&quot; />
                  </svg>
                </CardTitle>
              </CardHeader>
              <CardContent className=&quot;flex-1&quot;>
                <div className=&quot;flex items-center space-x-4 mb-4&quot;>
                  <div className=&quot;h-12 w-36 rounded-md bg-white p-2 shadow-sm&quot;>
                    <div className=&quot;h-full w-full bg-neutral-100 rounded flex items-center justify-center text-primary font-bold&quot;>Flutterwave</div>
                  </div>
                </div>
                <ul className=&quot;space-y-2&quot;>
                  <li className=&quot;flex items-center&quot;>
                    <Check className=&quot;mr-2 h-4 w-4 text-green-500&quot; />
                    <span>Multi-currency support</span>
                  </li>
                  <li className=&quot;flex items-center&quot;>
                    <Check className=&quot;mr-2 h-4 w-4 text-green-500&quot; />
                    <span>International cards</span>
                  </li>
                  <li className=&quot;flex items-center&quot;>
                    <Check className=&quot;mr-2 h-4 w-4 text-green-500&quot; />
                    <span>Mobile money</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <div className=&quot;mt-8 flex flex-wrap justify-center gap-4&quot;>
            <div className=&quot;flex h-12 items-center justify-center rounded-md border bg-white px-6 shadow-sm&quot;>
              <div className=&quot;text-xs font-medium text-neutral-500&quot;>PCI DSS Compliant</div>
            </div>
            <div className=&quot;flex h-12 items-center justify-center rounded-md border bg-white px-6 shadow-sm&quot;>
              <div className=&quot;text-xs font-medium text-neutral-500&quot;>256-bit Encryption</div>
            </div>
            <div className=&quot;flex h-12 items-center justify-center rounded-md border bg-white px-6 shadow-sm&quot;>
              <div className=&quot;text-xs font-medium text-neutral-500&quot;>Secure Data Storage</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section id=&quot;faq&quot; className=&quot;w-full py-12 _md:py-24 bg-white&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 _md:px-6&quot;>
          <div className=&quot;flex flex-col items-center justify-center space-y-4 text-center&quot;>
            <div className=&quot;space-y-2&quot;>
              <div className=&quot;inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary&quot;>
                FAQs
              </div>
              <h2 className=&quot;text-3xl font-bold tracking-tighter _md:text-4xl&quot;>
                Frequently Asked Questions
              </h2>
            </div>
          </div>
          <div className=&quot;mx-auto max-w-3xl mt-8&quot;>
            <Accordion type=&quot;single&quot; collapsible className=&quot;w-full&quot;>
              <AccordionItem value=&quot;item-1&quot;>
                <AccordionTrigger>Why do you need my card details for a free trial?</AccordionTrigger>
                <AccordionContent>
                  Card verification is required to prevent trial abuse and prepare for seamless transition after your trial.
                  We only validate your card - no charges will be made until your 14-day trial period ends.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value=&quot;item-2&quot;>
                <AccordionTrigger>Can I switch plans during my subscription?</AccordionTrigger>
                <AccordionContent>
                  Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately with prorated
                  billing for the remainder of your billing cycle. Downgrades will take effect at the beginning of your next billing period.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value=&quot;item-3&quot;>
                <AccordionTrigger>How do I cancel my subscription?</AccordionTrigger>
                <AccordionContent>
                  You can cancel your subscription at any time from your account settings page. If you cancel during the 14-day
                  trial, your card will not be charged. If you cancel after the trial period, your subscription will remain active
                  until the end of your current billing cycle.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value=&quot;item-4&quot;>
                <AccordionTrigger>Does ChainSync work offline?</AccordionTrigger>
                <AccordionContent>
                  Yes, ChainSync has robust offline capabilities. You can continue processing sales, updating inventory, and accessing
                  essential data even without an internet connection. All changes will automatically sync when connectivity is restored.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value=&quot;item-5&quot;>
                <AccordionTrigger>Is my data secure?</AccordionTrigger>
                <AccordionContent>
                  Absolutely. We use industry-standard encryption protocols to protect your data. All payment processing is PCI DSS compliant,
                  and we employ advanced security measures to ensure your business information remains safe.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value=&quot;item-6&quot;>
                <AccordionTrigger>How many users can I add to my account?</AccordionTrigger>
                <AccordionContent>
                  The Basic plan includes up to 3 user accounts. The Pro plan includes unlimited user accounts with customizable
                  role-based access controls. Enterprise plans offer advanced user management features including detailed permission settings.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value=&quot;item-7&quot;>
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

      {/* Affiliate Program Section */}
      <section id=&quot;affiliate&quot; className=&quot;w-full py-12 _md:py-20 bg-neutral-50&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 _md:px-6&quot;>
          <div className=&quot;max-w-6xl mx-auto&quot;>
            <div className=&quot;flex flex-col _lg:flex-row gap-8 items-center&quot;>
              <div className=&quot;w-full _lg:w-1/2&quot;>
                <h2 className=&quot;text-3xl _md:text-4xl font-bold mb-4 text-primary&quot;>Join Our Affiliate Program</h2>
                <p className=&quot;text-lg mb-6 text-neutral-700&quot;>
                  Earn 10% commission on all referred subscriptions for 12 months, while your referrals
                  receive a 10% discount for their first year.
                </p>
                <div className=&quot;bg-white rounded-lg shadow-md p-6 mb-6 border border-neutral-200&quot;>
                  <h3 className=&quot;text-xl font-bold mb-3 text-primary&quot;>Benefits for Affiliates</h3>
                  <ul className=&quot;space-y-2&quot;>
                    <li className=&quot;flex items-start&quot;>
                      <Check className=&quot;h-5 w-5 text-green-500 mr-2 mt-0.5&quot; />
                      <span>10% commission on all referred subscriptions</span>
                    </li>
                    <li className=&quot;flex items-start&quot;>
                      <Check className=&quot;h-5 w-5 text-green-500 mr-2 mt-0.5&quot; />
                      <span>Commission paid for a full 12 months</span>
                    </li>
                    <li className=&quot;flex items-start&quot;>
                      <Check className=&quot;h-5 w-5 text-green-500 mr-2 mt-0.5&quot; />
                      <span>Dedicated affiliate dashboard</span>
                    </li>
                    <li className=&quot;flex items-start&quot;>
                      <Check className=&quot;h-5 w-5 text-green-500 mr-2 mt-0.5&quot; />
                      <span>Marketing materials and support</span>
                    </li>
                  </ul>
                </div>
                <Link href=&quot;/affiliates&quot; className=&quot;inline-flex items-center justify-center h-10 px-6 font-medium tracking-wide text-white transition duration-200 rounded shadow-md bg-primary _hover:bg-primary-600 _focus:shadow-outline _focus:outline-none&quot;>
                  Become an Affiliate
                </Link>
              </div>
              <div className=&quot;w-full _lg:w-1/2 bg-white p-8 rounded-lg shadow-lg border border-neutral-200&quot;>
                <h3 className=&quot;text-xl font-bold mb-6 text-center text-primary&quot;>Login to your Affiliate Account</h3>
                <div className=&quot;mb-4&quot;>
                  <label className=&quot;block text-sm font-medium mb-1&quot; htmlFor=&quot;affiliate-email&quot;>Email</label>
                  <input
                    type=&quot;email&quot;
                    id=&quot;affiliate-email&quot;
                    className=&quot;w-full px-3 py-2 border border-gray-300 rounded-md _focus:outline-none _focus:ring-2 _focus:ring-primary _focus:border-transparent&quot;
                    placeholder=&quot;your@email.com&quot;
                  />
                </div>
                <div className=&quot;mb-6&quot;>
                  <label className=&quot;block text-sm font-medium mb-1&quot; htmlFor=&quot;affiliate-password&quot;>Password</label>
                  <input
                    type=&quot;password&quot;
                    id=&quot;affiliate-password&quot;
                    className=&quot;w-full px-3 py-2 border border-gray-300 rounded-md _focus:outline-none _focus:ring-2 _focus:ring-primary _focus:border-transparent&quot;
                    placeholder=&quot;••••••••&quot;
                  />
                </div>
                <button className=&quot;w-full bg-primary text-white py-2 px-4 rounded-md _hover:bg-primary-600 transition-colors&quot;>
                  Sign In
                </button>
                {/* Removed &quot;Don&apos;t have an account? Sign up&quot; text */}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className=&quot;w-full py-12 _md:py-24 bg-primary text-white&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 _md:px-6&quot;>
          <div className=&quot;flex flex-col items-center justify-center space-y-4 text-center&quot;>
            <div className=&quot;space-y-2&quot;>
              <h2 className=&quot;text-3xl font-bold tracking-tighter _md:text-4xl&quot;>
                Ready to transform your retail business?
              </h2>
              <p className=&quot;mx-auto max-w-[600px] text-white/80 _md:text-xl&quot;>
                Start your 14-day free trial today and experience the power of ChainSync.
              </p>
            </div>
            <div className=&quot;flex flex-col gap-2 min-[400px]:flex-row&quot;>
              <Link href=&quot;/signup&quot; className=&quot;inline-flex h-12 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-primary shadow transition-colors _hover:bg-white/90 focus-_visible:outline-none focus-_visible:ring-1 focus-_visible:ring-white&quot;>
                Start Free Trial
                <ArrowRight className=&quot;ml-2 h-4 w-4&quot; />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className=&quot;w-full py-12 _md:py-16 border-t&quot;>
        <div className=&quot;container mx-auto max-w-screen-xl px-4 _md:px-6&quot;>
          <div className=&quot;grid grid-cols-2 gap-8 _md:grid-cols-4&quot;>
            <div className=&quot;flex flex-col space-y-4&quot;>
              <div className=&quot;flex items-center space-x-2&quot;>
                <svg className=&quot;w-6 h-6 text-primary&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;>
                  <path d=&quot;M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z&quot; fill=&quot;currentColor&quot;/>
                  <path d=&quot;M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z&quot; fill=&quot;currentColor&quot;/>
                  <path d=&quot;M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z&quot; fill=&quot;currentColor&quot;/>
                </svg>
                <span className=&quot;text-lg font-bold&quot;>ChainSync</span>
              </div>
              <p className=&quot;text-sm text-neutral-500&quot;>
                AI-powered retail management for single stores & multi-location chains.
              </p>
              <div className=&quot;flex space-x-4&quot;>
                <a href=&quot;#&quot; className=&quot;text-neutral-500 _hover:text-primary&quot;>
                  <span className=&quot;sr-only&quot;>Twitter</span>
                  <svg className=&quot;h-5 w-5&quot; fill=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot; aria-hidden=&quot;true&quot;>
                    <path d=&quot;M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84&quot; />
                  </svg>
                </a>
                <a href=&quot;#&quot; className=&quot;text-neutral-500 _hover:text-primary&quot;>
                  <span className=&quot;sr-only&quot;>LinkedIn</span>
                  <svg className=&quot;h-5 w-5&quot; fill=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot; aria-hidden=&quot;true&quot;>
                    <path d=&quot;M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z&quot; />
                  </svg>
                </a>
                <a href=&quot;#&quot; className=&quot;text-neutral-500 _hover:text-primary&quot;>
                  <span className=&quot;sr-only&quot;>Facebook</span>
                  <svg className=&quot;h-5 w-5&quot; fill=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot; aria-hidden=&quot;true&quot;>
                    <path fillRule=&quot;evenodd&quot; d=&quot;M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z&quot; clipRule=&quot;evenodd&quot; />
                  </svg>
                </a>
              </div>
            </div>
            <div className=&quot;flex flex-col space-y-4&quot;>
              <div className=&quot;text-lg font-semibold&quot;>Product</div>
              <ul className=&quot;space-y-2&quot;>
                <li>
                  <a href=&quot;#features&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Features</a>
                </li>
                <li>
                  <a href=&quot;#pricing&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Pricing</a>
                </li>
                <li>
                  <Link href=&quot;/affiliates&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Affiliate Program</Link>
                </li>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>API</a>
                </li>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Integrations</a>
                </li>
              </ul>
            </div>
            <div className=&quot;flex flex-col space-y-4&quot;>
              <div className=&quot;text-lg font-semibold&quot;>Company</div>
              <ul className=&quot;space-y-2&quot;>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>About</a>
                </li>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Blog</a>
                </li>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Careers</a>
                </li>
                <li>
                  <a href=&quot;#contact&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Contact</a>
                </li>
              </ul>
            </div>
            <div className=&quot;flex flex-col space-y-4&quot;>
              <div className=&quot;text-lg font-semibold&quot;>Legal</div>
              <ul className=&quot;space-y-2&quot;>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Terms</a>
                </li>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Privacy</a>
                </li>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Cookies</a>
                </li>
                <li>
                  <a href=&quot;#&quot; className=&quot;text-sm text-neutral-500 _hover:text-primary&quot;>Security</a>
                </li>
              </ul>
            </div>
          </div>
          <div className=&quot;mt-12 border-t pt-8 text-center text-sm text-neutral-500&quot;>
            <p>© {new Date().getFullYear()} ChainSync. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Sticky CTA */}
      <div className=&quot;sticky bottom-4 w-full hidden _sm:block z-50 pointer-events-none&quot;>
        <div className=&quot;container px-4&quot;>
          <div className=&quot;flex justify-end&quot;>
            <a href=&quot;#trial&quot; className=&quot;pointer-events-auto inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-white shadow-lg transition-colors _hover:bg-primary/90 focus-_visible:outline-none focus-_visible:ring-1 focus-_visible:ring-ring&quot;>
              Start Free Trial
              <ArrowRight className=&quot;ml-2 h-4 w-4&quot; />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
