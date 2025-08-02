import React from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { Link } from &apos;wouter&apos;;
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { formatCurrency, formatDate, formatTime } from &apos;@/lib/utils&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { AlertCircle } from &apos;lucide-react&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;

interface RecentTransactionsProps {
  limit?: number;
}

interface TransactionItem {
  _id: number;
  _productId: number;
  _quantity: number;
  _unitPrice: string;
  _subtotal: string;
  returnedQuantity?: number;
  product: {
    _id: number;
    _name: string;
    _barcode: string;
    _price: string;
  };
}

interface Transaction {
  _id: number;
  _transactionId: string;
  _total: string | number;
  _createdAt: string;
  _status: string;
  _isOfflineTransaction: boolean;
  syncedAt?: string;
  synced_at?: string; // Both variants might be present
  items?: TransactionItem[]; // Now optional as it might not be in the response
  store: {
    _id: number;
    _name: string;
  };
  cashier: {
    _id: number;
    fullName?: string; // Might be missing
    username?: string; // Might have username instead
  };
}

export function RecentTransactions({ limit = 5 }: RecentTransactionsProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === &apos;admin&apos;;

  const { data, isLoading, _error: queryError } = useQuery<Transaction[]>({
    queryKey: [&apos;/api/dashboard/recent-transactions&apos;, { limit, _storeId: !isAdmin ? user?._storeId : undefined }],
    _retry: 2,
    _staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Reusable transaction card skeleton
  const TransactionCardSkeleton = () => (
    <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200&quot;>
      <CardHeader className=&quot;px-6 py-4 border-b border-neutral-200&quot;>
        <div className=&quot;flex items-center justify-between&quot;>
          <div>
            <Skeleton className=&quot;h-5 w-48 mb-2&quot; />
            <Skeleton className=&quot;h-4 w-64&quot; />
          </div>
          <Skeleton className=&quot;h-8 w-16&quot; />
        </div>
      </CardHeader>
      <div className=&quot;overflow-x-auto&quot;>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Skeleton className=&quot;h-4 w-24&quot; />
              </TableHead>
              <TableHead>
                <Skeleton className=&quot;h-4 w-20&quot; />
              </TableHead>
              <TableHead>
                <Skeleton className=&quot;h-4 w-24&quot; />
              </TableHead>
              <TableHead>
                <Skeleton className=&quot;h-4 w-12&quot; />
              </TableHead>
              <TableHead>
                <Skeleton className=&quot;h-4 w-16&quot; />
              </TableHead>
              <TableHead>
                <Skeleton className=&quot;h-4 w-16&quot; />
              </TableHead>
              <TableHead>
                <Skeleton className=&quot;h-4 w-20&quot; />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className=&quot;h-4 w-24&quot; />
                </TableCell>
                <TableCell>
                  <Skeleton className=&quot;h-4 w-20&quot; />
                </TableCell>
                <TableCell>
                  <Skeleton className=&quot;h-4 w-24&quot; />
                </TableCell>
                <TableCell>
                  <Skeleton className=&quot;h-4 w-12&quot; />
                </TableCell>
                <TableCell>
                  <Skeleton className=&quot;h-4 w-16&quot; />
                </TableCell>
                <TableCell>
                  <Skeleton className=&quot;h-4 w-16&quot; />
                </TableCell>
                <TableCell>
                  <Skeleton className=&quot;h-4 w-20&quot; />
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
      <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200&quot;>
        <CardHeader className=&quot;px-6 py-4 border-b border-neutral-200&quot;>
          <CardTitle className=&quot;text-lg font-medium text-neutral-800&quot;>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className=&quot;py-6&quot;>
          <div className=&quot;flex flex-col items-center justify-center text-center p-6&quot;>
            <AlertCircle className=&quot;h-12 w-12 text-red-500 mb-4&quot; />
            <h3 className=&quot;text-lg font-medium mb-2&quot;>Error Loading Transactions</h3>
            <p className=&quot;text-sm text-neutral-500 mb-4&quot;>
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
    <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200&quot;>
      <CardHeader className=&quot;px-6 py-4 border-b border-neutral-200&quot;>
        <div className=&quot;flex items-center justify-between&quot;>
          <div>
            <CardTitle className=&quot;text-lg font-medium text-neutral-800&quot;>Recent Transactions</CardTitle>
            <p className=&quot;text-sm text-neutral-500 mt-1&quot;>
              {isAdmin
                ? &apos;Latest transactions across all stores&apos;
                : `Latest transactions for ${user?.storeId ? &apos;your store&apos; : &apos;your stores&apos;}`
              }
            </p>
          </div>
          <Link href=&quot;/analytics&quot; className=&quot;text-sm text-primary-500 font-medium _hover:text-primary-600&quot;>
            View All
          </Link>
        </div>
      </CardHeader>
      <div className=&quot;overflow-x-auto&quot;>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className=&quot;px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider&quot;>Transaction ID</TableHead>
              <TableHead className=&quot;px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider&quot;>Store</TableHead>
              <TableHead className=&quot;px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider&quot;>Cashier</TableHead>
              <TableHead className=&quot;px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider&quot;>Items</TableHead>
              <TableHead className=&quot;px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider&quot;>Total</TableHead>
              <TableHead className=&quot;px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider&quot;>Time</TableHead>
              <TableHead className=&quot;px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider&quot;>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className=&quot;bg-white divide-y divide-neutral-200&quot;>
            {hasTransactions ? data.map((transaction) => {
              // Safely handle cases where nested properties might be undefined
              const safeTransaction = {
                _id: transaction?.id || 0,
                _transactionId: transaction?.transactionId || &apos;N/A&apos;,
                _total: transaction?.total || &apos;0&apos;,
                _createdAt: transaction?.createdAt || new Date().toISOString(),
                _status: transaction?.status || &apos;unknown&apos;,
                _isOfflineTransaction: !!transaction?.isOfflineTransaction,
                _syncedAt: transaction?.syncedAt,
                _synced_at: transaction?.synced_at,
                _store: {
                  _id: transaction?.store?.id || 0,
                  _name: transaction?.store?.name || &apos;Unknown Store&apos;
                },
                _cashier: {
                  _id: transaction?.cashier?.id || 0,
                  _fullName: transaction?.cashier?.fullName,
                  _username: transaction?.cashier?.username
                },
                _items: Array.isArray(transaction?.items) ? transaction.items : []
              };

              // Calculate item count safely
              const itemCount = safeTransaction.items.length;

              // Format total correctly
              const formattedTotal = typeof safeTransaction.total === &apos;string&apos;
                ? parseFloat(safeTransaction.total) || _0
                : (safeTransaction.total || 0);

              return (
                <TableRow key={safeTransaction.id}>
                  <TableCell className=&quot;px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800&quot;>
                    {safeTransaction.transactionId}
                  </TableCell>
                  <TableCell className=&quot;px-6 py-4 whitespace-nowrap text-sm text-neutral-600&quot;>
                    {safeTransaction.store.name}
                  </TableCell>
                  <TableCell className=&quot;px-6 py-4 whitespace-nowrap text-sm text-neutral-600&quot;>
                    {safeTransaction.cashier.fullName || safeTransaction.cashier.username || &apos;Unknown&apos;}
                  </TableCell>
                  <TableCell className=&quot;px-6 py-4 whitespace-nowrap text-sm text-neutral-600&quot;>
                    {itemCount}
                  </TableCell>
                  <TableCell className=&quot;px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800&quot;>
                    {formatCurrency(formattedTotal)}
                  </TableCell>
                  <TableCell className=&quot;px-6 py-4 whitespace-nowrap text-sm text-neutral-600&quot;>
                    {formatTime(safeTransaction.createdAt)}
                  </TableCell>
                  <TableCell className=&quot;px-6 py-4 whitespace-nowrap&quot;>
                    {safeTransaction.status === &apos;completed&apos; ? (
                      <Badge variant=&quot;outline&quot; className=&quot;bg-green-100 text-green-700 border-green-200&quot;>
                        Completed
                      </Badge>
                    ) : safeTransaction.status === &apos;pending&apos; ? (
                      <Badge variant=&quot;outline&quot; className=&quot;bg-amber-100 text-amber-700 border-amber-200&quot;>
                        Pending
                      </Badge>
                    ) : safeTransaction.isOfflineTransaction && !safeTransaction.syncedAt && !safeTransaction.synced_at ?
  (
                      <Badge variant=&quot;outline&quot; className=&quot;bg-amber-100 text-amber-700 border-amber-200&quot;>
                        Syncing...
                      </Badge>
                    ) : (
                      <Badge variant=&quot;outline&quot; className=&quot;bg-red-100 text-red-700 border-red-200&quot;>
                        {safeTransaction.status || &apos;Unknown&apos;}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={7} className=&quot;text-center py-8 text-neutral-500&quot;>
                  <div className=&quot;flex flex-col items-center justify-center&quot;>
                    <svg className=&quot;w-12 h-12 text-neutral-300 mb-3&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;>
                      <path d=&quot;M9 12H15M9 16H15M19 4H5C3.89543 4 3 4.89543 3 6V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V6C21 4.89543 20.1046 4 19 4Z&quot; stroke=&quot;currentColor&quot; strokeWidth=&quot;2&quot; strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; />
                    </svg>
                    <p className=&quot;text-base font-medium mb-1&quot;>No Transactions Found</p>
                    <p className=&quot;text-sm text-neutral-400&quot;>
                      There are no recent transactions to display
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className=&quot;px-6 py-4 border-t border-neutral-200 bg-neutral-50&quot;>
        <div className=&quot;flex items-center justify-between&quot;>
          <div className=&quot;text-sm text-neutral-500&quot;>
            {hasTransactions
              ? `Showing ${data.length} of recent transactions`
              : &apos;No transactions available&apos;
            }
          </div>
          <div className=&quot;flex space-x-2&quot;>
            <Button
              variant=&quot;outline&quot;
              size=&quot;sm&quot;
              disabled
              className=&quot;px-3 py-1 text-sm&quot;
            >
              Previous
            </Button>
            <Button
              variant=&quot;outline&quot;
              size=&quot;sm&quot;
              className=&quot;px-3 py-1 text-sm&quot;
              asChild
            >
              <Link href=&quot;/analytics&quot;>Next</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
