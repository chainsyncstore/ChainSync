import React, { useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useOfflineMode } from '@/hooks/use-offline-mode';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { PosTerminal } from '@/components/pos/pos-terminal';
import { Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PosPage() {
  const { user } = useAuth();
  const { isOnline, offlineTransactions, clearSyncedTransactions } = useOfflineMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Mutation for syncing offline transactions
  const syncMutation = useMutation({
    mutationFn: async (transactions: any[]) => {
      const response = await apiRequest('POST', '/api/pos/sync-offline-transactions', {
        transactions
      });
      return response.json();
    },
    onSuccess: (data) => {
      const syncedIds = data.results
        .filter((result: any) => result.success)
        .map((result: any) => result.offlineId);
      
      if (syncedIds.length > 0) {
        clearSyncedTransactions(syncedIds);
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/quick-stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
        
        toast({
          title: "Transactions synced",
          description: `Successfully synced ${syncedIds.length} offline transaction(s).`,
        });
      }
      
      const failedCount = data.results.filter((result: any) => !result.success).length;
      if (failedCount > 0) {
        toast({
          title: "Sync partially failed",
          description: `Failed to sync ${failedCount} offline transaction(s). They will be retried later.`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync offline transactions. They will be retried later.",
        variant: "destructive",
      });
    },
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
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/>
              <path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/>
              <path d="M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z" fill="currentColor"/>
            </svg>
            <h1 className="text-xl font-bold">ChainSync POS</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Network status */}
            <div className="flex items-center">
              {isOnline ? (
                <div className="flex items-center text-green-500">
                  <Wifi className="w-5 h-5 mr-1" />
                  <span className="text-sm font-medium">Online</span>
                </div>
              ) : (
                <div className="flex items-center text-amber-500">
                  <WifiOff className="w-5 h-5 mr-1" />
                  <span className="text-sm font-medium">Offline</span>
                </div>
              )}
            </div>
            
            {/* User info */}
            <div className="text-sm">
              <span className="font-medium">{user?.fullName}</span>
              <span className="text-neutral-500 ml-2">({user?.store?.name || 'No Store'})</span>
            </div>
            
            {/* Logout button */}
            <Button variant="outline" size="sm" asChild>
              <a href="/login">Logout</a>
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Offline transactions alert */}
        {isOnline && offlineTransactions.length > 0 && (
          <Alert className="mb-6 bg-amber-50 border-amber-200">
            <div className="flex items-center">
              <WifiOff className="h-4 w-4 text-amber-600 mr-2" />
              <AlertTitle className="text-amber-600">Offline Transactions Pending</AlertTitle>
            </div>
            <AlertDescription className="flex justify-between items-center">
              <span className="text-amber-700">
                You have {offlineTransactions.length} transaction(s) that need to be synchronized.
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={handleManualSync}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? "Syncing..." : "Sync Now"}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* POS Terminal */}
        <PosTerminal />
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 py-2 text-center text-sm text-neutral-500 mt-auto">
        <div className="container mx-auto px-4">
          <p>ChainSync POS v1.0 &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
