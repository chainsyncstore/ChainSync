import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, UserPlus, Award, Gift, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AppShell } from '@/components/layout/app-shell';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

// Types
interface Customer {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
}

interface LoyaltyMember {
  id: number;
  customerId: number;
  loyaltyId: string;
  currentPoints: string;
  totalPointsEarned: string;
  totalPointsRedeemed: string;
  enrollmentDate: string;
  lastActivity: string;
  customer: Customer;
  tier?: {
    id: number;
    name: string;
    requiredPoints: string;
    pointMultiplier: string;
  } | null;
}

interface LoyaltyTransaction {
  id: number;
  memberId: number;
  transactionId: number | null;
  type: string;
  points: string;
  note: string | null;
  createdAt: string;
  reward?: {
    id: number;
    name: string;
    pointsCost: string;
  } | null;
}

interface LoyaltyReward {
  id: number;
  name: string;
  description: string | null;
  pointsCost: string;
  discountValue: string | null;
  discountType: string | null;
  productId: number | null;
  product?: {
    name: string;
    price: string;
  } | null;
}

interface LoyaltyProgram {
  id: number;
  storeId: number;
  name: string;
  pointsPerAmount: string;
  active: boolean;
  expiryMonths: number | null;
  tiers: LoyaltyTier[];
  rewards: LoyaltyReward[];
}

