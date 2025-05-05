import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Store, 
  TrendingUp, 
  TrendingDown 
} from 'lucide-react';

interface QuickStatsProps {
  storeId?: number;
}

export function QuickStats({ storeId }: QuickStatsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/dashboard/quick-stats', storeId],
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
              <div className="mt-4">
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {/* Total Sales */}
      <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Total Sales (Today)</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(data?.salesTotal || 0)}</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-full">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {parseFloat(data?.salesChange || '0') >= 0 ? (
              <span className="text-green-500 text-sm font-medium flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                {formatNumber(data?.salesChange || 0, 1)}%
              </span>
            ) : (
              <span className="text-red-500 text-sm font-medium flex items-center">
                <TrendingDown className="w-4 h-4 mr-1" />
                {formatNumber(Math.abs(parseFloat(data?.salesChange || '0')), 1)}%
              </span>
            )}
            <span className="text-neutral-500 text-sm ml-2">vs Yesterday</span>
          </div>
        </CardContent>
      </Card>

      {/* Total Transactions */}
      <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Transactions (Today)</p>
              <p className="text-2xl font-bold mt-1">{formatNumber(data?.transactionsCount || 0)}</p>
            </div>
            <div className="p-3 bg-secondary-50 rounded-full">
              <ShoppingCart className="w-6 h-6 text-secondary" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {parseFloat(data?.transactionsChange || '0') >= 0 ? (
              <span className="text-green-500 text-sm font-medium flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                {formatNumber(data?.transactionsChange || 0, 1)}%
              </span>
            ) : (
              <span className="text-red-500 text-sm font-medium flex items-center">
                <TrendingDown className="w-4 h-4 mr-1" />
                {formatNumber(Math.abs(parseFloat(data?.transactionsChange || '0')), 1)}%
              </span>
            )}
            <span className="text-neutral-500 text-sm ml-2">vs Yesterday</span>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Alerts */}
      <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Low Stock Items</p>
              <p className="text-2xl font-bold mt-1">{data?.lowStockCount || 0}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-full">
              <Package className="w-6 h-6 text-amber-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {Number(data?.lowStockChange || 0) > 0 ? (
              <span className="text-amber-500 text-sm font-medium flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                +{data?.lowStockChange}
              </span>
            ) : Number(data?.lowStockChange || 0) < 0 ? (
              <span className="text-green-500 text-sm font-medium flex items-center">
                <TrendingDown className="w-4 h-4 mr-1" />
                {Math.abs(Number(data?.lowStockChange || 0))}
              </span>
            ) : (
              <span className="text-neutral-500 text-sm font-medium flex items-center">
                No change
              </span>
            )}
            <span className="text-neutral-500 text-sm ml-2">since yesterday</span>
          </div>
        </CardContent>
      </Card>

      {/* Active Stores */}
      <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Active Stores</p>
              <p className="text-2xl font-bold mt-1">{data?.activeStoresCount || 0}/{data?.totalStoresCount || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Store className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {data?.activeStoresCount === data?.totalStoresCount ? (
              <span className="text-green-500 text-sm font-medium flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                All stores online
              </span>
            ) : (
              <span className="text-amber-500 text-sm font-medium flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                {data?.totalStoresCount - data?.activeStoresCount} stores offline
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
