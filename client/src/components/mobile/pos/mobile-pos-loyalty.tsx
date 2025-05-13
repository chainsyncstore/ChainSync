import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Gift, BadgeCheck, User, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

interface MobilePosLoyaltyProps {
  customer: any;
  loyaltyMember: any;
  setLoyaltyMember: (member: any) => void;
}

export function MobilePosLoyalty({ 
  customer,
  loyaltyMember,
  setLoyaltyMember
}: MobilePosLoyaltyProps) {
  const [loyaltyId, setLoyaltyId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Fetch loyalty member by ID
  const handleLookupLoyalty = async () => {
    if (!loyaltyId.trim()) {
      setErrorMessage('Please enter a loyalty ID');
      return;
    }
    
    try {
      const response = await fetch(`/api/loyalty/lookup/${loyaltyId}`);
      const data = await response.json();
      
      if (response.ok) {
        setLoyaltyMember(data);
        setErrorMessage('');
      } else {
        setLoyaltyMember(null);
        setErrorMessage(data.message || 'Loyalty member not found');
      }
    } catch (error) {
      setLoyaltyMember(null);
      setErrorMessage('Error looking up loyalty membership');
    }
  };
  
  // Search for loyalty members
  const handleSearchMembers = async () => {
    if (!searchTerm.trim() || searchTerm.length < 3) {
      setErrorMessage('Please enter at least 3 characters to search');
      return;
    }
    
    setIsSearching(true);
    
    try {
      const response = await fetch(`/api/loyalty/search?term=${searchTerm}`);
      const data = await response.json();
      
      if (response.ok) {
        setSearchResults(data);
        setErrorMessage('');
      } else {
        setSearchResults([]);
        setErrorMessage(data.message || 'No loyalty members found');
      }
    } catch (error) {
      setSearchResults([]);
      setErrorMessage('Error searching for loyalty members');
    } finally {
      setIsSearching(false);
    }
  };
  
  // Select a loyalty member
  const handleSelectMember = (member: any) => {
    setLoyaltyMember(member);
    setSearchTerm('');
    setSearchResults([]);
  };
  
  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="lookup" className="flex-1">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="lookup">
            <Gift className="h-4 w-4 mr-2" />
            Lookup ID
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="lookup" className="flex-1">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter loyalty ID"
                  value={loyaltyId}
                  onChange={(e) => setLoyaltyId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLookupLoyalty();
                    }
                  }}
                />
                <Button onClick={handleLookupLoyalty}>
                  Lookup
                </Button>
              </div>
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
            </div>
            
            {loyaltyMember && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle>Loyalty Member</CardTitle>
                    <Badge>{loyaltyMember.loyaltyId}</Badge>
                  </div>
                  <CardDescription>
                    {loyaltyMember.customer?.fullName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Points</span>
                      <span className="font-semibold">{loyaltyMember.currentPoints}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Points Earned</span>
                      <span className="font-semibold">{loyaltyMember.totalPointsEarned}</span>
                    </div>
                    {loyaltyMember.tier && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Tier</span>
                        <Badge variant="outline" className="font-semibold">
                          <BadgeCheck className="h-3 w-3 mr-1 text-primary" />
                          {loyaltyMember.tier.name}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="search" className="space-y-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by name, email or phone"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchMembers();
                    }
                  }}
                />
              </div>
              <Button 
                onClick={handleSearchMembers}
                disabled={isSearching || searchTerm.length < 3}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
          </div>
          
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {isSearching ? (
                Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : searchResults.length > 0 ? (
                searchResults.map((member) => (
                  <Card 
                    key={member.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectMember(member)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{member.customer?.fullName}</p>
                              <p className="text-sm text-muted-foreground">
                                ID: {member.loyaltyId}
                              </p>
                            </div>
                            <Badge>{member.currentPoints} pts</Badge>
                          </div>
                          {member.tier && (
                            <Badge variant="outline" className="mt-1">
                              <BadgeCheck className="h-3 w-3 mr-1 text-primary" />
                              {member.tier.name}
                            </Badge>
                          )}
                          {loyaltyMember?.id === member.id && (
                            <div className="mt-2 flex items-center text-green-600 text-sm">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Selected
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : searchTerm.length >= 3 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No loyalty members found.
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Enter at least 3 characters to search.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}