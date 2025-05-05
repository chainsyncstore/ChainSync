import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Barcode, ShoppingBag, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { debounce } from '@/lib/utils';

interface ProductSearchProps {
  onProductSelect: (product: any) => void;
}

export function ProductSearch({ onProductSelect }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [barcode, setBarcode] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  
  // Search products query
  const searchQuery = useQuery({
    queryKey: ['/api/products/search', { q: searchTerm }],
    enabled: searchTerm.length >= 2,
  });
  
  // Barcode lookup query
  const barcodeQuery = useQuery({
    queryKey: ['/api/products/barcode', barcode],
    enabled: false, // Only triggered manually
  });
  
  // Popular products query
  const popularProductsQuery = useQuery({
    queryKey: ['/api/products/popular'],
    // This endpoint may not exist yet, fallback to getting all products
    onError: () => {
      console.log('Popular products endpoint not available, fetching all products instead');
    }
  });
  
  // All products fallback query
  const allProductsQuery = useQuery({
    queryKey: ['/api/products'],
    enabled: !popularProductsQuery.data && popularProductsQuery.isError,
  });
  
  // Handle search input with debounce
  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 300);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };
  
  // Handle barcode submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode) return;
    
    barcodeQuery.refetch().then(({ data }) => {
      if (data) {
        onProductSelect(data);
        setBarcode('');
      }
    });
  };
  
  // Automatically handle barcode scanner input (typically ends with Enter)
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBarcodeSubmit(e as unknown as React.FormEvent);
    }
  };
  
  // Focus barcode input when tab changes
  useEffect(() => {
    if (activeTab === 'barcode') {
      const barcodeInput = document.getElementById('barcode-input');
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }
  }, [activeTab]);
  
  // Get products to display
  const getProductsToDisplay = () => {
    if (activeTab === 'search' && searchTerm.length >= 2) {
      return searchQuery.data || [];
    }
    
    return popularProductsQuery.data || allProductsQuery.data || [];
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Product Search</CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="search" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="search" className="flex items-center">
              <Search className="mr-2 h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="barcode" className="flex items-center">
              <Barcode className="mr-2 h-4 w-4" />
              Barcode
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="space-y-4">
            <div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products by name or description..."
                  onChange={handleSearchChange}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {searchQuery.isLoading && searchTerm.length >= 2 ? (
                <div className="col-span-full flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                getProductsToDisplay().map((product: any) => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="h-auto p-3 flex flex-col items-start justify-start text-left"
                    onClick={() => onProductSelect(product)}
                  >
                    <span className="text-sm font-medium truncate w-full">{product.name}</span>
                    <div className="flex w-full justify-between items-center mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {product.category?.name || "N/A"}
                      </Badge>
                      <span className="text-sm font-bold">{formatCurrency(product.price)}</span>
                    </div>
                  </Button>
                ))
              )}
              
              {activeTab === 'search' && searchTerm.length >= 2 && searchQuery.data?.length === 0 && !searchQuery.isLoading && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No products found matching "{searchTerm}"
                </div>
              )}
              
              {activeTab === 'search' && searchTerm.length < 2 && (
                <div className="col-span-full">
                  <h3 className="font-medium mb-2 text-sm">Popular Products</h3>
                  {popularProductsQuery.isLoading || allProductsQuery.isLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    getProductsToDisplay().length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No products available</p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="barcode">
            <form onSubmit={handleBarcodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barcode-input">Scan or enter product barcode</Label>
                <div className="flex space-x-2">
                  <Input
                    id="barcode-input"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="Enter barcode number"
                    className="flex-1"
                    autoComplete="off"
                  />
                  <Button 
                    type="submit" 
                    disabled={!barcode || barcodeQuery.isFetching}
                  >
                    {barcodeQuery.isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {barcodeQuery.isError && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  Product with barcode "{barcode}" not found
                </div>
              )}
              
              {barcodeQuery.data && (
                <div className="border rounded-md p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{barcodeQuery.data.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {barcodeQuery.data.category?.name} • Barcode: {barcodeQuery.data.barcode}
                      </p>
                    </div>
                    <div className="text-lg font-bold">
                      {formatCurrency(barcodeQuery.data.price)}
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-3" 
                    onClick={() => onProductSelect(barcodeQuery.data)}
                  >
                    Add to Cart
                  </Button>
                </div>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
