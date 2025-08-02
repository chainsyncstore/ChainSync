import { useState, useEffect } from &apos;react&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { Loader2, Search, UserPlus, Award, Gift, TrendingUp } from &apos;lucide-react&apos;;
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from &apos;@/components/ui/dialog&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { format } from &apos;date-fns&apos;;

// Types
interface Customer {
  _id: number;
  _fullName: string;
  _email: string | null;
  _phone: string | null;
}

interface LoyaltyMember {
  _id: number;
  _customerId: number;
  _loyaltyId: string;
  _currentPoints: string;
  _totalPointsEarned: string;
  _totalPointsRedeemed: string;
  _enrollmentDate: string;
  _lastActivity: string;
  _customer: Customer;
  tier?: {
    _id: number;
    _name: string;
    _requiredPoints: string;
    _pointMultiplier: string;
  } | null;
}

interface LoyaltyTransaction {
  _id: number;
  _memberId: number;
  _transactionId: number | null;
  _type: string;
  _points: string;
  _note: string | null;
  _createdAt: string;
  reward?: {
    _id: number;
    _name: string;
    _pointsCost: string;
  } | null;
}

interface LoyaltyReward {
  _id: number;
  _name: string;
  _description: string | null;
  _pointsCost: string;
  _discountValue: string | null;
  _discountType: string | null;
  _productId: number | null;
  product?: {
    _name: string;
    _price: string;
  } | null;
}

// interface LoyaltyProgram { // Unused
//   _id: number;
//   _storeId: number;
//   _name: string;
//   _pointsPerAmount: string;
//   _active: boolean;
//   _expiryMonths: number | null;
//   _tiers: LoyaltyTier[];
//   _rewards: LoyaltyReward[];
// }

interface LoyaltyTier {
  _id: number;
  _name: string;
  _requiredPoints: string;
  _pointMultiplier: string;
}

function formatNumber(_value: string | number): string {
  const num = typeof value === &apos;string&apos; ? parseFloat(value) : value;
  return num.toLocaleString(undefined, { _minimumFractionDigits: 0, _maximumFractionDigits: 2 });
}

