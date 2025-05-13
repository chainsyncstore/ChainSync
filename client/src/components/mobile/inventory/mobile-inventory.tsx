import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Plus, BarChart2 } from 'lucide-react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileInventoryProductCard } from './mobile-inventory-product-card';
import { MobileInventoryFilters } from './mobile-inventory-filters';
import { MobileInventoryStats } from './mobile-inventory-stats';

export function MobileInventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
  });

  // Fetch stores for filter
  const { data: stores } = useQuery({
    queryKey: ['/api/stores'],
  });

  // Fetch products with filters
  const {
    data: products,
    isLoading: isProductsLoading,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['/api/inventory', debouncedSearchTerm, categoryFilter, storeFilter, stockFilter],
    queryFn: async () => {
      let url = '/api/inventory';
      const params = new URLSearchParams();
      
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);
      if (storeFilter) params.append('store', storeFilter);
      if (stockFilter && stockFilter !== 'all') params.append('stock', stockFilter);
      
      if (params.toString()) url += `?${params.toString()}`;
      const response = await fetch(url);
      return response.json();
    },
  });

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStoreFilter('');
    setStockFilter('all');
    setIsFiltersOpen(false);
    refetchProducts();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between mb-2">
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
        
        <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="ml-2">
              <Filter className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Inventory Filters</SheetTitle>
            </SheetHeader>
            <MobileInventoryFilters 
              categories={categories || []}
              stores={stores || []}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              storeFilter={storeFilter}
              setStoreFilter={setStoreFilter}
              stockFilter={stockFilter}
              setStockFilter={setStockFilter}
              resetFilters={resetFilters}
              closeFilters={() => setIsFiltersOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <Tabs
        defaultValue="products"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1"
      >
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="flex-1">
          <ScrollArea className="flex-1 h-[calc(100vh-220px)]">
            <div className="space-y-3 pb-2">
              {isProductsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <Skeleton className="h-16 w-16 rounded-md" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <div className="flex justify-between">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-4 w-1/4" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : products && products.length > 0 ? (
                products.map((product: any) => (
                  <MobileInventoryProductCard key={product.id} product={product} />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No products found. Try adjusting your filters.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="stats">
          <MobileInventoryStats />
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-20 right-4">
        <Link href="/inventory/add">
          <Button className="rounded-full h-12 w-12 shadow-lg">
            <Plus className="h-6 w-6" />
            <span className="sr-only">Add Product</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}