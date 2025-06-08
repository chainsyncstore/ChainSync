import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  RefreshCwIcon,
} from 'lucide-react';
import React, { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

interface Affiliate {
  id: number;
  userId: number;
  code: string;
  totalReferrals: number;
  totalEarnings: string;
  pendingEarnings: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  affiliate: Affiliate;
  referrals: {
    total: number;
    active: number;
    pending: number;
  };
  earnings: {
    total: string;
    pending: string;
    lastPayment?: {
      amount: string;
      date: string;
    };
  };
  clicks: number;
  conversions: number;
}

interface Referral {
  id: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  signupDate: string;
  activationDate?: string;
  expiryDate?: string;
  username: string;
  fullName: string;
}

interface Payment {
  id: number;
  affiliateId: number;
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  paymentMethod: string;
  transactionReference?: string;
  paymentDate?: string;
  createdAt: string;
}

export function AffiliateDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch affiliate data
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery<DashboardStats>({
    queryKey: ['/api/affiliates/dashboard'],
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  // Fetch referrals
  const { data: referralsData = [], isLoading: isReferralsLoading } = useQuery<Referral[]>({
    queryKey: ['/api/affiliates/referrals'],
    enabled: !!user && !!dashboardData?.affiliate && dashboardData.affiliate.id > 0,
    refetchOnWindowFocus: false,
  });

  // Fetch payments
  const { data: paymentsData = [], isLoading: isPaymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/affiliates/payments'],
    enabled: !!user && !!dashboardData?.affiliate && dashboardData.affiliate.id > 0,
    refetchOnWindowFocus: false,
  });

  // Register as affiliate mutation
  const registerAffiliateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/affiliates/register', {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success!',
        description: "You're now registered as an affiliate partner!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliates/dashboard'] });
    },
    onError: error => {
      toast({
        title: 'Registration Failed',
        description: 'Could not register you as an affiliate. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update bank details mutation
  const updateBankDetailsMutation = useMutation({
    mutationFn: async (bankDetails: {
      bankName: string;
      accountNumber: string;
      accountName: string;
      bankCode: string;
      paymentMethod: string;
    }) => {
      const response = await apiRequest('POST', '/api/affiliates/bank-details', bankDetails);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Bank Details Updated',
        description: 'Your payment information has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliates/dashboard'] });
    },
    onError: error => {
      toast({
        title: 'Update Failed',
        description: 'Could not update your bank details. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Handle copy referral link
  const handleCopyReferralLink = () => {
    if (!dashboardData?.affiliate?.code) return;

    const referralLink = `${window.location.origin}/signup?ref=${dashboardData.affiliate.code}`;
    navigator.clipboard.writeText(referralLink);

    toast({
      title: 'Copied!',
      description: 'Referral link copied to clipboard',
    });
  };

  // Submit bank details
  const handleSubmitBankDetails = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    updateBankDetailsMutation.mutate({
      bankName: formData.get('bankName') as string,
      accountNumber: formData.get('accountNumber') as string,
      accountName: formData.get('accountName') as string,
      bankCode: formData.get('bankCode') as string,
      paymentMethod: formData.get('paymentMethod') as string,
    });
  };

  // If no affiliate account, show registration option
  if (!isDashboardLoading && !dashboardData && !dashboardError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Become an Affiliate Partner</CardTitle>
          <CardDescription>
            Earn 10% commission for every referred user for 12 months
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex flex-col items-center text-center">
                <User2Icon className="h-10 w-10 text-primary mb-2" />
                <h3 className="font-medium">Refer Users</h3>
                <p className="text-sm text-gray-500">
                  Share your unique referral link with potential users
                </p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex flex-col items-center text-center">
                <DollarSign className="h-10 w-10 text-primary mb-2" />
                <h3 className="font-medium">Earn Commission</h3>
                <p className="text-sm text-gray-500">
                  Earn 10% of their subscription payments for 12 months
                </p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex flex-col items-center text-center">
                <Building2Icon className="h-10 w-10 text-primary mb-2" />
                <h3 className="font-medium">Get Paid</h3>
                <p className="text-sm text-gray-500">
                  Receive payments via Paystack or Flutterwave
                </p>
              </div>
            </Card>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <h3 className="font-medium flex items-center">
              <InfoIcon className="h-4 w-4 mr-2 text-primary" />
              How it works
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex items-start">
                <ArrowRightIcon className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                <span>Referred users get 10% off their subscription for 12 months</span>
              </li>
              <li className="flex items-start">
                <ArrowRightIcon className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                <span>You earn 10% commission on their payments for 12 months</span>
              </li>
              <li className="flex items-start">
                <ArrowRightIcon className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                <span>Minimum payout is ₦10,000 or $10 USD</span>
              </li>
              <li className="flex items-start">
                <ArrowRightIcon className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                <span>Payments are processed monthly via Paystack or Flutterwave</span>
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => registerAffiliateMutation.mutate()}
            disabled={registerAffiliateMutation.isPending}
            className="w-full"
          >
            {registerAffiliateMutation.isPending ? (
              <>
                <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" /> Registering...
              </>
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
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
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
      <div className="space-y-4">
        <Skeleton className="h-[250px] w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[100px] w-full rounded-lg" />
          <Skeleton className="h-[100px] w-full rounded-lg" />
          <Skeleton className="h-[100px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Affiliate Dashboard</CardTitle>
              <CardDescription>Track your referrals and earnings</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchDashboard()}>
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-medium">Your Referral Link</h3>
                <p className="text-sm text-muted-foreground">Share this link to earn commission</p>
              </div>
              <div className="w-full md:w-auto flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/signup?ref=${dashboardData?.affiliate?.code}`}
                  className="bg-white font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopyReferralLink}>
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                    <h3 className="text-2xl font-bold">
                      {formatCurrency(Number(dashboardData?.earnings?.total || 0))}
                    </h3>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Earnings</p>
                    <h3 className="text-2xl font-bold">
                      {formatCurrency(Number(dashboardData?.earnings?.pending || 0))}
                    </h3>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Referred Users</p>
                    <h3 className="text-2xl font-bold">{dashboardData?.referrals?.total || 0}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboardData?.referrals?.active || 0} active
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UsersIcon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Affiliate Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-sm mb-2">Performance</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Conversion Rate</span>
                      <span className="font-medium">
                        {dashboardData?.referrals?.total
                          ? Math.round(
                              (dashboardData?.referrals?.active / dashboardData?.referrals?.total) *
                                100
                            )
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Active Referrals</span>
                      <span className="font-medium">{dashboardData?.referrals?.active || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pending Referrals</span>
                      <span className="font-medium">{dashboardData?.referrals?.pending || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Referral Code</span>
                      <span className="font-medium font-mono">
                        {dashboardData?.affiliate?.code}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-sm mb-2">Payment Details</h3>
                  {dashboardData?.affiliate?.bankName ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Bank</span>
                        <span className="font-medium">{dashboardData.affiliate.bankName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Account Name</span>
                        <span className="font-medium">{dashboardData.affiliate.accountName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Account Number</span>
                        <span className="font-medium">{dashboardData.affiliate.accountNumber}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Payment Method</span>
                        <span className="font-medium capitalize">
                          {dashboardData.affiliate.paymentMethod}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <div className="flex items-start">
                        <AlertCircleIcon className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-700">Add Payment Details</h4>
                          <p className="text-sm text-yellow-600 mt-1">
                            You need to add your bank details to receive payouts
                          </p>
                        </div>
                      </div>
                      <Button
                        className="mt-3 w-full"
                        variant="outline"
                        onClick={() => setActiveTab('payments')}
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
              <div className="space-y-4">
                <div className="p-3 bg-primary/5 rounded-lg">
                  <h3 className="font-medium flex items-center">
                    <ArrowRightIcon className="h-4 w-4 mr-2 text-primary" />
                    Social Media Promotion
                  </h3>
                  <p className="text-sm mt-1">
                    Share your referral link on social media with a brief explanation of ChainSync
                    and its benefits for retail stores.
                  </p>
                </div>

                <div className="p-3 bg-primary/5 rounded-lg">
                  <h3 className="font-medium flex items-center">
                    <ArrowRightIcon className="h-4 w-4 mr-2 text-primary" />
                    Direct Outreach
                  </h3>
                  <p className="text-sm mt-1">
                    Reach out to store owners you know and offer them a 10% discount through your
                    referral link.
                  </p>
                </div>

                <div className="p-3 bg-primary/5 rounded-lg">
                  <h3 className="font-medium flex items-center">
                    <ArrowRightIcon className="h-4 w-4 mr-2 text-primary" />
                    Blog or Website
                  </h3>
                  <p className="text-sm mt-1">
                    If you have a blog or website, create content about retail management and
                    include your affiliate link.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Referrals</CardTitle>
              <CardDescription>Track all your referred users and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {isReferralsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : referralsData.length === 0 ? (
                <div className="text-center py-8">
                  <UsersIcon className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="font-medium text-muted-foreground">No referrals yet</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
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
                    {referralsData.map(referral => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          <div className="font-medium">{referral.fullName}</div>
                          <div className="text-sm text-muted-foreground">{referral.username}</div>
                        </TableCell>
                        <TableCell>
                          {referral.status === 'active' && (
                            <div className="flex items-center text-green-600">
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              <span>Active</span>
                            </div>
                          )}
                          {referral.status === 'pending' && (
                            <div className="flex items-center text-yellow-600">
                              <CircleDashed className="h-4 w-4 mr-1" />
                              <span>Pending</span>
                            </div>
                          )}
                          {referral.status === 'completed' && (
                            <div className="flex items-center text-blue-600">
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              <span>Completed</span>
                            </div>
                          )}
                          {referral.status === 'cancelled' && (
                            <div className="flex items-center text-red-600">
                              <AlertCircleIcon className="h-4 w-4 mr-1" />
                              <span>Cancelled</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{new Date(referral.signupDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {referral.expiryDate
                            ? new Date(referral.expiryDate).toLocaleDateString()
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
              <CardDescription>
                Update your payment information to receive commissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitBankDetails} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <select
                    id="paymentMethod"
                    name="paymentMethod"
                    className="w-full p-2 border rounded-md"
                    defaultValue={dashboardData?.affiliate?.paymentMethod || 'paystack'}
                  >
                    <option value="paystack">Paystack (Nigeria)</option>
                    <option value="flutterwave">Flutterwave (International)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    name="bankName"
                    placeholder="e.g., First Bank"
                    defaultValue={dashboardData?.affiliate?.bankName || ''}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    name="accountName"
                    placeholder="e.g., John Doe"
                    defaultValue={dashboardData?.affiliate?.accountName || ''}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    name="accountNumber"
                    placeholder="e.g., 1234567890"
                    defaultValue={dashboardData?.affiliate?.accountNumber || ''}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="bankCode">Bank Code</Label>
                  <Input
                    id="bankCode"
                    name="bankCode"
                    placeholder="e.g., 044 for First Bank"
                    defaultValue={dashboardData?.affiliate?.bankCode || ''}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Find bank codes for Nigeria on{' '}
                    <a
                      href="https://developer.paystack.co/reference/list-banks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Paystack's documentation
                    </a>
                    or{' '}
                    <a
                      href="https://developer.flutterwave.com/reference/get-all-banks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Flutterwave's documentation
                    </a>
                  </p>
                </div>

                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    Ensure your bank details are correct. Incorrect details may delay your payments.
                  </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateBankDetailsMutation.isPending}
                >
                  {updateBankDetailsMutation.isPending ? (
                    <>
                      <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" /> Updating...
                    </>
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
              <CardDescription>View your commission payment history</CardDescription>
            </CardHeader>
            <CardContent>
              {isPaymentsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : paymentsData.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="font-medium text-muted-foreground">No payments yet</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1">
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
                    {paymentsData.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {payment.paymentDate
                            ? new Date(payment.paymentDate).toLocaleDateString()
                            : new Date(payment.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(Number(payment.amount), payment.currency as any)}
                        </TableCell>
                        <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                        <TableCell>
                          {payment.status === 'completed' && (
                            <div className="flex items-center text-green-600">
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              <span>Completed</span>
                            </div>
                          )}
                          {payment.status === 'pending' && (
                            <div className="flex items-center text-yellow-600">
                              <CircleDashed className="h-4 w-4 mr-1" />
                              <span>Pending</span>
                            </div>
                          )}
                          {payment.status === 'failed' && (
                            <div className="flex items-center text-red-600">
                              <AlertCircleIcon className="h-4 w-4 mr-1" />
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
