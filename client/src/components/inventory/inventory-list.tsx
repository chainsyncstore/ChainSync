import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-provider';
import { formatDate, formatNumber } from '@/lib/utils';
import { Search, RefreshCw, AlertCircle, Settings } from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { MinimumLevelDialog } from './minimum-level-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface Store {
  id: number;
  name: string;
  address: string;
  isActive: boolean;
}

interface Category {
  id: number;
  name: string;
}

export function InventoryList() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all_categories');
  // Force store ID for manager/cashier roles, allow selection for admin
  const [storeId, setStoreId] = useState<string>(
    user?.role !== 'admin' && user?.storeId 
      ? user.storeId.toString() 
      : ''
  );
  
  // State for minimum level dialog
  const [minLevelDialogOpen, setMinLevelDialogOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<{
    id: number;
    productId: number;
    productName: string;
    currentQuantity: number;
    minimumLevel: number;
  } | null>(null);
  
  // Fetch inventory data
  const { data: inventoryData, isLoading: isLoadingInventory, refetch } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory', { storeId: storeId ? parseInt(storeId) : undefined }],
  });
  
  // Fetch all stores (for admin dropdown)
  const { data: storesData, isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
    enabled: user?.role === 'admin',
  });
  
  // Fetch all categories for filtering
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ['/api/products/categories'],
  });
  
  // Filter data based on search term and category
  const filteredInventory = Array.isArray(inventoryData) 
    ? inventoryData.filter((item: InventoryItem) => {
        // Search filter
        const matchesSearch = searchTerm === '' || 
          item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.product.barcode.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Category filter
        const matchesCategory = categoryFilter === 'all_categories' || 
          item.product.category.id === parseInt(categoryFilter);
        
        return matchesSearch && matchesCategory;
      })
    : [];

  // Get unique categories from inventory data if API categories not available
  const uniqueCategories = Array.isArray(categoriesData) ? categoriesData : 
    (Array.isArray(inventoryData) ? 
      Array.from(new Map(
        inventoryData.map(item => [item.product.category.id, item.product.category])
      ).values()) 
      : []);

  if (isLoadingInventory) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-4">
            <Skeleton className="h-10 w-full md:w-64" />
            <Skeleton className="h-10 w-full md:w-48" />
            {user?.role === 'admin' && <Skeleton className="h-10 w-full md:w-48" />}
          </div>
          
          <div className="border rounded-md">
            <div className="border-b bg-muted/40 p-2">
              <div className="grid grid-cols-12 gap-2">
                <Skeleton className="h-4 col-span-3" />
                <Skeleton className="h-4 col-span-2" />
                <Skeleton className="h-4 col-span-2" />
                <Skeleton className="h-4 col-span-2" />
                <Skeleton className="h-4 col-span-3" />
              </div>
            </div>
            <div className="divide-y">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-2">
                  <div className="grid grid-cols-12 gap-2">
                    <Skeleton className="h-4 col-span-3" />
                    <Skeleton className="h-4 col-span-2" />
                    <Skeleton className="h-4 col-span-2" />
                    <Skeleton className="h-4 col-span-2" />
                    <Skeleton className="h-4 col-span-3" />
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
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>Inventory Management</CardTitle>
        <p className="text-sm text-muted-foreground">
          {user?.role === 'admin' 
            ? 'Manage your product inventory across all stores' 
            : `Manage inventory for ${
                Array.isArray(storesData) 
                  ? storesData.find((s) => s.id === parseInt(storeId))?.name || 'your store'
                  : 'your store'
              }`
          }
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Category filter */}
          <Select
            value={categoryFilter}
            onValueChange={setCategoryFilter}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_categories">All Categories</SelectItem>
              {uniqueCategories.map((category: Category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Store selector (admin only) */}
          {user?.role === 'admin' && (
            <Select
              value={storeId}
              onValueChange={setStoreId}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(storesData) && storesData.map((store: Store) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Refresh button */}
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Inventory table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">In Stock</TableHead>
                <TableHead className="text-right">Minimum Level</TableHead>
                <TableHead>Status</TableHead>
                {user?.role !== 'cashier' && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role !== 'cashier' ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No inventory items found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory?.map((item: InventoryItem) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div>
                        {item.product.name}
                        <div className="text-xs text-muted-foreground">
                          Barcode: {item.product.barcode}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.product.category.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(item.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(item.minimumLevel)}
                    </TableCell>
                    <TableCell>
                      {item.quantity <= 0 ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : item.quantity <= item.minimumLevel ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                          In Stock
                        </Badge>
                      )}
                    </TableCell>
                    {user?.role !== 'cashier' && (
                      <TableCell>
                        <div className="flex space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
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
                                >
                                  <Settings className="w-4 h-4 mr-1" />
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
        <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start">
          <div className="text-sm font-medium">Stock Level Indicators:</div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center">
              <Badge variant="destructive">Out of Stock</Badge>
              <span className="ml-2 text-sm text-muted-foreground">Quantity = 0</span>
            </div>
            <div className="flex items-center">
              <Badge variant="destructive">Low Stock</Badge>
              <span className="ml-2 text-sm text-muted-foreground">Quantity &le; Minimum Level</span>
            </div>
            <div className="flex items-center">
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">In Stock</Badge>
              <span className="ml-2 text-sm text-muted-foreground">Quantity &gt; Minimum Level</span>
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
