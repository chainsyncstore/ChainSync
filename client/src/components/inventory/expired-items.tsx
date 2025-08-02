import React, { useState } from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from &apos;@/components/ui/select&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { formatDate, formatNumber } from &apos;@/lib/utils&apos;;
import { Search, RefreshCw, AlertCircle } from &apos;lucide-react&apos;;

interface Product {
  _id: number;
  _name: string;
  _barcode: string;
  category: {
    _id: number;
    _name: string;
  };
}

interface ExpiredItem {
  _id: number;
  _quantity: number;
  _minimumLevel: number;
  _expiryDate: Date;
  _daysExpired: number;
  _batchNumber: string | null;
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

export function ExpiredItems() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState(&apos;&apos;);
  const [categoryFilter, setCategoryFilter] = useState(&apos;all_categories&apos;);
  const [storeId, setStoreId] = useState<string>(
    user?.role !== &apos;admin&apos; && user?.storeId
      ? user.storeId.toString()
      : &apos;&apos;
  );

  // Fetch expired items data
  const { _data: expiredItems, _isLoading: isLoadingExpired, refetch } = useQuery<ExpiredItem[]>({
    _queryKey: [&apos;/api/inventory/expired&apos;, {
      _storeId: storeId ? parseInt(storeId) : undefined
    }]
  });

  // Fetch all stores (for admin dropdown)
  const { _data: storesData, _isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: [&apos;/api/stores&apos;],
    _enabled: user?.role === &apos;admin&apos;
  });

  // Fetch all categories for filtering
  const { _data: categoriesData, _isLoading: isLoadingCategories } = useQuery<any[]>({
    queryKey: [&apos;/api/products/categories&apos;]
  });

  // Filter data based on search term and category
  const filteredItems = Array.isArray(expiredItems)
    ? expiredItems.filter((_item: ExpiredItem) => {
        const matchesSearch =
          item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.product.barcode && item.product.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.batchNumber && item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory =
          categoryFilter === &apos;all_categories&apos; ||
          item.product.category.id.toString() === categoryFilter;

        return matchesSearch && matchesCategory;
      })
    : [];

  // Get unique categories from the data
  const uniqueCategories = Array.isArray(categoriesData)
    ? _categoriesData
    : [];

  // Loading state
  if (isLoadingExpired || isLoadingStores || isLoadingCategories) {
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
        <CardTitle>Expired Inventory</CardTitle>
        <CardDescription className=&quot;text-red-600 font-medium flex items-center&quot;>
          <AlertCircle className=&quot;h-4 w-4 mr-1&quot; />
          These items should be removed from inventory
        </CardDescription>
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
              {uniqueCategories.map((_category: any) => (
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

        {/* Expired items table */}
        <div className=&quot;border rounded-md&quot;>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className=&quot;min-w-[200px]&quot;>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className=&quot;text-right&quot;>Qty</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className=&quot;text-center py-8 text-muted-foreground&quot;>
                    No expired items found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems?.map((_item: ExpiredItem) => (
                  <TableRow key={item.id} className=&quot;bg-red-50&quot;>
                    <TableCell className=&quot;font-medium&quot;>
                      <div>
                        {item.product.name}
                        <div className=&quot;text-xs text-muted-foreground&quot;>
                          _Barcode: {item.product.barcode}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.product.category.name}</TableCell>
                    <TableCell>{item.batchNumber || &apos;N/A&apos;}</TableCell>
                    <TableCell className=&quot;text-right font-mono&quot;>
                      {formatNumber(item.quantity)}
                    </TableCell>
                    <TableCell>{formatDate(item.expiryDate)}</TableCell>
                    <TableCell>
                      <Badge variant=&quot;destructive&quot; className=&quot;gap-1&quot;>
                        <AlertCircle className=&quot;h-3 w-3&quot; />
                        Expired {item.daysExpired} days ago
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
