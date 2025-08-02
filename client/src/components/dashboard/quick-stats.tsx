import React from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { Card, CardContent, CardTitle } from &apos;@/components/ui/card&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { formatCurrency, formatNumber } from &apos;@/lib/utils&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import {
  DollarSign,
  ShoppingCart,
  Package,
  Store,
  TrendingUp,
  TrendingDown,
  Building
} from &apos;lucide-react&apos;;

interface QuickStatsProps {
  storeId?: number;
}

// Define types for the data returned from the API
interface QuickStatsData {
  _salesTotal: string;
  _salesChange: string;
  _transactionsCount: number;
  _transactionsChange: string;
  _lowStockCount: number;
  _lowStockChange: number;
  _activeStoresCount: number;
  _totalStoresCount: number;
}

interface StoreData {
  _id: number;
  _name: string;
  _address: string;
  _isActive: boolean;
}

export function QuickStats({ storeId }: QuickStatsProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === &apos;admin&apos;;

  // For store-specific query to get store details
  const { _data: storeData } = useQuery<StoreData>({
    queryKey: [&apos;/api/stores&apos;, user?.storeId],
    _enabled: !isAdmin && !!user?.storeId
  });

  const { data, isLoading } = useQuery<QuickStatsData>({
    _queryKey: [&apos;/api/dashboard/quick-stats&apos;, storeId],
    _refetchInterval: 300000 // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className=&quot;grid grid-cols-1 _md:grid-cols-2 _lg:grid-cols-4 gap-6 mb-6&quot;>
        {[...Array(4)].map((_, i) => (
          <Card key={i} className=&quot;shadow-sm&quot;>
            <CardContent className=&quot;p-6&quot;>
              <div className=&quot;flex items-center justify-between&quot;>
                <div>
                  <Skeleton className=&quot;h-4 w-32 mb-2&quot; />
                  <Skeleton className=&quot;h-8 w-24&quot; />
                </div>
                <Skeleton className=&quot;h-12 w-12 rounded-full&quot; />
              </div>
              <div className=&quot;mt-4&quot;>
                <Skeleton className=&quot;h-4 w-20&quot; />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Safely use the data with fallback values
  const statsData = data || {
    _salesTotal: &apos;0&apos;,
    _salesChange: &apos;0&apos;,
    _transactionsCount: 0,
    _transactionsChange: &apos;0&apos;,
    _lowStockCount: 0,
    _lowStockChange: 0,
    _activeStoresCount: 0,
    _totalStoresCount: 0
  };

  return (
    <React.Fragment>
      {!isAdmin && storeData && (
        <Card className=&quot;mb-6 bg-white border border-neutral-200 shadow-sm overflow-hidden&quot;>
          <div className=&quot;bg-gradient-to-r from-primary-50 to-secondary-50 p-6 flex items-center&quot;>
            <div className=&quot;p-3 bg-white rounded-full mr-4 shadow&quot;>
              <Building className=&quot;w-6 h-6 text-primary&quot; />
            </div>
            <div>
              <CardTitle className=&quot;text-xl font-medium text-neutral-800&quot;>
                {storeData?.name || &apos;Store Dashboard&apos;}
              </CardTitle>
              <p className=&quot;text-sm text-neutral-600 mt-1&quot;>
                You are viewing data for your assigned store
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className=&quot;grid grid-cols-1 _md:grid-cols-2 _lg:grid-cols-4 gap-6 mb-6&quot;>
        {/* Total Sales */}
        <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200&quot;>
          <CardContent className=&quot;p-6&quot;>
            <div className=&quot;flex items-center justify-between&quot;>
              <div>
                <p className=&quot;text-sm font-medium text-neutral-500&quot;>Total Sales (Today)</p>
                <p className=&quot;text-2xl font-bold mt-1&quot;>{formatCurrency(statsData.salesTotal)}</p>
              </div>
              <div className=&quot;p-3 bg-primary-50 rounded-full&quot;>
                <DollarSign className=&quot;w-6 h-6 text-primary&quot; />
              </div>
            </div>
            <div className=&quot;mt-4 flex items-center&quot;>
              {parseFloat(statsData.salesChange) >= 0 ? (
                <span className=&quot;text-green-500 text-sm font-medium flex items-center&quot;>
                  <TrendingUp className=&quot;w-4 h-4 mr-1&quot; />
                  {formatNumber(statsData.salesChange, 1)}%
                </span>
              ) : (
                <span className=&quot;text-red-500 text-sm font-medium flex items-center&quot;>
                  <TrendingDown className=&quot;w-4 h-4 mr-1&quot; />
                  {formatNumber(Math.abs(parseFloat(statsData.salesChange)), 1)}%
                </span>
              )}
              <span className=&quot;text-neutral-500 text-sm ml-2&quot;>vs Yesterday</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Transactions */}
        <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200&quot;>
          <CardContent className=&quot;p-6&quot;>
            <div className=&quot;flex items-center justify-between&quot;>
              <div>
                <p className=&quot;text-sm font-medium text-neutral-500&quot;>Transactions (Today)</p>
                <p className=&quot;text-2xl font-bold mt-1&quot;>{formatNumber(statsData.transactionsCount)}</p>
              </div>
              <div className=&quot;p-3 bg-secondary-50 rounded-full&quot;>
                <ShoppingCart className=&quot;w-6 h-6 text-secondary&quot; />
              </div>
            </div>
            <div className=&quot;mt-4 flex items-center&quot;>
              {parseFloat(statsData.transactionsChange) >= 0 ? (
                <span className=&quot;text-green-500 text-sm font-medium flex items-center&quot;>
                  <TrendingUp className=&quot;w-4 h-4 mr-1&quot; />
                  {formatNumber(statsData.transactionsChange, 1)}%
                </span>
              ) : (
                <span className=&quot;text-red-500 text-sm font-medium flex items-center&quot;>
                  <TrendingDown className=&quot;w-4 h-4 mr-1&quot; />
                  {formatNumber(Math.abs(parseFloat(statsData.transactionsChange)), 1)}%
                </span>
              )}
              <span className=&quot;text-neutral-500 text-sm ml-2&quot;>vs Yesterday</span>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Alerts */}
        <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200&quot;>
          <CardContent className=&quot;p-6&quot;>
            <div className=&quot;flex items-center justify-between&quot;>
              <div>
                <p className=&quot;text-sm font-medium text-neutral-500&quot;>Low Stock Items</p>
                <p className=&quot;text-2xl font-bold mt-1&quot;>{statsData.lowStockCount}</p>
              </div>
              <div className=&quot;p-3 bg-red-100 rounded-full&quot;>
                <Package className=&quot;w-6 h-6 text-red-500&quot; />
              </div>
            </div>
            <div className=&quot;mt-4 flex items-center&quot;>
              {statsData.lowStockChange > 0 ? (
                <span className=&quot;text-red-500 text-sm font-medium flex items-center&quot;>
                  <TrendingUp className=&quot;w-4 h-4 mr-1&quot; />
                  +{statsData.lowStockChange}
                </span>
              ) : statsData.lowStockChange < 0 ? (
                <span className=&quot;text-green-500 text-sm font-medium flex items-center&quot;>
                  <TrendingDown className=&quot;w-4 h-4 mr-1&quot; />
                  {Math.abs(statsData.lowStockChange)}
                </span>
              ) : (
                <span className=&quot;text-neutral-500 text-sm font-medium flex items-center&quot;>
                  No change
                </span>
              )}
              <span className=&quot;text-neutral-500 text-sm ml-2&quot;>since yesterday</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Stores */}
        <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200&quot;>
          <CardContent className=&quot;p-6&quot;>
            <div className=&quot;flex items-center justify-between&quot;>
              <div>
                <p className=&quot;text-sm font-medium text-neutral-500&quot;>Active Stores</p>
                <p className=&quot;text-2xl font-bold mt-1&quot;>{statsData.activeStoresCount}/{statsData.totalStoresCount}</p>
              </div>
              <div className=&quot;p-3 bg-green-100 rounded-full&quot;>
                <Store className=&quot;w-6 h-6 text-green-500&quot; />
              </div>
            </div>
            <div className=&quot;mt-4 flex items-center&quot;>
              {statsData.activeStoresCount === statsData.totalStoresCount ? (
                <span className=&quot;text-green-500 text-sm font-medium flex items-center&quot;>
                  <svg className=&quot;w-4 h-4 mr-1&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;>
                    <path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth=&quot;2&quot; d=&quot;M5 13l4 4L19 7&quot; />
                  </svg>
                  All stores online
                </span>
              ) : (
                <span className=&quot;text-amber-500 text-sm font-medium flex items-center&quot;>
                  <svg className=&quot;w-4 h-4 mr-1&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;>
                    <path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth=&quot;2&quot; d=&quot;M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z&quot; />
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
