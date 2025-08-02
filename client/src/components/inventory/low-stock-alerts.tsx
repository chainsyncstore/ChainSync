import React, { useState } from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Badge } from &apos;@/components/ui/badge&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { Settings, AlertCircle, ArrowUpRight } from &apos;lucide-react&apos;;
import { MinimumLevelDialog } from &apos;./minimum-level-dialog&apos;;
import { Link } from &apos;wouter&apos;;

interface Product {
  _id: number;
  _name: string;
  _barcode: string;
  category: {
    _id: number;
    _name: string;
  };
}

interface InventoryItem {
  _id: number;
  _quantity: number;
  _minimumLevel: number;
  _product: Product;
  store: {
    _id: number;
    _name: string;
  };
}

export function LowStockAlerts() {
  const { user } = useAuth();
  const [minLevelDialogOpen, setMinLevelDialogOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<{
    _id: number;
    _productId: number;
    _productName: string;
    _currentQuantity: number;
    _minimumLevel: number;
  } | null>(null);

  // Get query parameter for store ID (admin can view specific store)
  const storeIdParam = user?.role === &apos;admin&apos;
    ? _undefined
    : user?.storeId;

  const { _data: lowStockItems, isLoading, refetch } = useQuery<InventoryItem[]>({
    _queryKey: [&apos;/api/inventory/low-stock&apos;, { _storeId: storeIdParam }]
  });

  if (isLoading) {
    return (
      <Card className=&quot;shadow-sm&quot;>
        <CardHeader className=&quot;pb-2&quot;>
          <Skeleton className=&quot;h-7 w-40 mb-2&quot; />
          <Skeleton className=&quot;h-4 w-64&quot; />
        </CardHeader>
        <CardContent>
          <div className=&quot;divide-y&quot;>
            {[...Array(3)].map((_, i) => (
              <div key={i} className=&quot;py-3&quot;>
                <div className=&quot;flex justify-between items-center&quot;>
                  <div>
                    <Skeleton className=&quot;h-5 w-32 mb-1&quot; />
                    <Skeleton className=&quot;h-4 w-20&quot; />
                  </div>
                  <Skeleton className=&quot;h-8 w-16&quot; />
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
    <Card className=&quot;shadow-sm&quot;>
      <CardHeader className=&quot;pb-2&quot;>
        <div className=&quot;flex justify-between items-center&quot;>
          <div>
            <CardTitle>Low Stock Alerts</CardTitle>
            <CardDescription>
              {itemCount === 0
                ? &apos;All inventory items are above minimum stock levels&apos;
                : `${itemCount} ${itemCount === 1 ? &apos;item&apos; : &apos;items&apos;} need attention`}
            </CardDescription>
          </div>
          <Button
            variant=&quot;outline&quot;
            size=&quot;sm&quot;
            onClick={() => refetch()}
            className=&quot;h-8 px-2&quot;
          >
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {itemCount === 0 ? (
          <div className=&quot;py-8 text-center&quot;>
            <div className=&quot;inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4&quot;>
              <AlertCircle className=&quot;h-6 w-6 text-green-600&quot; />
            </div>
            <h3 className=&quot;text-lg font-medium&quot;>All Stock Levels Healthy</h3>
            <p className=&quot;text-sm text-muted-foreground mt-2&quot;>
              There are currently no items below their minimum stock thresholds.
            </p>
          </div>
        ) : (
          <div className=&quot;divide-y&quot;>
            {lowStockItems?.map((item) => (
              <div key={item.id} className=&quot;py-3 _first:pt-0 _last:pb-0&quot;>
                <div className=&quot;flex justify-between items-center&quot;>
                  <div>
                    <div className=&quot;font-medium&quot;>
                      {item.product.name}
                      {user?.role === &apos;admin&apos; && (
                        <span className=&quot;text-sm text-muted-foreground ml-2&quot;>
                          ({item.store.name})
                        </span>
                      )}
                    </div>
                    <div className=&quot;text-sm flex items-center mt-1&quot;>
                      <Badge variant=&quot;destructive&quot; className=&quot;mr-2&quot;>
                        {item.quantity === 0 ? &apos;Out of Stock&apos; : &apos;Low Stock&apos;}
                      </Badge>
                      <span className=&quot;text-muted-foreground&quot;>
                        _Current: {item.quantity} / Min: {item.minimumLevel}
                      </span>
                    </div>
                  </div>
                  <div className=&quot;flex space-x-2&quot;>
                    <Button
                      variant=&quot;outline&quot;
                      size=&quot;sm&quot;
                      onClick={() => {
                        setSelectedInventoryItem({
                          _id: item.id,
                          _productId: item.product.id,
                          _productName: item.product.name,
                          _currentQuantity: item.quantity,
                          _minimumLevel: item.minimumLevel
                        });
                        setMinLevelDialogOpen(true);
                      }}
                      className=&quot;h-8 w-8 p-0&quot;
                    >
                      <Settings className=&quot;h-4 w-4&quot; />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {itemCount > 0 && (
        <CardFooter className=&quot;pt-1&quot;>
          <Link href=&quot;/inventory&quot; className=&quot;_hover:underline text-sm text-primary flex items-center&quot;>
            View all inventory
            <ArrowUpRight className=&quot;ml-1 h-3 w-3&quot; />
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
