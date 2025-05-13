import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Trash2, User } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';

interface MobilePosCartProps {
  cart: any[];
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
  customer: any;
  setCustomer: (customer: any) => void;
  loyaltyMember: any;
}

export function MobilePosCart({
  cart,
  updateQuantity,
  removeItem,
  clearCart,
  customer,
  setCustomer,
  loyaltyMember
}: MobilePosCartProps) {
  const [showCustomerSheet, setShowCustomerSheet] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Calculate cart totals
  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  
  // Customer search
  const { data: customers, isLoading } = useQuery({
    queryKey: ['/api/customers/search', debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm) return [];
      const response = await fetch(`/api/customers/search?term=${debouncedSearchTerm}`);
      return response.json();
    },
    enabled: debouncedSearchTerm.length > 2 && showCustomerSheet,
  });

  // Handle customer search input change with debounce
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Select a customer
  const handleSelectCustomer = (selectedCustomer: any) => {
    setCustomer(selectedCustomer);
    setShowCustomerSheet(false);
    setSearchTerm('');
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Trash2 className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">Your cart is empty</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Add products to your cart to start a transaction
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Customer section */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Customer</p>
              <p className="text-sm text-muted-foreground">
                {customer ? customer.fullName : 'No customer selected'}
              </p>
              {loyaltyMember && (
                <div className="mt-1 text-xs text-primary">
                  Loyalty ID: {loyaltyMember.loyaltyId}
                </div>
              )}
            </div>
            <Sheet open={showCustomerSheet} onOpenChange={setShowCustomerSheet}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-1" />
                  {customer ? 'Change' : 'Add'}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Select Customer</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <div className="relative mb-4">
                    <Input
                      type="search"
                      placeholder="Search by name, email or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[400px] pr-4">
                    {isLoading ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Searching...
                      </div>
                    ) : customers && customers.length > 0 ? (
                      <div className="space-y-2">
                        {customers.map((c: any) => (
                          <div 
                            key={c.id}
                            className="p-3 border rounded-md cursor-pointer hover:bg-muted"
                            onClick={() => handleSelectCustomer(c)}
                          >
                            <div className="font-medium">{c.fullName}</div>
                            {c.email && (
                              <div className="text-sm text-muted-foreground">{c.email}</div>
                            )}
                            {c.phone && (
                              <div className="text-sm text-muted-foreground">{c.phone}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : debouncedSearchTerm.length > 2 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No customers found. Try a different search term.
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        Type at least 3 characters to search for customers.
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Cart items */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-2">
            {cart.map((item) => (
              <div key={item.id} className="py-3 border-b last:border-0">
                <div className="flex justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ${parseFloat(item.price).toFixed(2)} each
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Clear cart button */}
        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={clearCart}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cart
          </Button>
        </div>
      </div>
    </>
  );
}