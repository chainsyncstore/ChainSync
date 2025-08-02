import React, { useState } from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { Card, CardContent, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { Search, Barcode, ShoppingBag, Loader2, AlertCircle } from &apos;lucide-react&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { formatCurrency, formatDate } from &apos;@/lib/utils&apos;;
import { debounce } from &apos;@/lib/utils&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import BarcodeScanner from &apos;./barcode-scanner&apos;;

interface ProductSearchProps {
  _onProductSelect: (_product: any) => void;
}

export function ProductSearch({ onProductSelect }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState(&apos;&apos;);
  const [activeTab, setActiveTab] = useState(&apos;search&apos;);

  const { toast } = useToast();

  // Search products query
  const searchQuery = useQuery({
    _queryKey: [&apos;/api/products/search&apos;, searchTerm],
    _queryFn: async() => {
      if (searchTerm.length < 2) return [];
      return await apiRequest(&apos;GET&apos;, `/api/products/search?q=${encodeURIComponent(searchTerm)}`);
    },
    _enabled: searchTerm.length >= 2
  });

  // Popular products query
  const popularProductsQuery = useQuery({
    _queryKey: [&apos;/api/products/popular&apos;],
    // This endpoint may not exist yet, fallback to getting all products
    _queryFn: async() => {
      try {
        return await apiRequest(&apos;GET&apos;, &apos;/api/products/popular&apos;);
      } catch (error) {
        console.log(&apos;Error fetching popular _products:&apos;, error);
        throw error;
      }
    }
  });

  // All products fallback query
  const allProductsQuery = useQuery({
    _queryKey: [&apos;/api/products&apos;],
    _queryFn: async() => {
      return await apiRequest(&apos;GET&apos;, &apos;/api/products&apos;);
    },
    _enabled: !popularProductsQuery.data && popularProductsQuery.isError
  });

  // Handle search input with debounce
  const debouncedSearch = debounce((_value: string) => {
    setSearchTerm(value);
  }, 300);

  const handleSearchChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  // Get products to display
  const getProductsToDisplay = () => {
    if (activeTab === &apos;search&apos; && searchTerm.length >= 2) {
      return searchQuery.data || [];
    }

    return popularProductsQuery.data || allProductsQuery.data || [];
  };

  // Handle product selection with expiry check
  const handleProductSelect = (_product: any) => {
    if (product.isExpired) {
      // Don&apos;t allow adding expired products to cart
      const expiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
      const formattedDate = expiryDate ? expiryDate.toLocaleDateString() : &apos;unknown date&apos;;

      toast({
        _title: &apos;Product Expired&apos;,
        _description: `This product expired on ${formattedDate} and cannot be sold.`,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    onProductSelect(product);
  };

  return (
    <Card>
      <CardHeader className=&quot;pb-3&quot;>
        <CardTitle className=&quot;text-lg font-medium&quot;>Product Search</CardTitle>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue=&quot;search&quot; onValueChange={setActiveTab} value={activeTab}>
          <TabsList className=&quot;mb-4&quot;>
            <TabsTrigger value=&quot;search&quot; className=&quot;flex items-center&quot;>
              <Search className=&quot;mr-2 h-4 w-4&quot; />
              Search
            </TabsTrigger>
            <TabsTrigger value=&quot;barcode&quot; className=&quot;flex items-center&quot;>
              <Barcode className=&quot;mr-2 h-4 w-4&quot; />
              Barcode
            </TabsTrigger>
          </TabsList>

          <TabsContent value=&quot;search&quot; className=&quot;space-y-4&quot;>
            <div>
              <div className=&quot;relative&quot;>
                <Search className=&quot;absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground&quot; />
                <Input
                  type=&quot;search&quot;
                  placeholder=&quot;Search products by name or description...&quot;
                  onChange={handleSearchChange}
                  className=&quot;pl-8&quot;
                />
              </div>
            </div>

            <div className=&quot;grid grid-cols-2 _md:grid-cols-3 _lg:grid-cols-4 gap-3&quot;>
              {searchQuery.isLoading && searchTerm.length >= 2 ? (
                <div className=&quot;col-span-full flex justify-center py-8&quot;>
                  <Loader2 className=&quot;h-8 w-8 animate-spin text-primary&quot; />
                </div>
              ) : (
                getProductsToDisplay().map((_product: any) => (
                  <Button
                    key={product.id}
                    variant=&quot;outline&quot;
                    className={`h-auto p-3 flex flex-col items-start justify-start text-left ${product.isExpired ? &apos;border-red-500 bg-red-50 _dark:bg-red-950/20&apos; : &apos;&apos;}`}
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className=&quot;flex justify-between w-full items-start gap-1&quot;>
                      <span className=&quot;text-sm font-medium truncate&quot;>{product.name}</span>
                      {product.isExpired && (
                        <AlertCircle className=&quot;h-4 w-4 text-red-500 flex-shrink-0&quot; />
                      )}
                    </div>
                    <div className=&quot;flex w-full justify-between items-center mt-1&quot;>
                      <Badge variant=&quot;secondary&quot; className=&quot;text-xs&quot;>
                        {product.category?.name || &apos;N/A&apos;}
                      </Badge>
                      <span className=&quot;text-sm font-bold&quot;>{formatCurrency(product.price)}</span>
                    </div>
                    {product.isExpired && (
                      <div className=&quot;w-full mt-1&quot;>
                        <Badge variant=&quot;destructive&quot; className=&quot;text-xs w-full justify-center&quot;>
                          Expired on {new Date(product.expiryDate).toLocaleDateString()}
                        </Badge>
                      </div>
                    )}
                  </Button>
                ))
              )}

              {activeTab === &apos;search&apos; && searchTerm.length >= 2 && searchQuery.data?.length === 0 && !searchQuery.isLoading && (
                <div className=&quot;col-span-full text-center py-8 text-muted-foreground&quot;>
                  No products found matching &quot;{searchTerm}&quot;
                </div>
              )}

              {activeTab === &apos;search&apos; && searchTerm.length < 2 && (
                <div className=&quot;col-span-full&quot;>
                  <h3 className=&quot;font-medium mb-2 text-sm&quot;>Popular Products</h3>
                  {popularProductsQuery.isLoading || allProductsQuery.isLoading ? (
                    <div className=&quot;flex justify-center py-4&quot;>
                      <Loader2 className=&quot;h-6 w-6 animate-spin text-primary&quot; />
                    </div>
                  ) : (
                    getProductsToDisplay().length === 0 && (
                      <div className=&quot;text-center py-6 text-muted-foreground&quot;>
                        <ShoppingBag className=&quot;h-12 w-12 mx-auto mb-3 opacity-20&quot; />
                        <p>No products available</p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value=&quot;barcode&quot; className=&quot;space-y-4&quot;>
            <div className=&quot;space-y-4&quot;>
              <div>
                <h3 className=&quot;text-sm font-medium mb-2&quot;>Scan Product Barcode</h3>
                <p className=&quot;text-xs text-muted-foreground mb-3&quot;>
                  Simply scan a barcode with your scanner or type it in below.
                  The input field is always focused and ready to receive input.
                </p>
                <BarcodeScanner
                  onProductFound={onProductSelect}
                  disabled={activeTab !== &apos;barcode&apos;}
                />
              </div>

              <div className=&quot;pt-4 border-t&quot;>
                <h3 className=&quot;text-sm font-medium mb-2&quot;>Scanning Tips</h3>
                <ul className=&quot;text-xs text-muted-foreground space-y-1&quot;>
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
