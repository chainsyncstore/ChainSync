import React, { useState, useEffect } from &apos;react&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from &apos;@/components/ui/dialog&apos;;
import { Textarea } from &apos;@/components/ui/textarea&apos;;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from &apos;@/components/ui/select&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { AlertCircle, CheckCircle2, Clock, TimerOff } from &apos;lucide-react&apos;;
import { formatCurrency, formatDateTime, formatDuration } from &apos;@/lib/utils&apos;;
import { apiRequest, queryClient } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;

type CashierSession = {
  _id: number;
  _startTime: string;
  _endTime: string | null;
  status: &apos;active&apos; | &apos;closed&apos;;
  _transactionCount: number;
  _totalSales: string;
  _notes: string | null;
  _storeId: number;
  _userId: number;
  store?: {
    _id: number;
    _name: string;
  };
};

export function CashierSessionManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>(&apos;&apos;);
  const [notes, setNotes] = useState(&apos;&apos;);

  // Get stores the user has access to
  const storesQuery = useQuery({
    _queryKey: [&apos;/api/stores&apos;]
  });

  // Get active session if any
  const activeSessionQuery = useQuery({
    _queryKey: [&apos;/api/pos/cashier-sessions/active&apos;],
    _refetchInterval: 60000 // Refresh every minute
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    _mutationFn: async(data: { _storeId: number; notes?: string }) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/pos/cashier-sessions/start&apos;, data);
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/pos/cashier-sessions/active&apos;] });
      setShowStartDialog(false);
      setNotes(&apos;&apos;);
      toast({
        _title: &apos;Session started&apos;,
        _description: &apos;Your cashier session has been started successfully.&apos;
      });
    },
    _onError: (_error: any) => {
      toast({
        _title: &apos;Failed to start session&apos;,
        _description: error.message || &apos;There was an error starting your session.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // End session mutation
  const endSessionMutation = useMutation({
    _mutationFn: async(data: { _sessionId: number; notes?: string }) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/pos/cashier-sessions/end&apos;, data);
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/pos/cashier-sessions/active&apos;] });
      setShowEndDialog(false);
      setNotes(&apos;&apos;);
      toast({
        _title: &apos;Session ended&apos;,
        _description: &apos;Your cashier session has been ended successfully.&apos;
      });
    },
    _onError: (_error: any) => {
      toast({
        _title: &apos;Failed to end session&apos;,
        _description: error.message || &apos;There was an error ending your session.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Calculate session duration
  const calculateDuration = (_startTime: string, _endTime: string | null) => {
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
        _title: &apos;Store selection required&apos;,
        _description: &apos;Please select a store to start your session.&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    startSessionMutation.mutate({
      _storeId: parseInt(selectedStore),
      _notes: notes.trim() || undefined
    });
  };

  const handleEndSession = () => {
    if (!activeSession) return;

    endSessionMutation.mutate({
      _sessionId: activeSession.id,
      _notes: notes.trim() || undefined
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
      <Card className=&quot;mb-4&quot;>
        <CardHeader className=&quot;pb-2&quot;>
          <CardTitle className=&quot;text-lg&quot;>Cashier Session</CardTitle>
          <CardDescription>
            Manage your current cashier session
          </CardDescription>
        </CardHeader>

        <CardContent>
          {activeSessionQuery.isLoading ? (
            <div className=&quot;flex items-center justify-center py-4&quot;>
              <div className=&quot;h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent&quot; />
            </div>
          ) : activeSession ? (
            <div className=&quot;space-y-4&quot;>
              <div className=&quot;flex flex-col _md:flex-row _md:justify-between _md:items-center gap-2&quot;>
                <div>
                  <Badge className=&quot;mb-2&quot; variant={activeSession.status === &apos;active&apos; ? &apos;default&apos; : &apos;secondary&apos;}>
                    {activeSession.status === &apos;active&apos; ? &apos;Active Session&apos; : &apos;Closed Session&apos;}
                  </Badge>
                  <h3 className=&quot;text-lg font-semibold&quot;>
                    {activeSession.store?.name || `Store #${activeSession.storeId}`}
                  </h3>
                </div>

                <div className=&quot;text-right&quot;>
                  <div className=&quot;text-muted-foreground text-sm&quot;>Started:</div>
                  <div className=&quot;font-medium&quot;>{formatDateTime(activeSession.startTime)}</div>
                </div>
              </div>

              <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4&quot;>
                <div className=&quot;border rounded-md p-3 bg-primary/5&quot;>
                  <div className=&quot;text-muted-foreground text-sm&quot;>Duration</div>
                  <div className=&quot;flex items-center mt-1&quot;>
                    <Clock className=&quot;h-4 w-4 mr-1 text-primary&quot; />
                    <span className=&quot;text-lg font-semibold&quot;>
                      {calculateDuration(activeSession.startTime, activeSession.endTime)}
                    </span>
                  </div>
                </div>

                <div className=&quot;border rounded-md p-3 bg-primary/5&quot;>
                  <div className=&quot;text-muted-foreground text-sm&quot;>Transactions</div>
                  <div className=&quot;flex items-center mt-1&quot;>
                    <CheckCircle2 className=&quot;h-4 w-4 mr-1 text-primary&quot; />
                    <span className=&quot;text-lg font-semibold&quot;>{activeSession.transactionCount}</span>
                  </div>
                </div>

                <div className=&quot;border rounded-md p-3 bg-primary/5&quot;>
                  <div className=&quot;text-muted-foreground text-sm&quot;>Total Sales</div>
                  <div className=&quot;flex items-center mt-1&quot;>
                    <span className=&quot;text-lg font-semibold&quot;>
                      {formatCurrency(parseFloat(activeSession.totalSales))}
                    </span>
                  </div>
                </div>
              </div>

              {activeSession.notes && (
                <div className=&quot;mt-4 border-t pt-4&quot;>
                  <p className=&quot;text-sm text-muted-foreground&quot;>Notes:</p>
                  <p className=&quot;mt-1&quot;>{activeSession.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <Alert>
              <AlertCircle className=&quot;h-4 w-4&quot; />
              <AlertTitle>No Active Session</AlertTitle>
              <AlertDescription>
                You need to start a cashier session before processing transactions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className=&quot;border-t pt-4&quot;>
          {!activeSession || activeSession.status !== &apos;active&apos; ? (
            <Button onClick={() => setShowStartDialog(true)}>
              Start New Session
            </Button>
          ) : (
            <Button variant=&quot;destructive&quot; onClick={() => setShowEndDialog(true)}>
              <TimerOff className=&quot;mr-2 h-4 w-4&quot; />
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
              Select a store and start your shift. You&apos;ll need an active session to process transactions.
            </DialogDescription>
          </DialogHeader>

          <div className=&quot;space-y-4 py-4&quot;>
            <div className=&quot;space-y-2&quot;>
              <Label htmlFor=&quot;store&quot;>Store Location</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder=&quot;Select Store&quot; />
                </SelectTrigger>
                <SelectContent>
                  {storesQuery.isLoading ? (
                    <div className=&quot;flex items-center justify-center py-2&quot;>
                      <div className=&quot;h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent&quot; />
                    </div>
                  ) : (
                    stores.map((_store: any) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className=&quot;space-y-2&quot;>
              <Label htmlFor=&quot;notes&quot;>Session Notes (Optional)</Label>
              <Textarea
                id=&quot;notes&quot;
                placeholder=&quot;Add notes about this session&quot;
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant=&quot;outline&quot; onClick={() => setShowStartDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={!selectedStore || startSessionMutation.isPending}
            >
              {startSessionMutation.isPending ? (
                <>
                  <div className=&quot;h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent&quot; />
                  Starting...
                </>
              ) : (
                &apos;Start Session&apos;
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
              Are you sure you want to end your current session? You won&apos;t be able to process transactions until you start a new session.
            </DialogDescription>
          </DialogHeader>

          <div className=&quot;space-y-4 py-4&quot;>
            {activeSession && (
              <div className=&quot;grid grid-cols-2 gap-4&quot;>
                <div className=&quot;border rounded-md p-3&quot;>
                  <div className=&quot;text-muted-foreground text-sm&quot;>Transactions</div>
                  <div className=&quot;text-lg font-medium&quot;>{activeSession.transactionCount}</div>
                </div>

                <div className=&quot;border rounded-md p-3&quot;>
                  <div className=&quot;text-muted-foreground text-sm&quot;>Total Sales</div>
                  <div className=&quot;text-lg font-medium&quot;>
                    {formatCurrency(parseFloat(activeSession.totalSales))}
                  </div>
                </div>
              </div>
            )}

            <div className=&quot;space-y-2&quot;>
              <Label htmlFor=&quot;end-notes&quot;>End Session Notes (Optional)</Label>
              <Textarea
                id=&quot;end-notes&quot;
                placeholder=&quot;Add notes about this session&quot;
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant=&quot;outline&quot; onClick={() => setShowEndDialog(false)}>
              Cancel
            </Button>
            <Button
              variant=&quot;destructive&quot;
              onClick={handleEndSession}
              disabled={endSessionMutation.isPending}
            >
              {endSessionMutation.isPending ? (
                <>
                  <div className=&quot;h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent&quot; />
                  Ending...
                </>
              ) : (
                &apos;End Session&apos;
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