interface LoyaltyTier {
  id: number;
  name: string;
  requiredPoints: string;
  pointMultiplier: string;
}

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function LoyaltyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [enrollDialog, setEnrollDialog] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // Get the current user's store ID (in a real app, get this from user context)
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    // In a real app, get the user's store ID from context/session
    const fetchUserData = async () => {
      try {
        const response = await apiRequest('GET', '/api/auth/me');
        const userData = await response.json();
        
        if (userData?.storeId) {
          setStoreId(userData.storeId);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
  }, []);

  // Fetch members
  const { 
    data: members = [], 
    isLoading: membersLoading,
    refetch: refetchMembers
  } = useQuery({
    queryKey: ['/api/loyalty/members', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      try {
        const response = await apiRequest('GET', `/api/loyalty/members?storeId=${storeId}`);
        return await response.json();
      } catch (error) {
        console.error('Error fetching loyalty members:', error);
        return [];
      }
    },
    enabled: !!storeId
  });

  // Fetch loyalty program
  const { 
    data: program,
    isLoading: programLoading
  } = useQuery({
    queryKey: ['/api/loyalty/program', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      try {
        const response = await apiRequest('GET', `/api/loyalty/program/${storeId}`);
        return await response.json();
      } catch (error) {
        // Program might not exist yet
        if ((error as any)?.status === 404) {
          return null;
        }
        console.error('Error fetching loyalty program:', error);
        return null;
      }
    },
    enabled: !!storeId
  });

  // Fetch member details and activity
  const {
    data: selectedMember,
    isLoading: memberLoading
  } = useQuery({
    queryKey: ['/api/loyalty/member', selectedMemberId],
    queryFn: async () => {
      if (!selectedMemberId) return null;
      try {
        const response = await apiRequest('GET', `/api/loyalty/member/${selectedMemberId}`);
        return await response.json();
      } catch (error) {
        console.error('Error fetching member details:', error);
        return null;
      }
    },
    enabled: !!selectedMemberId
  });

  // Fetch member activity
  const {
    data: memberActivity = [],
    isLoading: activityLoading
  } = useQuery({
    queryKey: ['/api/loyalty/member/activity', selectedMemberId],
    queryFn: async () => {
      if (!selectedMemberId) return [];
      try {
        const response = await apiRequest('GET', `/api/loyalty/member/${selectedMemberId}/activity`);
        return await response.json();
      } catch (error) {
        console.error('Error fetching member activity:', error);
        return [];
      }
    },
    enabled: !!selectedMemberId
  });

  // Fetch available rewards
  const {
    data: availableRewards = [],
    isLoading: rewardsLoading
  } = useQuery({
    queryKey: ['/api/loyalty/member/rewards', selectedMemberId],
    queryFn: async () => {
      if (!selectedMemberId) return [];
      try {
        const response = await apiRequest('GET', `/api/loyalty/member/${selectedMemberId}/rewards`);
        return await response.json();
      } catch (error) {
        console.error('Error fetching available rewards:', error);
        return [];
      }
    },
    enabled: !!selectedMemberId
  });

  // Fetch loyalty analytics
  const {
    data: analytics,
    isLoading: analyticsLoading
  } = useQuery({
    queryKey: ['/api/loyalty/analytics', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      try {
        const response = await apiRequest('GET', `/api/loyalty/analytics/${storeId}`);
        return await response.json();
      } catch (error) {
        console.error('Error fetching loyalty analytics:', error);
        return null;
      }
    },
    enabled: !!storeId
  });

  // Create customer and enroll in loyalty program
  const enrollCustomer = useMutation({
    mutationFn: async (customerData: { fullName: string; email?: string; phone?: string }) => {
      if (!storeId) {
        throw new Error('No store ID available');
      }

      // First create the customer
      const createCustomerResponse = await apiRequest('POST', '/api/customers', {
        ...customerData,
        storeId
      });
      
      if (!createCustomerResponse.ok) {
        throw new Error('Failed to create customer');
      }
      
      const customer = await createCustomerResponse.json();
      
      // Then enroll in loyalty program
      const enrollResponse = await apiRequest('POST', '/api/loyalty/enroll', {
        customerId: customer.id
      });
      
      if (!enrollResponse.ok) {
        throw new Error('Failed to enroll customer in loyalty program');
      }
      
      return enrollResponse.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Customer enrolled in loyalty program successfully',
      });
      setEnrollDialog(false);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      refetchMembers();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to enroll customer: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Filter members based on search query
  const filteredMembers = members.filter((member: LoyaltyMember) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      member.customer.fullName.toLowerCase().includes(searchLower) ||
      (member.customer.email && member.customer.email.toLowerCase().includes(searchLower)) ||
      (member.customer.phone && member.customer.phone.includes(searchQuery)) ||
      member.loyaltyId.toLowerCase().includes(searchLower)
    );
  });

  const handleEnrollCustomer = () => {
    if (!customerName) {
      toast({
        title: 'Error',
        description: 'Customer name is required',
        variant: 'destructive',
      });
      return;
    }

    enrollCustomer.mutate({
      fullName: customerName,
      email: customerEmail || undefined,
      phone: customerPhone || undefined,
    });
  };

  return (
    <AppShell>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">ChainSync Loyalty Program</h1>

      <Tabs defaultValue="members" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="members">Member Management</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Program Settings</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <div className="flex justify-between mb-4">
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dialog open={enrollDialog} onOpenChange={setEnrollDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Enroll New Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enroll Customer in Loyalty Program</DialogTitle>
                  <DialogDescription>
                    Enter customer details to create an account and enroll them in the loyalty program.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name*
                    </Label>
                    <Input
                      id="name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleEnrollCustomer} disabled={enrollCustomer.isPending}>
                    {enrollCustomer.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enrolling...
                      </>
                    ) : (
                      'Enroll Customer'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Loyalty Members</CardTitle>
                  <CardDescription>
                    {membersLoading ? 'Loading...' : `${filteredMembers.length} members found`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-[70vh] overflow-y-auto">
                  {membersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {searchQuery ? 'No members found matching search' : 'No members enrolled yet'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredMembers.map((member: LoyaltyMember) => (
                        <div
                          key={member.id}
                          className={`p-3 rounded-lg border cursor-pointer hover:bg-accent ${
                            selectedMemberId === member.id ? 'bg-accent' : ''
                          }`}
                          onClick={() => setSelectedMemberId(member.id)}
                        >
                          <div className="font-medium">{member.customer.fullName}</div>
                          <div className="text-sm text-muted-foreground">
                            {member.loyaltyId} • {formatNumber(member.currentPoints)} pts
                          </div>
                          {member.tier && (
                            <Badge variant="outline" className="mt-1">
                              {member.tier.name}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2">
              {!selectedMemberId ? (
                <Card className="h-full flex items-center justify-center">
                  <CardContent className="text-center py-16">
                    <Award className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Select a member to view their details and loyalty activity
                    </p>
                  </CardContent>
                </Card>
              ) : memberLoading ? (
                <Card className="h-full flex items-center justify-center">
                  <CardContent className="text-center py-16">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedMember?.customer?.fullName}</CardTitle>
                      <CardDescription>
                        Member since{' '}
                        {selectedMember?.enrollmentDate
                          ? format(new Date(selectedMember.enrollmentDate), 'MMMM d, yyyy')
                          : 'N/A'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-secondary rounded-lg p-4">
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Current Points
                          </div>
                          <div className="text-2xl font-bold">
                            {formatNumber(selectedMember?.currentPoints || '0')}
                          </div>
                        </div>
                        <div className="bg-secondary rounded-lg p-4">
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Total Earned
                          </div>
                          <div className="text-2xl font-bold">
                            {formatNumber(selectedMember?.totalPointsEarned || '0')}
                          </div>
                        </div>
                        <div className="bg-secondary rounded-lg p-4">
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Total Redeemed
                          </div>
                          <div className="text-2xl font-bold">
                            {formatNumber(selectedMember?.totalPointsRedeemed || '0')}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <h3 className="text-lg font-medium mb-2">Contact Information</h3>
                        <div className="grid md:grid-cols-2 gap-2">
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Email:</span>{' '}
                            {selectedMember?.customer?.email || 'Not provided'}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Phone:</span>{' '}
                            {selectedMember?.customer?.phone || 'Not provided'}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Loyalty ID:
                            </span>{' '}
                            {selectedMember?.loyaltyId}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Tier:</span>{' '}
                            {selectedMember?.tier?.name || 'Standard'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Available Rewards</CardTitle>
                      <CardDescription>
                        Rewards that can be redeemed with current points
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {rewardsLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : availableRewards.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          No rewards available for redemption
                        </p>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                          {availableRewards.map((reward: LoyaltyReward) => (
                            <div key={reward.id} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium">{reward.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {reward.description || 'No description available'}
                                  </p>
                                </div>
                                <Badge>{formatNumber(reward.pointsCost)} pts</Badge>
                              </div>
                              <div className="mt-4">
                                {reward.discountType === 'percentage' && (
                                  <div className="text-sm">
                                    {reward.discountValue}% discount on purchase
                                  </div>
                                )}
                                {reward.discountType === 'fixed' && (
                                  <div className="text-sm">
                                    ₦{formatNumber(reward.discountValue || '0')} discount
                                  </div>
                                )}
                                {reward.discountType === 'free_product' && reward.product && (
                                  <div className="text-sm">
                                    Free {reward.product.name} (₦{formatNumber(reward.product.price)}{' '}
                                    value)
                                  </div>
                                )}
                              </div>
                              <div className="mt-2">
                                <Button size="sm" variant="outline" className="w-full">
                                  <Gift className="mr-1 h-4 w-4" />
                                  Redeem at POS
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Activity History</CardTitle>
                      <CardDescription>Recent loyalty transactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {activityLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : memberActivity.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          No activity recorded yet
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Points</TableHead>
                              <TableHead>Description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {memberActivity.map((activity: LoyaltyTransaction) => (
                              <TableRow key={activity.id}>
                                <TableCell>
                                  {format(new Date(activity.createdAt), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      activity.type === 'earn'
                                        ? 'default'
                                        : activity.type === 'redeem'
                                        ? 'destructive'
                                        : 'outline'
                                    }
                                    className={activity.type === 'earn' ? 'bg-green-500 hover:bg-green-600' : ''}
                                  >
                                    {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell
                                  className={
                                    parseFloat(activity.points) > 0
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }
                                >
                                  {parseFloat(activity.points) > 0 ? '+' : ''}
                                  {formatNumber(activity.points)}
                                </TableCell>
                                <TableCell>
                                  {activity.reward
                                    ? `Redeemed: ${activity.reward.name}`
                                    : activity.note || 'Transaction'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards">
          <Card>
            <CardHeader>
              <CardTitle>Loyalty Rewards</CardTitle>
              <CardDescription>
                Manage rewards that customers can redeem their points for
              </CardDescription>
            </CardHeader>
            <CardContent>
              {programLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !program ? (
                <div className="text-center py-8">
                  <Gift className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No loyalty program has been set up yet. Create one in the Settings tab.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between">
                    <h3 className="text-lg font-medium">Available Rewards</h3>
                    <Button>Add New Reward</Button>
                  </div>

                  {program.rewards && program.rewards.length > 0 ? (
                    <div className="grid md:grid-cols-3 gap-4">
                      {program.rewards.map((reward: LoyaltyReward) => (
                        <Card key={reward.id}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between">
                              <CardTitle className="text-base">{reward.name}</CardTitle>
                              <Badge>{formatNumber(reward.pointsCost)} pts</Badge>
                            </div>
                            <CardDescription>
                              {reward.description || 'No description'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm">
                              {reward.discountType === 'percentage' && (
                                <span>{reward.discountValue}% discount</span>
                              )}
                              {reward.discountType === 'fixed' && (
                                <span>₦{formatNumber(reward.discountValue || '0')} off</span>
                              )}
                              {reward.discountType === 'free_product' && reward.product && (
                                <span>Free {reward.product.name}</span>
                              )}
                            </div>
                          </CardContent>
                          <CardFooter className="pt-0">
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No rewards have been created yet</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Loyalty Program Analytics</CardTitle>
              <CardDescription>Key metrics and insights for your loyalty program</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !analytics ? (
                <div className="text-center py-8">
                  <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No analytics available. You need an active loyalty program with members.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Total Members
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analytics.memberCount}</div>
                        <p className="text-xs text-muted-foreground">
                          {analytics.activeMembers} active
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Points Earned
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatNumber(analytics.totalPointsEarned)}
                        </div>
                        <p className="text-xs text-muted-foreground">Program lifetime</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Points Redeemed
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatNumber(analytics.totalPointsRedeemed)}
                        </div>
                        <p className="text-xs text-muted-foreground">Program lifetime</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Current Points Balance
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatNumber(analytics.pointsBalance)}
                        </div>
                        <p className="text-xs text-muted-foreground">Across all members</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Redeemed Rewards</CardTitle>
                        <CardDescription>Most popular loyalty rewards</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {analytics.topRewards && analytics.topRewards.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Reward</TableHead>
                                <TableHead className="text-right">Redemptions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analytics.topRewards.map(
                                (reward: { name: string; redemptions: number }, index: number) => (
                                  <TableRow key={index}>
                                    <TableCell>{reward.name}</TableCell>
                                    <TableCell className="text-right">
                                      {reward.redemptions}
                                    </TableCell>
                                  </TableRow>
                                )
                              )}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">
                            No rewards have been redeemed yet
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Program Details</CardTitle>
                        <CardDescription>Your loyalty program configuration</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {analytics.programDetails ? (
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium">Program Name</h4>
                              <p>{analytics.programDetails.name}</p>
                            </div>
                            <div>
                              <h4 className="font-medium">Points Earning Rate</h4>
                              <p>
                                {analytics.programDetails.pointsPerAmount} points per currency unit
                              </p>
                            </div>
                            <div>
                              <h4 className="font-medium">Points Expiration</h4>
                              <p>
                                {analytics.programDetails.expiryMonths
                                  ? `${analytics.programDetails.expiryMonths} months after inactivity`
                                  : 'Points do not expire'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">
                            Program details not available
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Loyalty Program Settings</CardTitle>
              <CardDescription>
                Configure your loyalty program parameters and tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {programLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Program Basics</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="programName">Program Name</Label>
                        <Input
                          id="programName"
                          defaultValue={program?.name || 'ChainSync Rewards'}
                          placeholder="e.g., ChainSync Rewards"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pointsRate">Points Earning Rate</Label>
                        <Input
                          id="pointsRate"
                          type="number"
                          defaultValue={program?.pointsPerAmount || 1}
                          placeholder="e.g., 1 (point per currency unit)"
                        />
                        <p className="text-xs text-muted-foreground">
                          Number of points earned per currency unit spent
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expiryMonths">Points Expiry Period (Months)</Label>
                        <Input
                          id="expiryMonths"
                          type="number"
                          defaultValue={program?.expiryMonths || 12}
                          placeholder="e.g., 12"
                        />
                        <p className="text-xs text-muted-foreground">
                          Number of months of inactivity before points expire (0 for no expiry)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <h3 className="text-lg font-medium">Loyalty Tiers</h3>
                      <Button variant="outline">Add New Tier</Button>
                    </div>
                    {program?.tiers && program.tiers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tier Name</TableHead>
                            <TableHead>Required Points</TableHead>
                            <TableHead>Point Multiplier</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {program.tiers.map((tier: LoyaltyTier) => (
                            <TableRow key={tier.id}>
                              <TableCell>{tier.name}</TableCell>
                              <TableCell>{formatNumber(tier.requiredPoints)}</TableCell>
                              <TableCell>{tier.pointMultiplier}x</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 border rounded-lg">
                        <p className="text-muted-foreground">No tiers have been created yet</p>
                        <Button variant="outline" className="mt-4">
                          Create Default Tiers
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button>Save Program Settings</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AppShell>
  );
}