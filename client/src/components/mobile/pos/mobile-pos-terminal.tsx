import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Barcode, Trash2, User, ShoppingCart, X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOfflineMode } from '@/hooks/use-offline-mode';
import { MobilePosCart } from './mobile-pos-cart';
import { MobilePosPayment } from './mobile-pos-payment';
import { MobilePosNumpad } from './mobile-pos-numpad';
import { MobilePosCustomer } from './mobile-pos-customer';
import { MobilePosLoyalty } from './mobile-pos-loyalty';

export function MobilePosTerminal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isOffline } = useOfflineMode();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [selectedStore, setSelectedStore] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [loyaltyMember, setLoyaltyMember] = useState<any>(null);
  const [showPayment, setShowPayment] = useState(false);
  
  // Calculate cart totals
  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const taxRate = 0.075; // 7.5% tax
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Fetch stores for store selector
  const { data: stores, isLoading: isStoresLoading } = useQuery({
    queryKey: ['/api/stores'],
  });

  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0].id.toString());
    }
  }, [stores, selectedStore]);

  // Fetch products based on search and store filter
  const { 
    data: products, 
    isLoading: isProductsLoading 
  } = useQuery({
    queryKey: ['/api/inventory/products', debouncedSearchTerm, selectedStore],
    queryFn: async () => {
      let url = '/api/inventory/products';
      const params = new URLSearchParams();
      
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      if (selectedStore) params.append('store', selectedStore);
      
      if (params.toString()) url += `?${params.toString()}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!selectedStore,
  });

  // Create transaction mutation
  const createTransaction = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create transaction');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/recent'] });
      setCart([]);
      setCustomer(null);
      setLoyaltyMember(null);
      setShowPayment(false);
      
      toast({
        title: 'Success',
        description: 'Transaction completed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete transaction',
        variant: 'destructive',
      });
    },
  });

  // Handle adding item to cart
  const addToCart = (product: any) => {
    setCart(prev => {
      const existingItemIndex = prev.findIndex(item => item.id === product.id);
      
      if (existingItemIndex >= 0) {
        // Update quantity of existing item
        const newCart = [...prev];
        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: newCart[existingItemIndex].quantity + 1
        };
        return newCart;
      } else {
        // Add new item
        return [...prev, { ...product, quantity: 1 }];
      }
    });
    
    toast({
      title: 'Item added',
      description: `${product.name} added to cart`,
    });
  };

  // Handle updating item quantity in cart
  const updateCartItemQuantity = (productId: number, quantity: number) => {
    setCart(prev => {
      if (quantity <= 0) {
        // Remove item if quantity is zero or less
        return prev.filter(item => item.id !== productId);
      } else {
        // Update quantity
        return prev.map(item => 
          item.id === productId ? { ...item, quantity } : item
        );
      }
    });
  };

  // Handle removing item from cart
  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  // Clear the cart
  const clearCart = () => {
    setCart([]);
    setCustomer(null);
    setLoyaltyMember(null);
  };

  // Process payment
  const processPayment = (paymentData: any) => {
    const transaction = {
      storeId: parseInt(selectedStore),
      customerId: customer?.id,
      loyaltyMemberId: loyaltyMember?.id,
      subtotal: subtotal.toFixed(2),
      tax: taxAmount.toFixed(2),
      total: total.toFixed(2),
      paymentMethod: paymentData.method,
      status: 'completed',
      isOffline: isOffline,
      items: cart.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
        subtotal: (item.price * item.quantity).toFixed(2)
      }))
    };
    
    createTransaction.mutate(transaction);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 max-w-[70%]">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger>
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent>
              {isStoresLoading ? (
                <SelectItem value="loading" disabled>Loading stores...</SelectItem>
              ) : stores && stores.length > 0 ? (
                stores.map((store: any) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>No stores available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        
        <Button
          variant={cartItemCount > 0 ? "default" : "outline"}
          className="relative ml-2"
          onClick={() => setShowCart(true)}
        >
          <ShoppingCart className="h-5 w-5" />
          {cartItemCount > 0 && (
            <Badge className="absolute -top-2 -right-2 px-1 min-w-5 h-5 flex items-center justify-center">
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      <Tabs
        defaultValue="products"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1"
      >
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="numpad">Numpad</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="flex-1 h-[calc(100vh-250px)]">
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="grid grid-cols-2 gap-3 pb-4">
              {isProductsLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-0">
                      <Skeleton className="h-24 w-full" />
                      <div className="p-2">
                        <Skeleton className="h-4 w-3/4 mb-1" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : products && products.length > 0 ? (
                products.map((product: any) => (
                  <Card 
                    key={product.id} 
                    className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className="p-0">
                      {product.imageUrl ? (
                        <div className="w-full h-24 overflow-hidden">
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-muted flex items-center justify-center">
                          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-2">
                        <h3 className="font-medium text-sm line-clamp-1">{product.name}</h3>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm font-semibold">
                            ${parseFloat(product.price).toFixed(2)}
                          </span>
                          <Badge 
                            variant={product.quantity <= 5 ? "destructive" : "outline"}
                            className="text-[10px]"
                          >
                            {product.quantity <= 0 ? 'Out of stock' : product.quantity}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  No products found. Try adjusting your search.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="numpad">
          <MobilePosNumpad addToCart={addToCart} storeId={selectedStore} />
        </TabsContent>

        <TabsContent value="loyalty">
          <MobilePosLoyalty 
            customer={customer}
            loyaltyMember={loyaltyMember}
            setLoyaltyMember={setLoyaltyMember}
          />
        </TabsContent>
      </Tabs>

      {/* Cart Sheet */}
      <Sheet open={showCart} onOpenChange={setShowCart}>
        <SheetContent side="right" className="w-full sm:max-w-md px-0">
          <SheetHeader className="px-4">
            <SheetTitle>Shopping Cart</SheetTitle>
            <SheetDescription>
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in cart
            </SheetDescription>
          </SheetHeader>
          <MobilePosCart 
            cart={cart}
            updateQuantity={updateCartItemQuantity}
            removeItem={removeFromCart}
            clearCart={clearCart}
            customer={customer}
            setCustomer={setCustomer}
            loyaltyMember={loyaltyMember}
          />
          {cart.length > 0 && (
            <SheetFooter className="px-4 pb-6">
              <div className="w-full">
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Subtotal</span>
                  <span className="text-sm">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Tax (7.5%)</span>
                  <span className="text-sm">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-4 border-t pt-2">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-base font-semibold">${total.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowCart(false);
                    setShowPayment(true);
                  }}
                >
                  Proceed to Payment
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Sheet */}
      <Sheet open={showPayment} onOpenChange={setShowPayment}>
        <SheetContent side="bottom" className="h-[90%] px-0">
          <SheetHeader className="px-4">
            <SheetTitle>Payment</SheetTitle>
            <SheetDescription>
              Complete your transaction
            </SheetDescription>
          </SheetHeader>
          <MobilePosPayment 
            cart={cart}
            subtotal={subtotal}
            tax={taxAmount}
            total={total}
            customer={customer}
            loyaltyMember={loyaltyMember}
            onPaymentComplete={processPayment}
            onCancel={() => setShowPayment(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Customer Selector Sheet for Mobile POS Customer */}
    </div>
  );
}