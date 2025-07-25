import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Receipt } from 'lucide-react';

export default function Sales() {
  const { data: transactions = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/transactions?storeId=1&limit=10'],
  });

  const { data: salesData = { totalSales: 0 }, isLoading: isSalesLoading } = useQuery<{ totalSales: number }>({
    queryKey: ['/api/analytics/sales?storeId=1'],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Sales Management</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track transactions and sales performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${salesData?.totalSales?.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : transactions.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+0%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
                  </div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16" />
                </div>
              ))}
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-4">
              {transactions.map((transaction: any) => (
                <div key={transaction.id} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
                  <div>
                    <div className="font-semibold">Transaction #{transaction.id}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(transaction.createdAt).toLocaleDateString()} • {transaction.paymentMethod}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${transaction.total}</div>
                    <Badge 
                      variant={transaction.status === 'completed' ? 'default' : 
                               transaction.status === 'pending' ? 'secondary' : 'destructive'}
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No transactions found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Sales transactions will appear here once you start processing orders.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}