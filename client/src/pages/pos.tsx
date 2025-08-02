import { useEffect } from &apos;react&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useOfflineMode } from &apos;@/hooks/use-offline-mode&apos;;
import { useMutation, useQueryClient, useQuery } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { PosTerminal } from &apos;@/components/pos/pos-terminal&apos;;
import { CashierSessionManager } from &apos;@/components/pos/cashier-session&apos;;
import { Wifi, WifiOff } from &apos;lucide-react&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;

export default function PosPage() {
  const { user, logout } = useAuth();
  const { isOnline, offlineTransactions, clearSyncedTransactions } = useOfflineMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch store data
  const { _data: storeData } = useQuery({
    queryKey: [&apos;/api/stores&apos;, user?.storeId],
    _queryFn: async() => {
      if (!user?.storeId) return null;
      const res = await fetch(`/api/stores/${user.storeId}`);
      if (!res.ok) return null;
      return res.json();
    },
    _enabled: !!user?.storeId && isOnline
  });

  // Mutation for syncing offline transactions
  const syncMutation = useMutation({
    _mutationFn: async(_transactions: any[]) => {
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/pos/sync-offline-transactions&apos;, {
        transactions
      });
      return response.json();
    },
    _onSuccess: (data) => {
      const syncedIds = data.results
        .filter((_result: any) => result.success)
        .map((_result: any) => result.offlineId);

      if (syncedIds.length > 0) {
        clearSyncedTransactions(syncedIds);

        // Invalidate relevant queries
        queryClient.invalidateQueries({ _queryKey: [&apos;/api/dashboard/quick-stats&apos;] });
        queryClient.invalidateQueries({ _queryKey: [&apos;/api/dashboard/recent-transactions&apos;] });
        queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory&apos;] });

        toast({
          _title: &apos;Transactions synced&apos;,
          _description: `Successfully synced ${syncedIds.length} offline transaction(s).`
        });
      }

      const failedCount = data.results.filter((_result: any) => !result.success).length;
      if (failedCount > 0) {
        toast({
          _title: &apos;Sync partially failed&apos;,
          _description: `Failed to sync ${failedCount} offline transaction(s). They will be retried later.`,
          _variant: &apos;destructive&apos;
        });
      }
    },
    _onError: () => {
      toast({
        _title: &apos;Sync failed&apos;,
        _description: &apos;Failed to sync offline transactions. They will be retried later.&apos;,
        _variant: &apos;destructive&apos;
      });
    }
  });

  // Auto-sync offline transactions when coming back online
  useEffect(() => {
    if (isOnline && offlineTransactions.length > 0 && !syncMutation.isPending) {
      syncMutation.mutate(offlineTransactions);
    }
  }, [isOnline, offlineTransactions.length]);

  // Manual sync function
  const handleManualSync = () => {
    if (isOnline && offlineTransactions.length > 0) {
      syncMutation.mutate(offlineTransactions);
    }
  };

  return (
    <div className=&quot;min-h-screen bg-neutral-50&quot;>
      {/* Header */}
      <header className=&quot;bg-white border-b border-neutral-200 shadow-sm&quot;>
        <div className=&quot;container mx-auto px-4 py-4 flex justify-between items-center&quot;>
          <div className=&quot;flex items-center space-x-2&quot;>
            <svg className=&quot;w-8 h-8 text-primary&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;>
              <path d=&quot;M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z&quot; fill=&quot;currentColor&quot;/>
              <path d=&quot;M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z&quot; fill=&quot;currentColor&quot;/>
              <path d=&quot;M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z&quot; fill=&quot;currentColor&quot;/>
            </svg>
            <h1 className=&quot;text-xl font-bold&quot;>ChainSync POS</h1>
          </div>

          <div className=&quot;flex items-center space-x-4&quot;>
            {/* Network status */}
            <div className=&quot;flex items-center&quot;>
              {isOnline ? (
                <div className=&quot;flex items-center text-green-500&quot;>
                  <Wifi className=&quot;w-5 h-5 mr-1&quot; />
                  <span className=&quot;text-sm font-medium&quot;>Online</span>
                </div>
              ) : (
                <div className=&quot;flex items-center text-amber-500&quot;>
                  <WifiOff className=&quot;w-5 h-5 mr-1&quot; />
                  <span className=&quot;text-sm font-medium&quot;>Offline</span>
                </div>
              )}
            </div>

            {/* User info */}
            <div className=&quot;text-sm&quot;>
              <span className=&quot;font-medium&quot;>{user?.fullName}</span>
              <span className=&quot;text-neutral-500 ml-2&quot;>
                ({storeData ? storeData.name : `Store _ID: ${user?.storeId || &apos;None&apos;}`})
              </span>
            </div>

            {/* Logout button */}
            <Button
              variant=&quot;outline&quot;
              size=&quot;sm&quot;
              onClick={() => logout()}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className=&quot;container mx-auto px-4 py-6&quot;>
        {/* Offline transactions alert */}
        {isOnline && offlineTransactions.length > 0 && (
          <Alert className=&quot;mb-6 bg-amber-50 border-amber-200&quot;>
            <div className=&quot;flex items-center&quot;>
              <WifiOff className=&quot;h-4 w-4 text-amber-600 mr-2&quot; />
              <AlertTitle className=&quot;text-amber-600&quot;>Offline Transactions Pending</AlertTitle>
            </div>
            <AlertDescription className=&quot;flex justify-between items-center&quot;>
              <span className=&quot;text-amber-700&quot;>
                You have {offlineTransactions.length} transaction(s) that need to be synchronized.
              </span>
              <Button
                size=&quot;sm&quot;
                variant=&quot;outline&quot;
                className=&quot;border-amber-300 text-amber-700 _hover:bg-amber-100&quot;
                onClick={handleManualSync}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? &apos;Syncing...&apos; : &apos;Sync Now&apos;}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Cashier Session Manager */}
        <CashierSessionManager />

        {/* POS Terminal */}
        <PosTerminal />
      </main>

      {/* Footer */}
      <footer className=&quot;bg-white border-t border-neutral-200 py-2 text-center text-sm text-neutral-500 mt-auto&quot;>
        <div className=&quot;container mx-auto px-4&quot;>
          <p>ChainSync POS v1.0 &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
