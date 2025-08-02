import React, { useState } from &apos;react&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import {
  ArrowRightIcon,
  CopyIcon,
  DollarSign,
  User2Icon,
  UsersIcon,
  InfoIcon,
  Clock,
  CheckCircleIcon,
  CircleDashed,
  AlertCircleIcon,
  Building2Icon,
  RefreshCwIcon
} from &apos;lucide-react&apos;;
import { formatCurrency } from &apos;@/lib/utils&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;

interface Affiliate {
  _id: number;
  _userId: number;
  _code: string;
  _totalReferrals: number;
  _totalEarnings: string;
  _pendingEarnings: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  _paymentMethod: string;
  _createdAt: string;
  _updatedAt: string;
}

interface DashboardStats {
  _affiliate: Affiliate;
  referrals: {
    _total: number;
    _active: number;
    _pending: number;
  };
  earnings: {
    _total: string;
    _pending: string;
    lastPayment?: {
      _amount: string;
      _date: string;
    };
  };
  _clicks: number;
  _conversions: number;
}

interface Referral {
  _id: number;
  status: &apos;pending&apos; | &apos;active&apos; | &apos;completed&apos; | &apos;cancelled&apos;;
  _signupDate: string;
  activationDate?: string;
  expiryDate?: string;
  _username: string;
  _fullName: string;
}

interface Payment {
  _id: number;
  _affiliateId: number;
  _amount: string;
  _currency: string;
  status: &apos;pending&apos; | &apos;completed&apos; | &apos;failed&apos;;
  _paymentMethod: string;
  transactionReference?: string;
  paymentDate?: string;
  _createdAt: string;
}