export default function LoyaltyPage() {
  const { toast } = useToast();
  // const queryClient = useQueryClient(); // Unused
  const [activeTab, setActiveTab] = useState(&apos;members&apos;);
  const [searchQuery, setSearchQuery] = useState(&apos;&apos;);
  const [enrollDialog, setEnrollDialog] = useState(false);
  const [customerName, setCustomerName] = useState(&apos;&apos;);
  const [customerEmail, setCustomerEmail] = useState(&apos;&apos;);
  const [customerPhone, setCustomerPhone] = useState(&apos;&apos;);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // Get the current user&apos;s store ID (in a real app, get this from user context)
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    // In a real app, get the user&apos;s store ID from context/session
    const fetchUserData = async() => {
      try {
        const response = await apiRequest(&apos;GET&apos;, &apos;/api/auth/me&apos;);
        const userData = await response.json();

        if (userData?.storeId) {
          setStoreId(userData.storeId);
        }
      } catch (error) {
        console.error(&apos;Error fetching user _data:&apos;, error);
      }
    };

    fetchUserData();
  }, []);

  // Fetch members
  const {
    _data: members = [],
    _isLoading: membersLoading,
    _refetch: refetchMembers
  } = useQuery({
    queryKey: [&apos;/api/loyalty/members&apos;, storeId],
    _queryFn: async() => {
      if (!storeId) return [];
      try {
        const response = await apiRequest(&apos;GET&apos;, `/api/loyalty/members?storeId=${storeId}`);
        return await response.json();
      } catch (error) {
        console.error(&apos;Error fetching loyalty _members:&apos;, error);
        return [];
      }
    },
    _enabled: !!storeId
  });

  // Fetch loyalty program
  const {
    _data: program,
    _isLoading: programLoading
  } = useQuery({
    queryKey: [&apos;/api/loyalty/program&apos;, storeId],
    _queryFn: async() => {
      if (!storeId) return null;
      try {
        const response = await apiRequest(&apos;GET&apos;, `/api/loyalty/program/${storeId}`);
        return await response.json();
      } catch (error) {
        // Program might not exist yet
        if ((error as any)?.status === 404) {
          return null;
        }
        console.error(&apos;Error fetching loyalty _program:&apos;, error);
        return null;
      }
    },
    _enabled: !!storeId
  });

  // Fetch member details and activity
  const {
    _data: selectedMember,
    _isLoading: memberLoading
  } = useQuery({
    queryKey: [&apos;/api/loyalty/member&apos;, selectedMemberId],
    _queryFn: async() => {
      if (!selectedMemberId) return null;
      try {
        const response = await apiRequest(&apos;GET&apos;, `/api/loyalty/member/${selectedMemberId}`);
        return await response.json();
      } catch (error) {
        console.error(&apos;Error fetching member _details:&apos;, error);
        return null;
      }
    },
    _enabled: !!selectedMemberId
  });

  // Fetch member activity
  const {
    _data: memberActivity = [],
    _isLoading: activityLoading
  } = useQuery({
    queryKey: [&apos;/api/loyalty/member/activity&apos;, selectedMemberId],
    _queryFn: async() => {
      if (!selectedMemberId) return [];
      try {
        const response = await apiRequest(&apos;GET&apos;, `/api/loyalty/member/${selectedMemberId}/activity`);
        return await response.json();
      } catch (error) {
        console.error(&apos;Error fetching member _activity:&apos;, error);
        return [];
      }
    },
    _enabled: !!selectedMemberId
  });

  // Fetch available rewards
  const {
    _data: availableRewards = [],
    _isLoading: rewardsLoading
  } = useQuery({
    queryKey: [&apos;/api/loyalty/member/rewards&apos;, selectedMemberId],
    _queryFn: async() => {
      if (!selectedMemberId) return [];
      try {
        const response = await apiRequest(&apos;GET&apos;, `/api/loyalty/member/${selectedMemberId}/rewards`);
        return await response.json();
      } catch (error) {
        console.error(&apos;Error fetching available _rewards:&apos;, error);
        return [];
      }
    },
    _enabled: !!selectedMemberId
  });

  // Fetch loyalty analytics
  const {
    _data: analytics,
    _isLoading: analyticsLoading
  } = useQuery({
    queryKey: [&apos;/api/loyalty/analytics&apos;, storeId],
    _queryFn: async() => {
      if (!storeId) return null;
      try {
        const response = await apiRequest(&apos;GET&apos;, `/api/loyalty/analytics/${storeId}`);
        return await response.json();
      } catch (error) {
        console.error(&apos;Error fetching loyalty _analytics:&apos;, error);
        return null;
      }
    },
    _enabled: !!storeId
  });

  // Create customer and enroll in loyalty program
  const enrollCustomer = useMutation({
    _mutationFn: async(customerData: { _fullName: string; email?: string; phone?: string }) => {
      if (!storeId) {
        throw new Error(&apos;No store ID available&apos;);
      }

      // First create the customer
      const createCustomerResponse = await apiRequest(&apos;POST&apos;, &apos;/api/customers&apos;, {
        ...customerData,
        storeId
      });

      if (!createCustomerResponse.ok) {
        throw new Error(&apos;Failed to create customer&apos;);
      }

      const customer = await createCustomerResponse.json();

      // Then enroll in loyalty program
      const enrollResponse = await apiRequest(&apos;POST&apos;, &apos;/api/loyalty/enroll&apos;, {
        _customerId: customer.id
      });

      if (!enrollResponse.ok) {
        throw new Error(&apos;Failed to enroll customer in loyalty program&apos;);
      }

      return enrollResponse.json();
    },
    _onSuccess: () => {
      toast({
        _title: &apos;Success&apos;,
        _description: &apos;Customer enrolled in loyalty program successfully&apos;
      });
      setEnrollDialog(false);
      setCustomerName(&apos;&apos;);
      setCustomerEmail(&apos;&apos;);
      setCustomerPhone(&apos;&apos;);
      refetchMembers();
    },
    _onError: (error) => {
      toast({
        _title: &apos;Error&apos;,
        _description: `Failed to enroll customer: ${error.message}`,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Filter members based on search query
  const filteredMembers = members.filter((_member: LoyaltyMember) => {
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
        _title: &apos;Error&apos;,
        _description: &apos;Customer name is required&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    enrollCustomer.mutate({
      _fullName: customerName,
      _email: customerEmail || undefined,
      _phone: customerPhone || undefined
    });
  };

  return (
    <AppShell>
      <div className=&quot;container mx-auto py-6&quot;>
        <h1 className=&quot;text-3xl font-bold mb-6&quot;>ChainSync Loyalty Program</h1>

        <Tabs defaultValue=&quot;members&quot; value={activeTab} onValueChange={setActiveTab}>
          <TabsList className=&quot;mb-6&quot;>
            <TabsTrigger value=&quot;members&quot;>Member Management</TabsTrigger>
            <TabsTrigger value=&quot;rewards&quot;>Rewards</TabsTrigger>
            <TabsTrigger value=&quot;analytics&quot;>Analytics</TabsTrigger>
            <TabsTrigger value=&quot;settings&quot;>Program Settings</TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value=&quot;members&quot;>
          <div className=&quot;flex justify-between mb-4&quot;>
            <div className=&quot;relative w-72&quot;>
              <Search className=&quot;absolute left-2 top-2.5 h-4 w-4 text-muted-foreground&quot; />
              <Input
                placeholder=&quot;Search members...&quot;
                className=&quot;pl-8&quot;
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dialog open={enrollDialog} onOpenChange={setEnrollDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className=&quot;mr-2 h-4 w-4&quot; />
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
                <div className=&quot;grid gap-4 py-4&quot;>
                  <div className=&quot;grid grid-cols-4 items-center gap-4&quot;>
                    <Label htmlFor=&quot;name&quot; className=&quot;text-right&quot;>
                      Name*
                    </Label>
                    <Input
                      id=&quot;name&quot;
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className=&quot;col-span-3&quot;
                      required
                    />
                  </div>
                  <div className=&quot;grid grid-cols-4 items-center gap-4&quot;>
                    <Label htmlFor=&quot;email&quot; className=&quot;text-right&quot;>
                      Email
                    </Label>
                    <Input
                      id=&quot;email&quot;
                      type=&quot;email&quot;
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className=&quot;col-span-3&quot;
                    />
                  </div>
                  <div className=&quot;grid grid-cols-4 items-center gap-4&quot;>
                    <Label htmlFor=&quot;phone&quot; className=&quot;text-right&quot;>
                      Phone
                    </Label>
                    <Input
                      id=&quot;phone&quot;
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className=&quot;col-span-3&quot;
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleEnrollCustomer} disabled={enrollCustomer.isPending}>
                    {enrollCustomer.isPending ? (
                      <>
                        <Loader2 className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                        Enrolling...
                      </>
                    ) : (
                      &apos;Enroll Customer&apos;
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-6&quot;>
            <div className=&quot;_md:col-span-1&quot;>
              <Card>
                <CardHeader>
                  <CardTitle>Loyalty Members</CardTitle>
                  <CardDescription>
                    {membersLoading ? &apos;Loading...&apos; : `${filteredMembers.length} members found`}
                  </CardDescription>
                </CardHeader>
                <CardContent className=&quot;max-h-[70vh] overflow-y-auto&quot;>
                  {membersLoading ? (
                    <div className=&quot;flex justify-center py-8&quot;>
                      <Loader2 className=&quot;h-6 w-6 animate-spin&quot; />
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <p className=&quot;text-center text-muted-foreground py-8&quot;>
                      {searchQuery ? &apos;No members found matching search&apos; : &apos;No members enrolled yet&apos;}
                    </p>
                  ) : (
                    <div className=&quot;space-y-2&quot;>
                      {filteredMembers.map((_member: LoyaltyMember) => (
                        <div
                          key={member.id}
                          className={`p-3 rounded-lg border cursor-pointer _hover:bg-accent ${
                            selectedMemberId === member.id ? &apos;bg-accent&apos; : &apos;&apos;
                          }`}
                          onClick={() => setSelectedMemberId(member.id)}
                        >
                          <div className=&quot;font-medium&quot;>{member.customer.fullName}</div>
                          <div className=&quot;text-sm text-muted-foreground&quot;>
                            {member.loyaltyId} • {formatNumber(member.currentPoints)} pts
                          </div>
                          {member.tier && (
                            <Badge variant=&quot;outline&quot; className=&quot;mt-1&quot;>
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

            <div className=&quot;_md:col-span-2&quot;>
              {!selectedMemberId ? (
                <Card className=&quot;h-full flex items-center justify-center&quot;>
                  <CardContent className=&quot;text-center py-16&quot;>
                    <Award className=&quot;mx-auto h-16 w-16 text-muted-foreground mb-4&quot; />
                    <p className=&quot;text-muted-foreground&quot;>
                      Select a member to view their details and loyalty activity
                    </p>
                  </CardContent>
                </Card>
              ) : memberLoading ? (
                <Card className=&quot;h-full flex items-center justify-center&quot;>
                  <CardContent className=&quot;text-center py-16&quot;>
                    <Loader2 className=&quot;mx-auto h-8 w-8 animate-spin&quot; />
                  </CardContent>
                </Card>
              ) : (
                <div className=&quot;space-y-6&quot;>
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedMember?.customer?.fullName}</CardTitle>
                      <CardDescription>
                        Member since{&apos; &apos;}
                        {selectedMember?.enrollmentDate
                          ? format(new Date(selectedMember.enrollmentDate), &apos;MMMM d, yyyy&apos;)
                          : &apos;N/A&apos;}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className=&quot;grid _md:grid-cols-3 gap-4&quot;>
                        <div className=&quot;bg-secondary rounded-lg p-4&quot;>
                          <div className=&quot;text-sm font-medium text-muted-foreground mb-1&quot;>
                            Current Points
                          </div>
                          <div className=&quot;text-2xl font-bold&quot;>
                            {formatNumber(selectedMember?.currentPoints || &apos;0&apos;)}
                          </div>
                        </div>
                        <div className=&quot;bg-secondary rounded-lg p-4&quot;>
                          <div className=&quot;text-sm font-medium text-muted-foreground mb-1&quot;>
                            Total Earned
                          </div>
                          <div className=&quot;text-2xl font-bold&quot;>
                            {formatNumber(selectedMember?.totalPointsEarned || &apos;0&apos;)}
                          </div>
                        </div>
                        <div className=&quot;bg-secondary rounded-lg p-4&quot;>
                          <div className=&quot;text-sm font-medium text-muted-foreground mb-1&quot;>
                            Total Redeemed
                          </div>
                          <div className=&quot;text-2xl font-bold&quot;>
                            {formatNumber(selectedMember?.totalPointsRedeemed || &apos;0&apos;)}
                          </div>
                        </div>
                      </div>

                      <div className=&quot;mt-6&quot;>
                        <h3 className=&quot;text-lg font-medium mb-2&quot;>Contact Information</h3>
                        <div className=&quot;grid _md:grid-cols-2 gap-2&quot;>
                          <div>
                            <span className=&quot;text-sm font-medium text-muted-foreground&quot;>Email:</span>{&apos; &apos;}
                            {selectedMember?.customer?.email || &apos;Not provided&apos;}
                          </div>
                          <div>
                            <span className=&quot;text-sm font-medium text-muted-foreground&quot;>Phone:</span>{&apos; &apos;}
                            {selectedMember?.customer?.phone || &apos;Not provided&apos;}
                          </div>
                          <div>
                            <span className=&quot;text-sm font-medium text-muted-foreground&quot;>
                              Loyalty ID:
                            </span>{&apos; &apos;}
                            {selectedMember?.loyaltyId}
                          </div>
                          <div>
                            <span className=&quot;text-sm font-medium text-muted-foreground&quot;>Tier:</span>{&apos; &apos;}
                            {selectedMember?.tier?.name || &apos;Standard&apos;}
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
                        <div className=&quot;flex justify-center py-4&quot;>
                          <Loader2 className=&quot;h-6 w-6 animate-spin&quot; />
                        </div>
                      ) : availableRewards.length === 0 ? (
                        <p className=&quot;text-center text-muted-foreground py-4&quot;>
                          No rewards available for redemption
                        </p>
                      ) : (
                        <div className=&quot;grid _md:grid-cols-2 gap-4&quot;>
                          {availableRewards.map((_reward: LoyaltyReward) => (
                            <div key={reward.id} className=&quot;border rounded-lg p-4&quot;>
                              <div className=&quot;flex justify-between items-start&quot;>
                                <div>
                                  <h4 className=&quot;font-medium&quot;>{reward.name}</h4>
                                  <p className=&quot;text-sm text-muted-foreground&quot;>
                                    {reward.description || &apos;No description available&apos;}
                                  </p>
                                </div>
                                <Badge>{formatNumber(reward.pointsCost)} pts</Badge>
                              </div>
                              <div className=&quot;mt-4&quot;>
                                {reward.discountType === &apos;percentage&apos; && (
                                  <div className=&quot;text-sm&quot;>
                                    {reward.discountValue}% discount on purchase
                                  </div>
                                )}
                                {reward.discountType === &apos;fixed&apos; && (
                                  <div className=&quot;text-sm&quot;>
                                    ₦{formatNumber(reward.discountValue || &apos;0&apos;)} discount
                                  </div>
                                )}
                                {reward.discountType === &apos;free_product&apos; && reward.product && (
                                  <div className=&quot;text-sm&quot;>
                                    Free {reward.product.name} (₦{formatNumber(reward.product.price)}{&apos; &apos;}
                                    value)
                                  </div>
                                )}
                              </div>
                              <div className=&quot;mt-2&quot;>
                                <Button size=&quot;sm&quot; variant=&quot;outline&quot; className=&quot;w-full&quot;>
                                  <Gift className=&quot;mr-1 h-4 w-4&quot; />
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
                        <div className=&quot;flex justify-center py-4&quot;>
                          <Loader2 className=&quot;h-6 w-6 animate-spin&quot; />
                        </div>
                      ) : memberActivity.length === 0 ? (
                        <p className=&quot;text-center text-muted-foreground py-4&quot;>
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
                            {memberActivity.map((_activity: LoyaltyTransaction) => (
                              <TableRow key={activity.id}>
                                <TableCell>
                                  {format(new Date(activity.createdAt), &apos;MMM d, yyyy&apos;)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      activity.type === &apos;earn&apos;
                                        ? &apos;default&apos;
                                        : activity.type === &apos;redeem&apos;
                                        ? &apos;destructive&apos;
                                        : &apos;outline&apos;
                                    }
                                    className={activity.type === &apos;earn&apos; ? &apos;bg-green-500 _hover:bg-green-600&apos; : &apos;&apos;}
                                  >
                                    {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell
                                  className={
                                    parseFloat(activity.points) > 0
                                      ? &apos;text-green-600&apos;
                                      : &apos;text-red-600&apos;
                                  }
                                >
                                  {parseFloat(activity.points) > 0 ? &apos;+&apos; : &apos;&apos;}
                                  {formatNumber(activity.points)}
                                </TableCell>
                                <TableCell>
                                  {activity.reward
                                    ? `Redeemed: ${activity.reward.name}`
                                    : activity.note || &apos;Transaction&apos;}
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
          <TabsContent value=&quot;rewards&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Loyalty Rewards</CardTitle>
              <CardDescription>
                Manage rewards that customers can redeem their points for
              </CardDescription>
            </CardHeader>
            <CardContent>
              {programLoading ? (
                <div className=&quot;flex justify-center py-8&quot;>
                  <Loader2 className=&quot;h-6 w-6 animate-spin&quot; />
                </div>
              ) : !program ? (
                <div className=&quot;text-center py-8&quot;>
                  <Gift className=&quot;mx-auto h-12 w-12 text-muted-foreground mb-4&quot; />
                  <p className=&quot;text-muted-foreground&quot;>
                    No loyalty program has been set up yet. Create one in the Settings tab.
                  </p>
                </div>
              ) : (
                <div className=&quot;space-y-6&quot;>
                  <div className=&quot;flex justify-between&quot;>
                    <h3 className=&quot;text-lg font-medium&quot;>Available Rewards</h3>
                    <Button>Add New Reward</Button>
                  </div>

                  {program.rewards && program.rewards.length > 0 ? (
                    <div className=&quot;grid _md:grid-cols-3 gap-4&quot;>
                      {program.rewards.map((_reward: LoyaltyReward) => (
                        <Card key={reward.id}>
                          <CardHeader className=&quot;pb-2&quot;>
                            <div className=&quot;flex justify-between&quot;>
                              <CardTitle className=&quot;text-base&quot;>{reward.name}</CardTitle>
                              <Badge>{formatNumber(reward.pointsCost)} pts</Badge>
                            </div>
                            <CardDescription>
                              {reward.description || &apos;No description&apos;}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className=&quot;text-sm&quot;>
                              {reward.discountType === &apos;percentage&apos; && (
                                <span>{reward.discountValue}% discount</span>
                              )}
                              {reward.discountType === &apos;fixed&apos; && (
                                <span>₦{formatNumber(reward.discountValue || &apos;0&apos;)} off</span>
                              )}
                              {reward.discountType === &apos;free_product&apos; && reward.product && (
                                <span>Free {reward.product.name}</span>
                              )}
                            </div>
                          </CardContent>
                          <CardFooter className=&quot;pt-0&quot;>
                            <Button variant=&quot;outline&quot; size=&quot;sm&quot;>
                              Edit
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className=&quot;text-center py-8&quot;>
                      <p className=&quot;text-muted-foreground&quot;>No rewards have been created yet</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
          <TabsContent value=&quot;analytics&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Loyalty Program Analytics</CardTitle>
              <CardDescription>Key metrics and insights for your loyalty program</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className=&quot;flex justify-center py-8&quot;>
                  <Loader2 className=&quot;h-6 w-6 animate-spin&quot; />
                </div>
              ) : !analytics ? (
                <div className=&quot;text-center py-8&quot;>
                  <TrendingUp className=&quot;mx-auto h-12 w-12 text-muted-foreground mb-4&quot; />
                  <p className=&quot;text-muted-foreground&quot;>
                    No analytics available. You need an active loyalty program with members.
                  </p>
                </div>
              ) : (
                <div className=&quot;space-y-8&quot;>
                  <div className=&quot;grid _md:grid-cols-4 gap-4&quot;>
                    <Card>
                      <CardHeader className=&quot;pb-2&quot;>
                        <CardTitle className=&quot;text-sm font-medium text-muted-foreground&quot;>
                          Total Members
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className=&quot;text-2xl font-bold&quot;>{analytics.memberCount}</div>
                        <p className=&quot;text-xs text-muted-foreground&quot;>
                          {analytics.activeMembers} active
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className=&quot;pb-2&quot;>
                        <CardTitle className=&quot;text-sm font-medium text-muted-foreground&quot;>
                          Points Earned
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className=&quot;text-2xl font-bold&quot;>
                          {formatNumber(analytics.totalPointsEarned)}
                        </div>
                        <p className=&quot;text-xs text-muted-foreground&quot;>Program lifetime</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className=&quot;pb-2&quot;>
                        <CardTitle className=&quot;text-sm font-medium text-muted-foreground&quot;>
                          Points Redeemed
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className=&quot;text-2xl font-bold&quot;>
                          {formatNumber(analytics.totalPointsRedeemed)}
                        </div>
                        <p className=&quot;text-xs text-muted-foreground&quot;>Program lifetime</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className=&quot;pb-2&quot;>
                        <CardTitle className=&quot;text-sm font-medium text-muted-foreground&quot;>
                          Current Points Balance
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className=&quot;text-2xl font-bold&quot;>
                          {formatNumber(analytics.pointsBalance)}
                        </div>
                        <p className=&quot;text-xs text-muted-foreground&quot;>Across all members</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className=&quot;grid _md:grid-cols-2 gap-6&quot;>
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
                                <TableHead className=&quot;text-right&quot;>Redemptions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analytics.topRewards.map(
                                (reward: { _name: string; _redemptions: number }, _index: number)
   = > (
                                  <TableRow key={index}>
                                    <TableCell>{reward.name}</TableCell>
                                    <TableCell className=&quot;text-right&quot;>
                                      {reward.redemptions}
                                    </TableCell>
                                  </TableRow>
                                )
                              )}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className=&quot;text-center text-muted-foreground py-4&quot;>
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
                          <div className=&quot;space-y-4&quot;>
                            <div>
                              <h4 className=&quot;font-medium&quot;>Program Name</h4>
                              <p>{analytics.programDetails.name}</p>
                            </div>
                            <div>
                              <h4 className=&quot;font-medium&quot;>Points Earning Rate</h4>
                              <p>
                                {analytics.programDetails.pointsPerAmount} points per currency unit
                              </p>
                            </div>
                            <div>
                              <h4 className=&quot;font-medium&quot;>Points Expiration</h4>
                              <p>
                                {analytics.programDetails.expiryMonths
                                  ? `${analytics.programDetails.expiryMonths} months after inactivity`
                                  : &apos;Points do not expire&apos;}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className=&quot;text-center text-muted-foreground py-4&quot;>
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
          <TabsContent value=&quot;settings&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Loyalty Program Settings</CardTitle>
              <CardDescription>
                Configure your loyalty program parameters and tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {programLoading ? (
                <div className=&quot;flex justify-center py-8&quot;>
                  <Loader2 className=&quot;h-6 w-6 animate-spin&quot; />
                </div>
              ) : (
                <div className=&quot;space-y-8&quot;>
                  <div className=&quot;space-y-4&quot;>
                    <h3 className=&quot;text-lg font-medium&quot;>Program Basics</h3>
                    <div className=&quot;grid _md:grid-cols-2 gap-4&quot;>
                      <div className=&quot;space-y-2&quot;>
                        <Label htmlFor=&quot;programName&quot;>Program Name</Label>
                        <Input
                          id=&quot;programName&quot;
                          defaultValue={program?.name || &apos;ChainSync Rewards&apos;}
                          placeholder=&quot;e.g., ChainSync Rewards&quot;
                        />
                      </div>
                      <div className=&quot;space-y-2&quot;>
                        <Label htmlFor=&quot;pointsRate&quot;>Points Earning Rate</Label>
                        <Input
                          id=&quot;pointsRate&quot;
                          type=&quot;number&quot;
                          defaultValue={program?.pointsPerAmount || 1}
                          placeholder=&quot;e.g., 1 (point per currency unit)&quot;
                        />
                        <p className=&quot;text-xs text-muted-foreground&quot;>
                          Number of points earned per currency unit spent
                        </p>
                      </div>
                      <div className=&quot;space-y-2&quot;>
                        <Label htmlFor=&quot;expiryMonths&quot;>Points Expiry Period (Months)</Label>
                        <Input
                          id=&quot;expiryMonths&quot;
                          type=&quot;number&quot;
                          defaultValue={program?.expiryMonths || 12}
                          placeholder=&quot;e.g., 12&quot;
                        />
                        <p className=&quot;text-xs text-muted-foreground&quot;>
                          Number of months of inactivity before points expire (0 for no expiry)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className=&quot;space-y-4&quot;>
                    <div className=&quot;flex justify-between&quot;>
                      <h3 className=&quot;text-lg font-medium&quot;>Loyalty Tiers</h3>
                      <Button variant=&quot;outline&quot;>Add New Tier</Button>
                    </div>
                    {program?.tiers && program.tiers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tier Name</TableHead>
                            <TableHead>Required Points</TableHead>
                            <TableHead>Point Multiplier</TableHead>
                            <TableHead className=&quot;text-right&quot;>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {program.tiers.map((_tier: LoyaltyTier) => (
                            <TableRow key={tier.id}>
                              <TableCell>{tier.name}</TableCell>
                              <TableCell>{formatNumber(tier.requiredPoints)}</TableCell>
                              <TableCell>{tier.pointMultiplier}x</TableCell>
                              <TableCell className=&quot;text-right&quot;>
                                <Button variant=&quot;ghost&quot; size=&quot;sm&quot;>
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className=&quot;text-center py-4 border rounded-lg&quot;>
                        <p className=&quot;text-muted-foreground&quot;>No tiers have been created yet</p>
                        <Button variant=&quot;outline&quot; className=&quot;mt-4&quot;>
                          Create Default Tiers
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className=&quot;flex justify-end&quot;>
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
