import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import React from 'react';
import { Link } from 'wouter';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

interface RecentTransactionsProps {
  limit?: number;
}

interface TransactionItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  returnedQuantity?: number;
  product: {
    id: number;
    name: string;
    barcode: string;
    price: string;
  };
}

interface Transaction {
  id: number;
  transactionId: string;
  total: string | number;
  createdAt: string;
  status: string;
  isOfflineTransaction: boolean;
  syncedAt?: string;
  synced_at?: string; // Both variants might be present
  items?: TransactionItem[]; // Now optional as it might not be in the response
  store: {
    id: number;
    name: string;
  };
  cashier: {
    id: number;
    fullName?: string; // Might be missing
    username?: string; // Might have username instead
  };
}

export function RecentTransactions({ limit = 5 }: RecentTransactionsProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery<Transaction[]>({
    queryKey: [
      '/api/dashboard/recent-transactions',
      { limit, storeId: !isAdmin ? user?.storeId : undefined },
    ],
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Reusable transaction card skeleton
  const TransactionCardSkeleton = () => (
    <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
      <CardHeader className="px-6 py-4 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  // Handle loading state
  if (isLoading) {
    return <TransactionCardSkeleton />;
  }

  // Handle error state
  if (queryError) {
    return (
      <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <CardHeader className="px-6 py-4 border-b border-neutral-200">
          <CardTitle className="text-lg font-medium text-neutral-800">
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center p-6">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Error Loading Transactions</h3>
            <p className="text-sm text-neutral-500 mb-4">
              There was a problem loading the recent transactions. Please try again later.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check for empty data
  const hasTransactions = Array.isArray(data) && data.length > 0;

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
      <CardHeader className="px-6 py-4 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium text-neutral-800">
              Recent Transactions
            </CardTitle>
            <p className="text-sm text-neutral-500 mt-1">
              {isAdmin
                ? 'Latest transactions across all stores'
                : `Latest transactions for ${user?.storeId ? 'your store' : 'your stores'}`}
            </p>
          </div>
          <Link
            href="/analytics"
            className="text-sm text-primary-500 font-medium hover:text-primary-600"
          >
            View All
          </Link>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Transaction ID
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Store
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Cashier
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Items
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Total
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Time
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-neutral-200">
            {hasTransactions ? (
              data.map(transaction => {
                // Safely handle cases where nested properties might be undefined
                const safeTransaction = {
                  id: transaction?.id || 0,
                  transactionId: transaction?.transactionId || 'N/A',
                  total: transaction?.total || '0',
                  createdAt: transaction?.createdAt || new Date().toISOString(),
                  status: transaction?.status || 'unknown',
                  isOfflineTransaction: !!transaction?.isOfflineTransaction,
                  syncedAt: transaction?.syncedAt,
                  synced_at: transaction?.synced_at,
                  store: {
                    id: transaction?.store?.id || 0,
                    name: transaction?.store?.name || 'Unknown Store',
                  },
                  cashier: {
                    id: transaction?.cashier?.id || 0,
                    fullName: transaction?.cashier?.fullName,
                    username: transaction?.cashier?.username,
                  },
                  items: Array.isArray(transaction?.items) ? transaction.items : [],
                };

                // Calculate item count safely
                const itemCount = safeTransaction.items.length;

                // Format total correctly
                const formattedTotal =
                  typeof safeTransaction.total === 'string'
                    ? parseFloat(safeTransaction.total) || 0
                    : safeTransaction.total || 0;

                return (
                  <TableRow key={safeTransaction.id}>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800">
                      {safeTransaction.transactionId}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {safeTransaction.store.name}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {safeTransaction.cashier.fullName ||
                        safeTransaction.cashier.username ||
                        'Unknown'}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {itemCount}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800">
                      {formatCurrency(formattedTotal)}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      {formatTime(safeTransaction.createdAt)}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      {safeTransaction.status === 'completed' ? (
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-700 border-green-200"
                        >
                          Completed
                        </Badge>
                      ) : safeTransaction.status === 'pending' ? (
                        <Badge
                          variant="outline"
                          className="bg-amber-100 text-amber-700 border-amber-200"
                        >
                          Pending
                        </Badge>
                      ) : safeTransaction.isOfflineTransaction &&
                        !safeTransaction.syncedAt &&
                        !safeTransaction.synced_at ? (
                        <Badge
                          variant="outline"
                          className="bg-amber-100 text-amber-700 border-amber-200"
                        >
                          Syncing...
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                          {safeTransaction.status || 'Unknown'}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-neutral-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="w-12 h-12 text-neutral-300 mb-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9 12H15M9 16H15M19 4H5C3.89543 4 3 4.89543 3 6V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V6C21 4.89543 20.1046 4 19 4Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="text-base font-medium mb-1">No Transactions Found</p>
                    <p className="text-sm text-neutral-400">
                      There are no recent transactions to display
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-500">
            {hasTransactions
              ? `Showing ${data.length} of recent transactions`
              : 'No transactions available'}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" disabled className="px-3 py-1 text-sm">
              Previous
            </Button>
            <Button variant="outline" size="sm" className="px-3 py-1 text-sm" asChild>
              <Link href="/analytics">Next</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
