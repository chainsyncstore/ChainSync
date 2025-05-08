import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Store, 
  TrendingUp, 
  TrendingDown, 
  Building
} from 'lucide-react';

interface QuickStatsProps {
  storeId?: number;
}

// Define types for the data returned from the API
interface QuickStatsData {
  salesTotal: string;
  salesChange: string;
  transactionsCount: number;
  transactionsChange: string;
  lowStockCount: number;
  lowStockChange: number;
  activeStoresCount: number;
  totalStoresCount: number;
}

interface StoreData {
  id: number;
  name: string;
  address: string;
  isActive: boolean;
}

export function QuickStats({ storeId }: QuickStatsProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // For store-specific query to get store details
  const { data: storeData } = useQuery<StoreData>({
    queryKey: ['/api/stores', user?.storeId],
    enabled: !isAdmin && !!user?.storeId,
  });
  
  const { data, isLoading } = useQuery<QuickStatsData>({
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

  // Safely use the data with fallback values
  const statsData = data || {
    salesTotal: '0',
    salesChange: '0',
    transactionsCount: 0,
    transactionsChange: '0',
    lowStockCount: 0,
    lowStockChange: 0,
    activeStoresCount: 0,
    totalStoresCount: 0
  };
  
  return (
    <React.Fragment>
      {!isAdmin && storeData && (
        <Card className="mb-6 bg-white border border-neutral-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-primary-50 to-secondary-50 p-6 flex items-center">
            <div className="p-3 bg-white rounded-full mr-4 shadow">
              <Building className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-medium text-neutral-800">
                {storeData?.name || 'Store Dashboard'}
              </CardTitle>
              <p className="text-sm text-neutral-600 mt-1">
                You are viewing data for your assigned store
              </p>
            </div>
          </div>
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Total Sales */}
        <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Total Sales (Today)</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(statsData.salesTotal)}</p>
              </div>
              <div className="p-3 bg-primary-50 rounded-full">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {parseFloat(statsData.salesChange) >= 0 ? (
                <span className="text-green-500 text-sm font-medium flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  {formatNumber(statsData.salesChange, 1)}%
                </span>
              ) : (
                <span className="text-red-500 text-sm font-medium flex items-center">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  {formatNumber(Math.abs(parseFloat(statsData.salesChange)), 1)}%
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
                <p className="text-2xl font-bold mt-1">{formatNumber(statsData.transactionsCount)}</p>
              </div>
              <div className="p-3 bg-secondary-50 rounded-full">
                <ShoppingCart className="w-6 h-6 text-secondary" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {parseFloat(statsData.transactionsChange) >= 0 ? (
                <span className="text-green-500 text-sm font-medium flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  {formatNumber(statsData.transactionsChange, 1)}%
                </span>
              ) : (
                <span className="text-red-500 text-sm font-medium flex items-center">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  {formatNumber(Math.abs(parseFloat(statsData.transactionsChange)), 1)}%
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
                <p className="text-2xl font-bold mt-1">{statsData.lowStockCount}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <Package className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {statsData.lowStockChange > 0 ? (
                <span className="text-amber-500 text-sm font-medium flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +{statsData.lowStockChange}
                </span>
              ) : statsData.lowStockChange < 0 ? (
                <span className="text-green-500 text-sm font-medium flex items-center">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  {Math.abs(statsData.lowStockChange)}
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
                <p className="text-2xl font-bold mt-1">{statsData.activeStoresCount}/{statsData.totalStoresCount}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Store className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {statsData.activeStoresCount === statsData.totalStoresCount ? (
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
                  {statsData.totalStoresCount - statsData.activeStoresCount} stores offline
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </React.Fragment>
  );
}