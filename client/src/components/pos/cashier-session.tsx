import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Clock, TimerOff } from 'lucide-react';
import { formatCurrency, formatDateTime, formatDuration } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type CashierSession = {
  id: number;
  startTime: string;
  endTime: string | null;
  status: 'active' | 'closed';
  transactionCount: number;
  totalSales: string;
  notes: string | null;
  storeId: number;
  userId: number;
  store?: {
    id: number;
    name: string;
  };
};

export function CashierSessionManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Get stores the user has access to
  const storesQuery = useQuery({
    queryKey: ['/api/stores'],
  });

  // Get active session if any
  const activeSessionQuery = useQuery({
    queryKey: ['/api/pos/cashier-sessions/active'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async (data: { storeId: number; notes?: string }) => {
      return await apiRequest('POST', '/api/pos/cashier-sessions/start', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pos/cashier-sessions/active'] });
      setShowStartDialog(false);
      setNotes('');
      toast({
        title: "Session started",
        description: "Your cashier session has been started successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start session",
        description: error.message || "There was an error starting your session.",
        variant: "destructive",
      });
    }
  });

  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: async (data: { sessionId: number; notes?: string }) => {
      return await apiRequest('POST', '/api/pos/cashier-sessions/end', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pos/cashier-sessions/active'] });
      setShowEndDialog(false);
      setNotes('');
      toast({
        title: "Session ended",
        description: "Your cashier session has been ended successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to end session",
        description: error.message || "There was an error ending your session.",
        variant: "destructive",
      });
    }
  });

  // Calculate session duration 
  const calculateDuration = (startTime: string, endTime: string | null) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    return formatDuration(durationMs);
  };

  const activeSession = (activeSessionQuery.data as any)?.session as CashierSession | undefined;
  const stores = Array.isArray(storesQuery.data) ? storesQuery.data : [];

  const handleStartSession = () => {
    if (!selectedStore) {
      toast({
        title: "Store selection required",
        description: "Please select a store to start your session.",
        variant: "destructive",
      });
      return;
    }

    startSessionMutation.mutate({
      storeId: parseInt(selectedStore),
      notes: notes.trim() || undefined
    });
  };

  const handleEndSession = () => {
    if (!activeSession) return;

    endSessionMutation.mutate({
      sessionId: activeSession.id,
      notes: notes.trim() || undefined
    });
  };

  // Set default store selection if user only has one store
  useEffect(() => {
    if (Array.isArray(storesQuery.data) && storesQuery.data.length === 1 && !selectedStore) {
      setSelectedStore(storesQuery.data[0].id.toString());
    }
  }, [storesQuery.data, selectedStore]);

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Cashier Session</CardTitle>
          <CardDescription>
            Manage your current cashier session
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {activeSessionQuery.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : activeSession ? (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                <div>
                  <Badge className="mb-2" variant={activeSession.status === 'active' ? 'default' : 'secondary'}>
                    {activeSession.status === 'active' ? 'Active Session' : 'Closed Session'}
                  </Badge>
                  <h3 className="text-lg font-semibold">
                    {activeSession.store?.name || `Store #${activeSession.storeId}`}
                  </h3>
                </div>
                
                <div className="text-right">
                  <div className="text-muted-foreground text-sm">Started:</div>
                  <div className="font-medium">{formatDateTime(activeSession.startTime)}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-md p-3 bg-primary/5">
                  <div className="text-muted-foreground text-sm">Duration</div>
                  <div className="flex items-center mt-1">
                    <Clock className="h-4 w-4 mr-1 text-primary" />
                    <span className="text-lg font-semibold">
                      {calculateDuration(activeSession.startTime, activeSession.endTime)}
                    </span>
                  </div>
                </div>
                
                <div className="border rounded-md p-3 bg-primary/5">
                  <div className="text-muted-foreground text-sm">Transactions</div>
                  <div className="flex items-center mt-1">
                    <CheckCircle2 className="h-4 w-4 mr-1 text-primary" />
                    <span className="text-lg font-semibold">{activeSession.transactionCount}</span>
                  </div>
                </div>
                
                <div className="border rounded-md p-3 bg-primary/5">
                  <div className="text-muted-foreground text-sm">Total Sales</div>
                  <div className="flex items-center mt-1">
                    <span className="text-lg font-semibold">
                      {formatCurrency(parseFloat(activeSession.totalSales))}
                    </span>
                  </div>
                </div>
              </div>
              
              {activeSession.notes && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm text-muted-foreground">Notes:</p>
                  <p className="mt-1">{activeSession.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Active Session</AlertTitle>
              <AlertDescription>
                You need to start a cashier session before processing transactions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        
        <CardFooter className="border-t pt-4">
          {!activeSession || activeSession.status !== 'active' ? (
            <Button onClick={() => setShowStartDialog(true)}>
              Start New Session
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setShowEndDialog(true)}>
              <TimerOff className="mr-2 h-4 w-4" />
              End Session
            </Button>
          )}
        </CardFooter>
      </Card>
      
      {/* Start Session Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Cashier Session</DialogTitle>
            <DialogDescription>
              Select a store and start your shift. You'll need an active session to process transactions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="store">Store Location</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Store" />
                </SelectTrigger>
                <SelectContent>
                  {storesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : (
                    stores.map((store: any) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Session Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about this session"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={!selectedStore || startSessionMutation.isPending}
            >
              {startSessionMutation.isPending ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  Starting...
                </>
              ) : (
                "Start Session"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* End Session Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Cashier Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to end your current session? You won't be able to process transactions until you start a new session.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {activeSession && (
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-md p-3">
                  <div className="text-muted-foreground text-sm">Transactions</div>
                  <div className="text-lg font-medium">{activeSession.transactionCount}</div>
                </div>
                
                <div className="border rounded-md p-3">
                  <div className="text-muted-foreground text-sm">Total Sales</div>
                  <div className="text-lg font-medium">
                    {formatCurrency(parseFloat(activeSession.totalSales))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="end-notes">End Session Notes (Optional)</Label>
              <Textarea
                id="end-notes"
                placeholder="Add notes about this session"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndSession}
              disabled={endSessionMutation.isPending}
            >
              {endSessionMutation.isPending ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  Ending...
                </>
              ) : (
                "End Session"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}