export function AffiliateDashboard() {
  const [activeTab, setActiveTab] = useState(&apos;overview&apos;);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch affiliate data
  const {
    _data: dashboardData,
    _isLoading: isDashboardLoading,
    _error: dashboardError,
    _refetch: refetchDashboard
  } = useQuery<DashboardStats>({
    queryKey: [&apos;/api/affiliates/dashboard&apos;],
    _enabled: !!user,
    _refetchOnWindowFocus: false
  });

  // Fetch referrals
  const {
    _data: referralsData = [],
    _isLoading: isReferralsLoading
  } = useQuery<Referral[]>({
    queryKey: [&apos;/api/affiliates/referrals&apos;],
    _enabled: !!user && !!dashboardData?.affiliate && (dashboardData.affiliate.id > 0),
    _refetchOnWindowFocus: false
  });

  // Fetch payments
  const {
    _data: paymentsData = [],
    _isLoading: isPaymentsLoading
  } = useQuery<Payment[]>({
    queryKey: [&apos;/api/affiliates/payments&apos;],
    _enabled: !!user && !!dashboardData?.affiliate && (dashboardData.affiliate.id > 0),
    _refetchOnWindowFocus: false
  });

  // Register as affiliate mutation
  const registerAffiliateMutation = useMutation({
    _mutationFn: async() => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/affiliates/register&apos;, {});
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Success!&apos;,
        _description: &quot;You&apos;re now registered as an affiliate partner!&quot;
      });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/affiliates/dashboard&apos;] });
    },
    _onError: (error) => {
      toast({
        _title: &apos;Registration Failed&apos;,
        _description: &apos;Could not register you as an affiliate. Please try again.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Update bank details mutation
  const updateBankDetailsMutation = useMutation({
    _mutationFn: async(bankDetails: {
      _bankName: string;
      _accountNumber: string;
      _accountName: string;
      _bankCode: string;
      _paymentMethod: string;
    }) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/affiliates/bank-details&apos;, bankDetails);
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Bank Details Updated&apos;,
        _description: &apos;Your payment information has been updated successfully.&apos;
      });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/affiliates/dashboard&apos;] });
    },
    _onError: (error) => {
      toast({
        _title: &apos;Update Failed&apos;,
        _description: &apos;Could not update your bank details. Please try again.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Handle copy referral link
  const handleCopyReferralLink = () => {
    if (!dashboardData?.affiliate?.code) return;

    const referralLink = `${window.location.origin}/signup?ref=${dashboardData.affiliate.code}`;
    navigator.clipboard.writeText(referralLink);

    toast({
      _title: &apos;Copied!&apos;,
      _description: &apos;Referral link copied to clipboard&apos;
    });
  };

  // Submit bank details
  const handleSubmitBankDetails = (_e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    updateBankDetailsMutation.mutate({
      _bankName: formData.get(&apos;bankName&apos;) as string,
      _accountNumber: formData.get(&apos;accountNumber&apos;) as string,
      _accountName: formData.get(&apos;accountName&apos;) as string,
      _bankCode: formData.get(&apos;bankCode&apos;) as string,
      _paymentMethod: formData.get(&apos;paymentMethod&apos;) as string
    });
  };

  // If no affiliate account, show registration option
  if (!isDashboardLoading && !dashboardData && !dashboardError) {
    return (
      <Card className=&quot;w-full&quot;>
        <CardHeader>
          <CardTitle>Become an Affiliate Partner</CardTitle>
          <CardDescription>
            Earn 10% commission for every referred user for 12 months
          </CardDescription>
        </CardHeader>
        <CardContent className=&quot;space-y-4&quot;>
          <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4&quot;>
            <Card className=&quot;p-4&quot;>
              <div className=&quot;flex flex-col items-center text-center&quot;>
                <User2Icon className=&quot;h-10 w-10 text-primary mb-2&quot; />
                <h3 className=&quot;font-medium&quot;>Refer Users</h3>
                <p className=&quot;text-sm text-gray-500&quot;>Share your unique referral link with potential users</p>
              </div>
            </Card>
            <Card className=&quot;p-4&quot;>
              <div className=&quot;flex flex-col items-center text-center&quot;>
                <DollarSign className=&quot;h-10 w-10 text-primary mb-2&quot; />
                <h3 className=&quot;font-medium&quot;>Earn Commission</h3>
                <p className=&quot;text-sm text-gray-500&quot;>Earn 10% of their subscription payments for 12 months</p>
              </div>
            </Card>
            <Card className=&quot;p-4&quot;>
              <div className=&quot;flex flex-col items-center text-center&quot;>
                <Building2Icon className=&quot;h-10 w-10 text-primary mb-2&quot; />
                <h3 className=&quot;font-medium&quot;>Get Paid</h3>
                <p className=&quot;text-sm text-gray-500&quot;>Receive payments via Paystack or Flutterwave</p>
              </div>
            </Card>
          </div>

          <div className=&quot;bg-primary/5 p-4 rounded-lg border border-primary/20&quot;>
            <h3 className=&quot;font-medium flex items-center&quot;>
              <InfoIcon className=&quot;h-4 w-4 mr-2 text-primary&quot; />
              How it works
            </h3>
            <ul className=&quot;mt-2 space-y-2 text-sm&quot;>
              <li className=&quot;flex items-start&quot;>
                <ArrowRightIcon className=&quot;h-4 w-4 mr-2 mt-0.5 text-primary&quot; />
                <span>Referred users get 10% off their subscription for 12 months</span>
              </li>
              <li className=&quot;flex items-start&quot;>
                <ArrowRightIcon className=&quot;h-4 w-4 mr-2 mt-0.5 text-primary&quot; />
                <span>You earn 10% commission on their payments for 12 months</span>
              </li>
              <li className=&quot;flex items-start&quot;>
                <ArrowRightIcon className=&quot;h-4 w-4 mr-2 mt-0.5 text-primary&quot; />
                <span>Minimum payout is ₦10,000 or $10 USD</span>
              </li>
              <li className=&quot;flex items-start&quot;>
                <ArrowRightIcon className=&quot;h-4 w-4 mr-2 mt-0.5 text-primary&quot; />
                <span>Payments are processed monthly via Paystack or Flutterwave</span>
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => registerAffiliateMutation.mutate()}
            disabled={registerAffiliateMutation.isPending}
            className=&quot;w-full&quot;
          >
            {registerAffiliateMutation.isPending ? (
              <><RefreshCwIcon className=&quot;mr-2 h-4 w-4 animate-spin&quot; /> Registering...</>
            ) : (
              <>Join Affiliate Program</>
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Show error if any
  if (dashboardError) {
    return (
      <Alert variant=&quot;destructive&quot;>
        <AlertCircleIcon className=&quot;h-4 w-4&quot; />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load affiliate dashboard. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // Show loading state
  if (isDashboardLoading) {
    return (
      <div className=&quot;space-y-4&quot;>
        <Skeleton className=&quot;h-[250px] w-full rounded-lg&quot; />
        <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4&quot;>
          <Skeleton className=&quot;h-[100px] w-full rounded-lg&quot; />
          <Skeleton className=&quot;h-[100px] w-full rounded-lg&quot; />
          <Skeleton className=&quot;h-[100px] w-full rounded-lg&quot; />
        </div>
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className=&quot;space-y-6&quot;>
      <Card>
        <CardHeader>
          <div className=&quot;flex justify-between items-center&quot;>
            <div>
              <CardTitle>Affiliate Dashboard</CardTitle>
              <CardDescription>Track your referrals and earnings</CardDescription>
            </div>
            <Button variant=&quot;outline&quot; size=&quot;sm&quot; onClick={() => refetchDashboard()}>
              <RefreshCwIcon className=&quot;h-4 w-4 mr-2&quot; />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className=&quot;p-4 bg-primary/5 rounded-lg border border-primary/20 mb-6&quot;>
            <div className=&quot;flex flex-col _md:flex-row justify-between items-start _md:items-center gap-4&quot;>
              <div>
                <h3 className=&quot;font-medium&quot;>Your Referral Link</h3>
                <p className=&quot;text-sm text-muted-foreground&quot;>
                  Share this link to earn commission
                </p>
              </div>
              <div className=&quot;w-full _md:w-auto flex gap-2&quot;>
                <Input
                  readOnly
                  value={`${window.location.origin}/signup?ref=${dashboardData?.affiliate?.code}`}
                  className=&quot;bg-white font-mono text-sm&quot;
                />
                <Button
                  variant=&quot;outline&quot;
                  size=&quot;icon&quot;
                  onClick={handleCopyReferralLink}
                >
                  <CopyIcon className=&quot;h-4 w-4&quot; />
                </Button>
              </div>
            </div>
          </div>

          <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-6&quot;>
            <Card>
              <CardContent className=&quot;pt-6&quot;>
                <div className=&quot;flex justify-between items-start&quot;>
                  <div>
                    <p className=&quot;text-sm font-medium text-muted-foreground&quot;>Total Earnings</p>
                    <h3 className=&quot;text-2xl font-bold&quot;>
                      {formatCurrency(Number(dashboardData?.earnings?.total || 0))}
                    </h3>
                  </div>
                  <div className=&quot;h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center&quot;>
                    <DollarSign className=&quot;h-5 w-5 text-primary&quot; />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className=&quot;pt-6&quot;>
                <div className=&quot;flex justify-between items-start&quot;>
                  <div>
                    <p className=&quot;text-sm font-medium text-muted-foreground&quot;>Pending Earnings</p>
                    <h3 className=&quot;text-2xl font-bold&quot;>
                      {formatCurrency(Number(dashboardData?.earnings?.pending || 0))}
                    </h3>
                  </div>
                  <div className=&quot;h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center&quot;>
                    <Clock className=&quot;h-5 w-5 text-primary&quot; />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className=&quot;pt-6&quot;>
                <div className=&quot;flex justify-between items-start&quot;>
                  <div>
                    <p className=&quot;text-sm font-medium text-muted-foreground&quot;>Referred Users</p>
                    <h3 className=&quot;text-2xl font-bold&quot;>
                      {dashboardData?.referrals?.total || 0}
                    </h3>
                    <p className=&quot;text-xs text-muted-foreground mt-1&quot;>
                      {dashboardData?.referrals?.active || 0} active
                    </p>
                  </div>
                  <div className=&quot;h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center&quot;>
                    <UsersIcon className=&quot;h-5 w-5 text-primary&quot; />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue=&quot;overview&quot; value={activeTab} onValueChange={setActiveTab}>
        <TabsList className=&quot;grid w-full grid-cols-3&quot;>
          <TabsTrigger value=&quot;overview&quot;>Overview</TabsTrigger>
          <TabsTrigger value=&quot;referrals&quot;>Referrals</TabsTrigger>
          <TabsTrigger value=&quot;payments&quot;>Payments</TabsTrigger>
        </TabsList>

        <TabsContent value=&quot;overview&quot; className=&quot;space-y-4 mt-4&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Affiliate Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-4&quot;>
                <div>
                  <h3 className=&quot;font-medium text-sm mb-2&quot;>Performance</h3>
                  <div className=&quot;space-y-4&quot;>
                    <div className=&quot;flex justify-between items-center&quot;>
                      <span className=&quot;text-sm&quot;>Conversion Rate</span>
                      <span className=&quot;font-medium&quot;>
                        {dashboardData?.referrals?.total
                          ? Math.round((dashboardData?.referrals?.active / dashboardData?.referrals?.total) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className=&quot;flex justify-between items-center&quot;>
                      <span className=&quot;text-sm&quot;>Active Referrals</span>
                      <span className=&quot;font-medium&quot;>{dashboardData?.referrals?.active || 0}</span>
                    </div>
                    <div className=&quot;flex justify-between items-center&quot;>
                      <span className=&quot;text-sm&quot;>Pending Referrals</span>
                      <span className=&quot;font-medium&quot;>{dashboardData?.referrals?.pending || 0}</span>
                    </div>
                    <div className=&quot;flex justify-between items-center&quot;>
                      <span className=&quot;text-sm&quot;>Referral Code</span>
                      <span className=&quot;font-medium font-mono&quot;>{dashboardData?.affiliate?.code}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className=&quot;font-medium text-sm mb-2&quot;>Payment Details</h3>
                  {dashboardData?.affiliate?.bankName ? (
                    <div className=&quot;space-y-4&quot;>
                      <div className=&quot;flex justify-between items-center&quot;>
                        <span className=&quot;text-sm&quot;>Bank</span>
                        <span className=&quot;font-medium&quot;>{dashboardData.affiliate.bankName}</span>
                      </div>
                      <div className=&quot;flex justify-between items-center&quot;>
                        <span className=&quot;text-sm&quot;>Account Name</span>
                        <span className=&quot;font-medium&quot;>{dashboardData.affiliate.accountName}</span>
                      </div>
                      <div className=&quot;flex justify-between items-center&quot;>
                        <span className=&quot;text-sm&quot;>Account Number</span>
                        <span className=&quot;font-medium&quot;>{dashboardData.affiliate.accountNumber}</span>
                      </div>
                      <div className=&quot;flex justify-between items-center&quot;>
                        <span className=&quot;text-sm&quot;>Payment Method</span>
                        <span className=&quot;font-medium capitalize&quot;>{dashboardData.affiliate.paymentMethod}</span>
                      </div>
                    </div>
                  ) : (
                    <div className=&quot;bg-yellow-50 p-4 rounded-lg border border-yellow-200&quot;>
                      <div className=&quot;flex items-start&quot;>
                        <AlertCircleIcon className=&quot;h-5 w-5 text-yellow-500 mr-2 mt-0.5&quot; />
                        <div>
                          <h4 className=&quot;font-medium text-yellow-700&quot;>Add Payment Details</h4>
                          <p className=&quot;text-sm text-yellow-600 mt-1&quot;>
                            You need to add your bank details to receive payouts
                          </p>
                        </div>
                      </div>
                      <Button
                        className=&quot;mt-3 w-full&quot;
                        variant=&quot;outline&quot;
                        onClick={() => setActiveTab(&apos;payments&apos;)}
                      >
                        Update Payment Info
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Promotional Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className=&quot;space-y-4&quot;>
                <div className=&quot;p-3 bg-primary/5 rounded-lg&quot;>
                  <h3 className=&quot;font-medium flex items-center&quot;>
                    <ArrowRightIcon className=&quot;h-4 w-4 mr-2 text-primary&quot; />
                    Social Media Promotion
                  </h3>
                  <p className=&quot;text-sm mt-1&quot;>
                    Share your referral link on social media with a brief explanation of ChainSync and its benefits for retail stores.
                  </p>
                </div>

                <div className=&quot;p-3 bg-primary/5 rounded-lg&quot;>
                  <h3 className=&quot;font-medium flex items-center&quot;>
                    <ArrowRightIcon className=&quot;h-4 w-4 mr-2 text-primary&quot; />
                    Direct Outreach
                  </h3>
                  <p className=&quot;text-sm mt-1&quot;>
                    Reach out to store owners you know and offer them a 10% discount through your referral link.
                  </p>
                </div>

                <div className=&quot;p-3 bg-primary/5 rounded-lg&quot;>
                  <h3 className=&quot;font-medium flex items-center&quot;>
                    <ArrowRightIcon className=&quot;h-4 w-4 mr-2 text-primary&quot; />
                    Blog or Website
                  </h3>
                  <p className=&quot;text-sm mt-1&quot;>
                    If you have a blog or website, create content about retail management and include your affiliate link.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value=&quot;referrals&quot; className=&quot;mt-4&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Referrals</CardTitle>
              <CardDescription>
                Track all your referred users and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isReferralsLoading ? (
                <div className=&quot;space-y-2&quot;>
                  <Skeleton className=&quot;h-12 w-full&quot; />
                  <Skeleton className=&quot;h-12 w-full&quot; />
                  <Skeleton className=&quot;h-12 w-full&quot; />
                </div>
              ) : referralsData.length === 0 ? (
                <div className=&quot;text-center py-8&quot;>
                  <UsersIcon className=&quot;h-10 w-10 text-muted-foreground/50 mx-auto mb-3&quot; />
                  <h3 className=&quot;font-medium text-muted-foreground&quot;>No referrals yet</h3>
                  <p className=&quot;text-sm text-muted-foreground/70 mt-1&quot;>
                    Share your referral link to start earning commissions
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sign Up Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralsData.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          <div className=&quot;font-medium&quot;>{referral.fullName}</div>
                          <div className=&quot;text-sm text-muted-foreground&quot;>{referral.username}</div>
                        </TableCell>
                        <TableCell>
                          {referral.status === &apos;active&apos; && (
                            <div className=&quot;flex items-center text-green-600&quot;>
                              <CheckCircleIcon className=&quot;h-4 w-4 mr-1&quot; />
                              <span>Active</span>
                            </div>
                          )}
                          {referral.status === &apos;pending&apos; && (
                            <div className=&quot;flex items-center text-yellow-600&quot;>
                              <CircleDashed className=&quot;h-4 w-4 mr-1&quot; />
                              <span>Pending</span>
                            </div>
                          )}
                          {referral.status === &apos;completed&apos; && (
                            <div className=&quot;flex items-center text-blue-600&quot;>
                              <CheckCircleIcon className=&quot;h-4 w-4 mr-1&quot; />
                              <span>Completed</span>
                            </div>
                          )}
                          {referral.status === &apos;cancelled&apos; && (
                            <div className=&quot;flex items-center text-red-600&quot;>
                              <AlertCircleIcon className=&quot;h-4 w-4 mr-1&quot; />
                              <span>Cancelled</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(referral.signupDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {referral.expiryDate
                            ? new Date(referral.expiryDate).toLocaleDateString()
                            : &apos;-&apos;}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value=&quot;payments&quot; className=&quot;space-y-4 mt-4&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
              <CardDescription>
                Update your payment information to receive commissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitBankDetails} className=&quot;space-y-4&quot;>
                <div className=&quot;space-y-1&quot;>
                  <Label htmlFor=&quot;paymentMethod&quot;>Payment Method</Label>
                  <select
                    id=&quot;paymentMethod&quot;
                    name=&quot;paymentMethod&quot;
                    className=&quot;w-full p-2 border rounded-md&quot;
                    defaultValue={dashboardData?.affiliate?.paymentMethod || &apos;paystack&apos;}
                  >
                    <option value=&quot;paystack&quot;>Paystack (Nigeria)</option>
                    <option value=&quot;flutterwave&quot;>Flutterwave (International)</option>
                  </select>
                </div>

                <div className=&quot;space-y-1&quot;>
                  <Label htmlFor=&quot;bankName&quot;>Bank Name</Label>
                  <Input
                    id=&quot;bankName&quot;
                    name=&quot;bankName&quot;
                    placeholder=&quot;e.g., First Bank&quot;
                    defaultValue={dashboardData?.affiliate?.bankName || &apos;&apos;}
                    required
                  />
                </div>

                <div className=&quot;space-y-1&quot;>
                  <Label htmlFor=&quot;accountName&quot;>Account Name</Label>
                  <Input
                    id=&quot;accountName&quot;
                    name=&quot;accountName&quot;
                    placeholder=&quot;e.g., John Doe&quot;
                    defaultValue={dashboardData?.affiliate?.accountName || &apos;&apos;}
                    required
                  />
                </div>

                <div className=&quot;space-y-1&quot;>
                  <Label htmlFor=&quot;accountNumber&quot;>Account Number</Label>
                  <Input
                    id=&quot;accountNumber&quot;
                    name=&quot;accountNumber&quot;
                    placeholder=&quot;e.g., 1234567890&quot;
                    defaultValue={dashboardData?.affiliate?.accountNumber || &apos;&apos;}
                    required
                  />
                </div>

                <div className=&quot;space-y-1&quot;>
                  <Label htmlFor=&quot;bankCode&quot;>Bank Code</Label>
                  <Input
                    id=&quot;bankCode&quot;
                    name=&quot;bankCode&quot;
                    placeholder=&quot;e.g., 044 for First Bank&quot;
                    defaultValue={dashboardData?.affiliate?.bankCode || &apos;&apos;}
                    required
                  />
                  <p className=&quot;text-xs text-muted-foreground mt-1&quot;>
                    Find bank codes for Nigeria on <a href=&quot;https://developer.paystack.co/reference/list-banks&quot; target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot; className=&quot;text-primary _hover:underline&quot;>Paystack&apos;s documentation</a>
                    or <a href=&quot;https://developer.flutterwave.com/reference/get-all-banks&quot; target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot; className=&quot;text-primary _hover:underline&quot;>Flutterwave&apos;s documentation</a>
                  </p>
                </div>

                <Alert>
                  <InfoIcon className=&quot;h-4 w-4&quot; />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    Ensure your bank details are correct. Incorrect details may delay your payments.
                  </AlertDescription>
                </Alert>

                <Button
                  type=&quot;submit&quot;
                  className=&quot;w-full&quot;
                  disabled={updateBankDetailsMutation.isPending}
                >
                  {updateBankDetailsMutation.isPending ? (
                    <><RefreshCwIcon className=&quot;mr-2 h-4 w-4 animate-spin&quot; /> Updating...</>
                  ) : (
                    <>Save Payment Information</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                View your commission payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPaymentsLoading ? (
                <div className=&quot;space-y-2&quot;>
                  <Skeleton className=&quot;h-12 w-full&quot; />
                  <Skeleton className=&quot;h-12 w-full&quot; />
                  <Skeleton className=&quot;h-12 w-full&quot; />
                </div>
              ) : paymentsData.length === 0 ? (
                <div className=&quot;text-center py-8&quot;>
                  <DollarSign className=&quot;h-10 w-10 text-muted-foreground/50 mx-auto mb-3&quot; />
                  <h3 className=&quot;font-medium text-muted-foreground&quot;>No payments yet</h3>
                  <p className=&quot;text-sm text-muted-foreground/70 mt-1&quot;>
                    Payments require minimum earnings of ₦10,000 or $10 USD
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsData.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {payment.paymentDate
                            ? new Date(payment.paymentDate).toLocaleDateString()
                            : new Date(payment.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(Number(payment.amount), payment.currency as any)}
                        </TableCell>
                        <TableCell className=&quot;capitalize&quot;>
                          {payment.paymentMethod}
                        </TableCell>
                        <TableCell>
                          {payment.status === &apos;completed&apos; && (
                            <div className=&quot;flex items-center text-green-600&quot;>
                              <CheckCircleIcon className=&quot;h-4 w-4 mr-1&quot; />
                              <span>Completed</span>
                            </div>
                          )}
                          {payment.status === &apos;pending&apos; && (
                            <div className=&quot;flex items-center text-yellow-600&quot;>
                              <CircleDashed className=&quot;h-4 w-4 mr-1&quot; />
                              <span>Pending</span>
                            </div>
                          )}
                          {payment.status === &apos;failed&apos; && (
                            <div className=&quot;flex items-center text-red-600&quot;>
                              <AlertCircleIcon className=&quot;h-4 w-4 mr-1&quot; />
                              <span>Failed</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
