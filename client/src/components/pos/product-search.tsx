import { useQuery } from '@tanstack/react-query';
import { Search, Barcode, ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';

import BarcodeScanner from './barcode-scanner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, debounce } from '@/lib/utils';

interface ProductSearchProps {
  onProductSelect: (product: any) => void;
}

export function ProductSearch({ onProductSelect }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('search');

  const { toast } = useToast();

  // Search products query
  const searchQuery = useQuery({
    queryKey: ['/api/products/search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error('Failed to search products');
      }
      return response.json();
    },
    enabled: searchTerm.length >= 2,
  });

  // Popular products query
  const popularProductsQuery = useQuery({
    queryKey: ['/api/products/popular'],
    // This endpoint may not exist yet, fallback to getting all products
    queryFn: async () => {
      try {
        const response = await fetch('/api/products/popular');
        if (!response.ok) {
          console.log('Popular products endpoint not available, fetching all products instead');
          throw new Error('Popular products endpoint not available');
        }
        return response.json();
      } catch (error) {
        console.log('Error fetching popular products:', error);
        throw error;
      }
    },
  });

  // All products fallback query
  const allProductsQuery = useQuery({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      return response.json();
    },
    enabled: !popularProductsQuery.data && popularProductsQuery.isError,
  });

  // Handle search input with debounce
  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  // Get products to display
  const getProductsToDisplay = () => {
    if (activeTab === 'search' && searchTerm.length >= 2) {
      return searchQuery.data || [];
    }

    return popularProductsQuery.data || allProductsQuery.data || [];
  };

  // Handle product selection with expiry check
  const handleProductSelect = (product: any) => {
    if (product.isExpired) {
      // Don't allow adding expired products to cart
      const expiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
      const formattedDate = expiryDate ? expiryDate.toLocaleDateString() : 'unknown date';

      toast({
        title: 'Product Expired',
        description: `This product expired on ${formattedDate} and cannot be sold.`,
        variant: 'destructive',
      });
      return;
    }

    onProductSelect(product);
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
                    className={`h-auto p-3 flex flex-col items-start justify-start text-left ${product.isExpired ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}`}
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className="flex justify-between w-full items-start gap-1">
                      <span className="text-sm font-medium truncate">{product.name}</span>
                      {product.isExpired && (
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex w-full justify-between items-center mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {product.category?.name || 'N/A'}
                      </Badge>
                      <span className="text-sm font-bold">{formatCurrency(product.price)}</span>
                    </div>
                    {product.isExpired && (
                      <div className="w-full mt-1">
                        <Badge variant="destructive" className="text-xs w-full justify-center">
                          Expired on {new Date(product.expiryDate).toLocaleDateString()}
                        </Badge>
                      </div>
                    )}
                  </Button>
                ))
              )}

              {activeTab === 'search' &&
                searchTerm.length >= 2 &&
                searchQuery.data?.length === 0 &&
                !searchQuery.isLoading && (
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

          <TabsContent value="barcode" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Scan Product Barcode</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Simply scan a barcode with your scanner or type it in below. The input field is
                  always focused and ready to receive input.
                </p>
                <BarcodeScanner
                  onProductFound={onProductSelect}
                  disabled={activeTab !== 'barcode'}
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">Scanning Tips</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Make sure the barcode scanner is connected and powered on</li>
                  <li>• Position the scanner 4-8 inches from the barcode</li>
                  <li>• For manual entry, type the barcode and press Enter</li>
                  <li>• Successful scans will be automatically added to cart</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
