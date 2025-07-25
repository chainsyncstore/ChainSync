import { useState } from 'react';
import type { SelectStore, SelectInventory } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle } from 'lucide-react';

export default function Inventory() {
  const [selectedStore, setSelectedStore] = useState<number | null>(1);

  const { data: stores = [], isLoading: isStoresLoading } = useQuery<SelectStore[]>({
    queryKey: ['/api/stores'],
  });

  const { data: inventory = [], isLoading } = useQuery<SelectInventory[]>({
    queryKey: selectedStore ? [`/api/inventory?storeId=${selectedStore}`] : [],
    enabled: !!selectedStore,
  });

  const { data: lowStock = [] } = useQuery<SelectInventory[]>({
    queryKey: selectedStore ? [`/api/inventory?lowStock=true&storeId=${selectedStore}`] : [],
    enabled: !!selectedStore,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor stock levels across your stores
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : inventory?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {lowStock?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : inventory.length > 0 ? (
        <div className="space-y-4">
          {inventory.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex justify-between items-center py-4">
                <div>
                  <h3 className="font-semibold">Product ID: {item.productId}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Store ID: {item.storeId}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    Qty: {item.quantity || 0}
                  </div>
                  {item.quantity !== null && item.minStock !== null && item.quantity <= item.minStock && (
                    <Badge variant="destructive" className="mt-1">
                      Low Stock
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No inventory found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Start by adding products to your inventory.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}