import React, { useState } from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
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
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { formatDate, formatNumber } from &apos;@/lib/utils&apos;;
import { Search, RefreshCw, AlertCircle, Settings } from &apos;lucide-react&apos;;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from &apos;@/components/ui/select&apos;;
import { MinimumLevelDialog } from &apos;./minimum-level-dialog&apos;;
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from &apos;@/components/ui/tooltip&apos;;

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

interface Store {
  _id: number;
  _name: string;
  _address: string;
  _isActive: boolean;
}

interface Category {
  _id: number;
  _name: string;
}

export function InventoryList() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState(&apos;&apos;);
  const [categoryFilter, setCategoryFilter] = useState(&apos;all_categories&apos;);
  // Force store ID for manager/cashier roles, allow selection for admin
  const [storeId, setStoreId] = useState<string>(
    user?.role !== &apos;admin&apos; && user?.storeId
      ? user.storeId.toString()
      : &apos;&apos;
  );

  // State for minimum level dialog
  const [minLevelDialogOpen, setMinLevelDialogOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<{
    _id: number;
    _productId: number;
    _productName: string;
    _currentQuantity: number;
    _minimumLevel: number;
  } | null>(null);

  // Fetch inventory data
  const { _data: inventoryData, _isLoading: isLoadingInventory, refetch } = useQuery<InventoryItem[]>({
    _queryKey: [&apos;/api/inventory&apos;, { _storeId: storeId ? parseInt(storeId) : undefined }]
  });

  // Fetch all stores (for admin dropdown)
  const { _data: storesData, _isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: [&apos;/api/stores&apos;],
    _enabled: user?.role === &apos;admin&apos;
  });

  // Fetch all categories for filtering
  const { _data: categoriesData, _isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: [&apos;/api/products/categories&apos;]
  });

  // Filter data based on search term and category
  const filteredInventory = Array.isArray(inventoryData)
    ? inventoryData.filter((_item: InventoryItem) => {
        // Search filter
        const matchesSearch = searchTerm === &apos;&apos; ||
          item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.product.barcode.toLowerCase().includes(searchTerm.toLowerCase());

        // Category filter
        const matchesCategory = categoryFilter === &apos;all_categories&apos; ||
          item.product.category.id === parseInt(categoryFilter);

        return matchesSearch && matchesCategory;
      })
    : [];

  // Get unique categories from inventory data if API categories not available
  const uniqueCategories = Array.isArray(categoriesData) ? _categoriesData :
    (Array.isArray(inventoryData) ?
      Array.from(new Map(
        inventoryData.map(item => [item.product.category.id, item.product.category])
      ).values())
      : []);

  if (isLoadingInventory) {
    return (
      <Card className=&quot;shadow-sm&quot;>
        <CardHeader className=&quot;pb-2&quot;>
          <Skeleton className=&quot;h-7 w-40 mb-2&quot; />
          <Skeleton className=&quot;h-4 w-64&quot; />
        </CardHeader>
        <CardContent>
          <div className=&quot;flex flex-col _md:flex-row space-y-2 _md:space-y-0 _md:space-x-2 mb-4&quot;>
            <Skeleton className=&quot;h-10 w-full _md:w-64&quot; />
            <Skeleton className=&quot;h-10 w-full _md:w-48&quot; />
            {user?.role === &apos;admin&apos; && <Skeleton className=&quot;h-10 w-full _md:w-48&quot; />}
          </div>

          <div className=&quot;border rounded-md&quot;>
            <div className=&quot;border-b bg-muted/40 p-2&quot;>
              <div className=&quot;grid grid-cols-12 gap-2&quot;>
                <Skeleton className=&quot;h-4 col-span-3&quot; />
                <Skeleton className=&quot;h-4 col-span-2&quot; />
                <Skeleton className=&quot;h-4 col-span-2&quot; />
                <Skeleton className=&quot;h-4 col-span-2&quot; />
                <Skeleton className=&quot;h-4 col-span-3&quot; />
              </div>
            </div>
            <div className=&quot;divide-y&quot;>
              {[...Array(5)].map((_, i) => (
                <div key={i} className=&quot;p-2&quot;>
                  <div className=&quot;grid grid-cols-12 gap-2&quot;>
                    <Skeleton className=&quot;h-4 col-span-3&quot; />
                    <Skeleton className=&quot;h-4 col-span-2&quot; />
                    <Skeleton className=&quot;h-4 col-span-2&quot; />
                    <Skeleton className=&quot;h-4 col-span-2&quot; />
                    <Skeleton className=&quot;h-4 col-span-3&quot; />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className=&quot;shadow-sm&quot;>
      <CardHeader className=&quot;pb-2&quot;>
        <CardTitle>Inventory Management</CardTitle>
        <p className=&quot;text-sm text-muted-foreground&quot;>
          {user?.role === &apos;admin&apos;
            ? &apos;Manage your product inventory across all stores&apos;
            : `Manage inventory for ${
                Array.isArray(storesData)
                  ? storesData.find((s) => s.id === parseInt(storeId))?.name || &apos;your store&apos;
                  : &apos;your store&apos;
              }`
          }
        </p>
      </CardHeader>
      <CardContent>
        <div className=&quot;flex flex-col _md:flex-row space-y-2 _md:space-y-0 _md:space-x-2 mb-4&quot;>
          {/* Search bar */}
          <div className=&quot;relative flex-1&quot;>
            <Search className=&quot;absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground&quot; />
            <Input
              type=&quot;search&quot;
              placeholder=&quot;Search products...&quot;
              className=&quot;pl-8&quot;
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category filter */}
          <Select
            value={categoryFilter}
            onValueChange={setCategoryFilter}
          >
            <SelectTrigger className=&quot;w-full _md:w-[180px]&quot;>
              <SelectValue placeholder=&quot;Category&quot; />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=&quot;all_categories&quot;>All Categories</SelectItem>
              {uniqueCategories.map((_category: Category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Store selector (admin only) */}
          {user?.role === &apos;admin&apos; && (
            <Select
              value={storeId}
              onValueChange={setStoreId}
            >
              <SelectTrigger className=&quot;w-full _md:w-[180px]&quot;>
                <SelectValue placeholder=&quot;Select store&quot; />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(storesData) && storesData.map((_store: Store) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Refresh button */}
          <Button variant=&quot;outline&quot; size=&quot;icon&quot; onClick={() => refetch()}>
            <RefreshCw className=&quot;h-4 w-4&quot; />
          </Button>
        </div>

        {/* Inventory table */}
        <div className=&quot;border rounded-md&quot;>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className=&quot;min-w-[200px]&quot;>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className=&quot;text-right&quot;>In Stock</TableHead>
                <TableHead className=&quot;text-right&quot;>Minimum Level</TableHead>
                <TableHead>Status</TableHead>
                {user?.role !== &apos;cashier&apos; && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role !== &apos;cashier&apos; ? _6 : 5} className=&quot;text-center py-8 text-muted-foreground&quot;>
                    No inventory items found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory?.map((_item: InventoryItem) => (
                  <TableRow key={item.id}>
                    <TableCell className=&quot;font-medium&quot;>
                      <div>
                        {item.product.name}
                        <div className=&quot;text-xs text-muted-foreground&quot;>
                          _Barcode: {item.product.barcode}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.product.category.name}</TableCell>
                    <TableCell className=&quot;text-right font-mono&quot;>
                      {formatNumber(item.quantity)}
                    </TableCell>
                    <TableCell className=&quot;text-right font-mono&quot;>
                      {formatNumber(item.minimumLevel)}
                    </TableCell>
                    <TableCell>
                      {item.quantity <= 0 ? (
                        <Badge variant=&quot;destructive&quot;>Out of Stock</Badge>
                      ) : item.quantity <= item.minimumLevel ? (
                        <Badge variant=&quot;destructive&quot;>Low Stock</Badge>
                      ) : (
                        <Badge variant=&quot;outline&quot; className=&quot;bg-green-100 text-green-700 border-green-200&quot;>
                          In Stock
                        </Badge>
                      )}
                    </TableCell>
                    {user?.role !== &apos;cashier&apos; && (
                      <TableCell>
                        <div className=&quot;flex space-x-2&quot;>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
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
                                >
                                  <Settings className=&quot;w-4 h-4 mr-1&quot; />
                                  Min Level
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Set minimum stock level alert threshold
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Visual indicator for stock level thresholds */}
        <div className=&quot;mt-4 flex flex-col _sm:flex-row gap-3 items-start&quot;>
          <div className=&quot;text-sm font-medium&quot;>Stock Level Indicators:</div>
          <div className=&quot;flex flex-wrap gap-3&quot;>
            <div className=&quot;flex items-center&quot;>
              <Badge variant=&quot;destructive&quot;>Out of Stock</Badge>
              <span className=&quot;ml-2 text-sm text-muted-foreground&quot;>Quantity = 0</span>
            </div>
            <div className=&quot;flex items-center&quot;>
              <Badge variant=&quot;destructive&quot;>Low Stock</Badge>
              <span className=&quot;ml-2 text-sm text-muted-foreground&quot;>Quantity &le; Minimum Level</span>
            </div>
            <div className=&quot;flex items-center&quot;>
              <Badge variant=&quot;outline&quot; className=&quot;bg-green-100 text-green-700 border-green-200&quot;>In Stock</Badge>
              <span className=&quot;ml-2 text-sm text-muted-foreground&quot;>Quantity &gt; Minimum Level</span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Minimum level dialog */}
      <MinimumLevelDialog
        open={minLevelDialogOpen}
        onOpenChange={setMinLevelDialogOpen}
        inventoryItem={selectedInventoryItem}
      />
    </Card>
  );
}
