import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/providers/auth-provider';
import { formatNumber } from '@/lib/utils';

export function LowStockAlerts() {
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ['/api/inventory/low-stock'],
    refetchInterval: 60000, // Refetch every minute to keep alerts current
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-green-500" />
            Inventory Status
          </CardTitle>
          <CardDescription>
            All products are well-stocked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              There are no low stock items at this time.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/inventory">
                <span>View All Inventory</span>
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
          Low Stock Alerts
        </CardTitle>
        <CardDescription>
          {data.length} {data.length === 1 ? 'product needs' : 'products need'} attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[300px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Minimum</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.product.name}
                  </TableCell>
                  <TableCell>{item.store.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(item.quantity)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(item.minimumLevel)}
                  </TableCell>
                  <TableCell>
                    {item.quantity <= 0 ? (
                      <Badge variant="destructive">Out of Stock</Badge>
                    ) : (
                      <Badge variant="destructive">Low Stock</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {user?.role !== 'cashier' && (
          <div className="mt-4 flex justify-end">
            <Button asChild>
              <Link href="/inventory">View All Inventory</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
