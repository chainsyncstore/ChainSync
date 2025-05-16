import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
import { Search, RefreshCw, AlertTriangle } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  barcode: string;
  category: {
    id: number;
    name: string;
  };
}

interface ExpiringItem {
  id: number;
  quantity: number;
  minimumLevel: number;
  expiryDate: Date;
  daysUntilExpiry: number;
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

export function ExpiringItems() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all_categories');
  const [storeId, setStoreId] = useState<string>(
    user?.role !== 'admin' && user?.storeId 
      ? user.storeId.toString() 
      : ''
  );
  const [daysFilter, setDaysFilter] = useState('30');
  
  // Fetch expiring items data
  const { data: expiringItems, isLoading: isLoadingExpiring, refetch } = useQuery<ExpiringItem[]>({
    queryKey: ['/api/inventory/expiring', { 
      storeId: storeId ? parseInt(storeId) : undefined,
      days: parseInt(daysFilter)
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
  const filteredItems = Array.isArray(expiringItems) 
    ? expiringItems.filter((item: ExpiringItem) => {
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
  if (isLoadingExpiring || isLoadingStores || isLoadingCategories) {
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
        <CardTitle>Expiring Inventory</CardTitle>
        <CardDescription>
          Products that will expire within {daysFilter} days
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
          
          {/* Days filter */}
          <Select
            value={daysFilter}
            onValueChange={setDaysFilter}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Expiry period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
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
        
        {/* Expiring items table */}
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
                    No expiring items found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems?.map((item: ExpiringItem) => (
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
                    <TableCell>{item.batchNumber || 'N/A'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(item.quantity)}
                    </TableCell>
                    <TableCell>{formatDate(item.expiryDate)}</TableCell>
                    <TableCell>
                      {getExpiryStatusBadge(item.daysUntilExpiry)}
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

function getExpiryStatusBadge(daysUntilExpiry: number) {
  // Critical: 0-7 days, Warning: 8-14 days, Notice: 15-30 days
  if (daysUntilExpiry <= 7) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {daysUntilExpiry} days left
      </Badge>
    );
  } else if (daysUntilExpiry <= 14) {
    return (
      <Badge variant="secondary" className="text-orange-700 bg-orange-100 hover:bg-orange-200 gap-1">
        <AlertTriangle className="h-3 w-3" />
        {daysUntilExpiry} days left
      </Badge>
    );
  } else {
    return (
      <Badge variant="secondary" className="text-yellow-600 bg-yellow-50 hover:bg-yellow-100 gap-1">
        {daysUntilExpiry} days left
      </Badge>
    );
  }
}