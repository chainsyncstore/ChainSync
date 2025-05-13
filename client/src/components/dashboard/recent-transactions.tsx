import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
  
  const { data, isLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/dashboard/recent-transactions', { limit, storeId: !isAdmin ? user?.storeId : undefined }],
  });

  if (isLoading) {
    return (
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
  }

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
      <CardHeader className="px-6 py-4 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium text-neutral-800">Recent Transactions</CardTitle>
            <p className="text-sm text-neutral-500 mt-1">
              {isAdmin 
                ? 'Latest transactions across all stores' 
                : `Latest transactions for ${user?.storeId ? 'your store' : 'your stores'}`
              }
            </p>
          </div>
          <Link href="/analytics" className="text-sm text-primary-500 font-medium hover:text-primary-600">
            View All
          </Link>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Transaction ID</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Store</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cashier</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Items</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Total</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Time</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-neutral-200">
            {data && data.length > 0 ? data.map((transaction) => {
              // Handle case where items might be undefined or not an array
              const itemCount = transaction.items && Array.isArray(transaction.items) 
                ? transaction.items.length 
                : 0;
              
              return (
                <TableRow key={transaction.id}>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800">
                    {transaction.transactionId}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {transaction.store.name}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {transaction.cashier?.fullName || transaction.cashier?.username || 'Unknown'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {itemCount}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800">
                    {formatCurrency(typeof transaction.total === 'string' ? parseFloat(transaction.total) : transaction.total)}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                    {formatTime(transaction.createdAt)}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    {transaction.status === 'completed' ? (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                        Completed
                      </Badge>
                    ) : transaction.status === 'pending' ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                        Pending
                      </Badge>
                    ) : transaction.isOfflineTransaction && !transaction.syncedAt && !transaction.synced_at ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                        Syncing...
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                        {transaction.status}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-neutral-500">
                  No transactions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-500">
            Showing {data?.length || 0} of recent transactions
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="px-3 py-1 text-sm"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-3 py-1 text-sm"
              asChild
            >
              <Link href="/analytics">Next</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
