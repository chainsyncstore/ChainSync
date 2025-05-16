import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-provider';
import { Settings, AlertCircle, ArrowUpRight } from 'lucide-react';
import { MinimumLevelDialog } from './minimum-level-dialog';
import { Link } from 'wouter';

interface Product {
  id: number;
  name: string;
  barcode: string;
  category: {
    id: number;
    name: string;
  };
}

interface InventoryItem {
  id: number;
  quantity: number;
  minimumLevel: number;
  product: Product;
  store: {
    id: number;
    name: string;
  };
}

export function LowStockAlerts() {
  const { user } = useAuth();
  const [minLevelDialogOpen, setMinLevelDialogOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<{
    id: number;
    productId: number;
    productName: string;
    currentQuantity: number;
    minimumLevel: number;
  } | null>(null);
  
  // Get query parameter for store ID (admin can view specific store)
  const storeIdParam = user?.role === 'admin' 
    ? undefined 
    : user?.storeId;
  
  const { data: lowStockItems, isLoading, refetch } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory/low-stock', { storeId: storeIdParam }],
  });
  
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const itemCount = lowStockItems?.length || 0;
  
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Low Stock Alerts</CardTitle>
            <CardDescription>
              {itemCount === 0 
                ? 'All inventory items are above minimum stock levels' 
                : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} need attention`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 px-2"
          >
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {itemCount === 0 ? (
          <div className="py-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium">All Stock Levels Healthy</h3>
            <p className="text-sm text-muted-foreground mt-2">
              There are currently no items below their minimum stock thresholds.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {lowStockItems?.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {item.product.name}
                      {user?.role === 'admin' && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({item.store.name})
                        </span>
                      )}
                    </div>
                    <div className="text-sm flex items-center mt-1">
                      <Badge variant="destructive" className="mr-2">
                        {item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                      </Badge>
                      <span className="text-muted-foreground">
                        Current: {item.quantity} / Min: {item.minimumLevel}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedInventoryItem({
                          id: item.id,
                          productId: item.product.id,
                          productName: item.product.name,
                          currentQuantity: item.quantity,
                          minimumLevel: item.minimumLevel
                        });
                        setMinLevelDialogOpen(true);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {itemCount > 0 && (
        <CardFooter className="pt-1">
          <Link href="/inventory" className="hover:underline text-sm text-primary flex items-center">
            View all inventory
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </CardFooter>
      )}
      
      {/* Minimum level dialog */}
      <MinimumLevelDialog 
        open={minLevelDialogOpen} 
        onOpenChange={setMinLevelDialogOpen}
        inventoryItem={selectedInventoryItem}
      />
    </Card>
  );
}