import { useState, useEffect, useCallback } from 'react';

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineTransactions, setOfflineTransactions] = useState<any[]>([]);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load any saved offline transactions from localStorage
    const savedTransactions = localStorage.getItem('offlineTransactions');
    if (savedTransactions) {
      try {
        setOfflineTransactions(JSON.parse(savedTransactions));
      } catch (error) {
        console.error('Failed to parse offline transactions:', error);
        localStorage.removeItem('offlineTransactions');
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save offline transactions
  const saveOfflineTransaction = useCallback((transaction: any) => {
    // Add an offline ID for tracking
    const transactionWithId = {
      ...transaction,
      offlineId: `offline-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    setOfflineTransactions(prevTransactions => {
      const updatedTransactions = [...prevTransactions, transactionWithId];
      localStorage.setItem('offlineTransactions', JSON.stringify(updatedTransactions));
      return updatedTransactions;
    });

    return transactionWithId;
  }, []);

  // Clear synced transactions
  const clearSyncedTransactions = useCallback((syncedIds: string[]) => {
    setOfflineTransactions(prevTransactions => {
      const remainingTransactions = prevTransactions.filter(
        transaction => !syncedIds.includes(transaction.offlineId)
      );

      localStorage.setItem('offlineTransactions', JSON.stringify(remainingTransactions));
      return remainingTransactions;
    });
  }, []);

  return {
    isOnline,
    offlineTransactions,
    saveOfflineTransaction,
    clearSyncedTransactions,
    hasPendingTransactions: offlineTransactions.length > 0,
  };
}
