import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useAuth } from '@/providers/auth-provider';
import { formatDate, formatNumber } from '@/lib/utils';
import { Search, RefreshCw, AlertCircle } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  barcode: string;
  category: {
    id: number;
    name: string;
  };
}

interface ExpiredItem {
  id: number;
  quantity: number;
  minimumLevel: number;
  expiryDate: Date;
  daysExpired: number;
  batchNumber: string | null;
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

export function ExpiredItems() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all_categories');
  const [storeId, setStoreId] = useState<string>(
    user?.role !== 'admin' && user?.storeId 
      ? user.storeId.toString() 
      : ''
  );
  
  // Fetch expired items data
  const { data: expiredItems, isLoading: isLoadingExpired, refetch } = useQuery<ExpiredItem[]>({
    queryKey: ['/api/inventory/expired', { 
      storeId: storeId ? parseInt(storeId) : undefined,
    }],
  });
  
  // Fetch all stores (for admin dropdown)
  const { data: storesData, isLoading: isLoadingStores } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
    enabled: user?.role === 'admin',
  });
  
  // Fetch all categories for filtering
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery<any[]>({
    queryKey: ['/api/products/categories'],
  });
  
  // Filter data based on search term and category
  const filteredItems = Array.isArray(expiredItems) 
    ? expiredItems.filter((item: ExpiredItem) => {
        const matchesSearch = 
          item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.product.barcode && item.product.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.batchNumber && item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesCategory = 
          categoryFilter === 'all_categories' || 
          item.product.category.id.toString() === categoryFilter;
        
        return matchesSearch && matchesCategory;
      })
    : [];
  
  // Get unique categories from the data
  const uniqueCategories = Array.isArray(categoriesData) 
    ? categoriesData 
    : [];
  
  // Loading state
  if (isLoadingExpired || isLoadingStores || isLoadingCategories) {
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
        <CardTitle>Expired Inventory</CardTitle>
        <CardDescription className="text-red-600 font-medium flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          These items should be removed from inventory
        </CardDescription>
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
              {uniqueCategories.map((category: any) => (
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
        
        {/* Expired items table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No expired items found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems?.map((item: ExpiredItem) => (
                  <TableRow key={item.id} className="bg-red-50">
                    <TableCell className="font-medium">
                      <div>
                        {item.product.name}
                        <div className="text-xs text-muted-foreground">
                          Barcode: {item.product.barcode}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.product.category.name}</TableCell>
                    <TableCell>{item.batchNumber || 'N/A'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(item.quantity)}
                    </TableCell>
                    <TableCell>{formatDate(item.expiryDate)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
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