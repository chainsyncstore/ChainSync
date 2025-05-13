import React, { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useOfflineMode } from '@/hooks/use-offline-mode';
import { ProductSearch } from './product-search';
import { Cart } from './cart';
import { Numpad } from './numpad';
import { PaymentModal } from './payment-modal';
import { Receipt } from './receipt';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { generateTransactionId, calculateSubtotal, calculateTax, calculateTotal } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type CartItem = {
  productId: number;
  name: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export function PosTerminal() {
  const { user } = useAuth();
  const { isOnline, saveOfflineTransaction } = useOfflineMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [loyaltyId, setLoyaltyId] = useState<string>('');
  
  // Calculated values
  const subtotal = calculateSubtotal(cart);
  const tax = calculateTax(subtotal);
  const total = calculateTotal(subtotal, tax);
  
  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/pos/transactions', data);
      return response.json();
    },
    onSuccess: (data) => {
      setCompletedTransaction({
        ...data.transaction,
        items: data.items,
        cashier: user,
      });
      setShowPaymentModal(false);
      setShowReceipt(true);
      
      // Clear the cart
      setCart([]);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/quick-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      
      toast({
        title: "Transaction completed",
        description: `Transaction ${data.transaction.transactionId} has been processed successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Transaction failed",
        description: "There was an error processing the transaction. Please try again.",
        variant: "destructive",
      });
      console.error('Transaction error:', error);
    },
  });
  
  // Handle item adding to cart
  const addToCart = (product: any) => {
    const existingItemIndex = cart.findIndex(item => item.productId === product.id);
    
    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += 1;
      updatedCart[existingItemIndex].subtotal = 
        updatedCart[existingItemIndex].quantity * updatedCart[existingItemIndex].unitPrice;
      setCart(updatedCart);
    } else {
      // Add new item to cart
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          quantity: 1,
          unitPrice: parseFloat(product.price),
          subtotal: parseFloat(product.price),
        },
      ]);
    }
  };
  
  // Handle item removal from cart
  const removeFromCart = (index: number) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    setCart(updatedCart);
  };
  
  // Handle quantity update for cart item
  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }
    
    const updatedCart = [...cart];
    updatedCart[index].quantity = quantity;
    updatedCart[index].subtotal = quantity * updatedCart[index].unitPrice;
    setCart(updatedCart);
  };
  
  // Handle numpad input
  const handleNumpadInput = (value: string) => {
    if (!activeInput) return;
    
    if (activeInput.startsWith('quantity-')) {
      const index = parseInt(activeInput.split('-')[1]);
      const currentItem = cart[index];
      
      if (value === 'clear') {
        updateQuantity(index, 1);
      } else if (value === 'backspace') {
        const newQuantity = Math.floor(currentItem.quantity / 10) || 1;
        updateQuantity(index, newQuantity);
      } else {
        // Append digit
        const newValue = currentItem.quantity.toString() + value;
        updateQuantity(index, parseInt(newValue));
      }
    }
  };
  
  // Handle transaction processing
  const processTransaction = () => {
    if (cart.length === 0) {
      toast({
        title: "Empty cart",
        description: "Please add items to the cart before processing payment.",
        variant: "destructive",
      });
      return;
    }
    
    setShowPaymentModal(true);
  };
  
  // Handle payment confirmation
  const confirmPayment = () => {
    const transactionId = generateTransactionId();
    
    const transactionData = {
      transactionData: {
        transactionId,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod,
        status: 'completed',
        isOfflineTransaction: !isOnline,
        loyaltyId: loyaltyId.trim() || null,
      },
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        subtotal: item.subtotal.toFixed(2),
      })),
    };
    
    if (isOnline) {
      // Online mode - send to server
      createTransactionMutation.mutate(transactionData);
    } else {
      // Offline mode - store locally
      const savedTransaction = saveOfflineTransaction(transactionData);
      
      // Set completed transaction for receipt
      setCompletedTransaction({
        transactionId: savedTransaction.transactionId,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod,
        status: 'pending sync',
        createdAt: new Date().toISOString(),
        items: cart,
        cashier: user,
        offlineId: savedTransaction.offlineId,
      });
      
      setShowPaymentModal(false);
      setShowReceipt(true);
      setCart([]);
      
      toast({
        title: "Transaction saved offline",
        description: "The transaction has been saved and will be synced when you're back online.",
      });
    }
  };
  
  // Handle void transaction
  const voidTransaction = () => {
    if (cart.length === 0) return;
    
    setCart([]);
    toast({
      title: "Transaction voided",
      description: "All items have been removed from the cart.",
    });
  };
  
  // Reset after receipt is closed
  const handleReceiptClose = () => {
    setShowReceipt(false);
    setCompletedTransaction(null);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      <div className="lg:w-7/12 space-y-4">
        {/* Offline mode alert */}
        {!isOnline && (
          <Alert variant="warning" className="bg-amber-50 border-amber-200">
            <WifiOff className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-600">Offline Mode Active</AlertTitle>
            <AlertDescription className="text-amber-700">
              You are currently working in offline mode. Transactions will be saved locally and synced when you're back online.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Product search section */}
        <ProductSearch onProductSelect={addToCart} />
        
        {/* Cart section */}
        <Cart 
          items={cart} 
          subtotal={subtotal} 
          tax={tax} 
          total={total}
          onRemove={removeFromCart}
          onQuantityChange={updateQuantity}
          onProcessPayment={processTransaction}
          onVoidTransaction={voidTransaction}
          setActiveInput={setActiveInput}
          isLoading={createTransactionMutation.isPending}
        />
      </div>
      
      <div className="lg:w-5/12">
        {/* Numpad section */}
        <Numpad onInput={handleNumpadInput} activeInput={activeInput} />
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          total={total}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={confirmPayment}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          isProcessing={createTransactionMutation.isPending}
          loyaltyId={loyaltyId}
          setLoyaltyId={setLoyaltyId}
        />
      )}
      
      {/* Receipt Modal */}
      {showReceipt && completedTransaction && (
        <Receipt
          transaction={completedTransaction}
          onClose={handleReceiptClose}
        />
      )}
    </div>
  );
}
