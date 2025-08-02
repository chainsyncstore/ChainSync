import React, { useState, useEffect } from &apos;react&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useOfflineMode } from &apos;@/hooks/use-offline-mode&apos;;
import { ProductSearch } from &apos;./product-search&apos;;
import { Cart } from &apos;./cart&apos;;
import { Numpad } from &apos;./numpad&apos;;
import { PaymentModal } from &apos;./payment-modal&apos;;
import { Receipt } from &apos;./receipt&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useQueryClient } from &apos;@tanstack/react-query&apos;;
import { generateTransactionId, calculateSubtotal, calculateTax, calculateTotal } from &apos;@/lib/utils&apos;;
import { useMutation } from &apos;@tanstack/react-query&apos;;
import { AlertCircle, Wifi, WifiOff, XCircle } from &apos;lucide-react&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;

type CartItem = {
  _productId: number;
  _name: string;
  _barcode: string;
  _quantity: number;
  _unitPrice: number;
  _subtotal: number;
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
  const [paymentMethod, setPaymentMethod] = useState<string>(&apos;cash&apos;);
  const [loyaltyId, setLoyaltyId] = useState<string>(&apos;&apos;);

  // Calculated values
  const subtotal = calculateSubtotal(cart);
  const tax = calculateTax(subtotal);
  const total = calculateTotal(subtotal, tax);

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    _mutationFn: async(_data: any) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/pos/transactions&apos;, data);
    },
    _onSuccess: (data) => {
      setCompletedTransaction({
        ...data.transaction,
        _items: data.items,
        _cashier: user
      });
      setShowPaymentModal(false);
      setShowReceipt(true);

      // Clear the cart
      setCart([]);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/dashboard/quick-stats&apos;] });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/dashboard/recent-transactions&apos;] });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/inventory&apos;] });

      toast({
        _title: &apos;Transaction completed&apos;,
        _description: `Transaction ${data.transaction.transactionId} has been processed successfully.`
      });
    },
    _onError: (error) => {
      toast({
        _title: &apos;Transaction failed&apos;,
        _description: &apos;There was an error processing the transaction. Please try again.&apos;,
        _variant: &apos;destructive&apos;
      });
      console.error(&apos;Transaction _error:&apos;, error);
    }
  });

  // Handle item adding to cart
  const addToCart = (_product: any) => {
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
          _productId: product.id,
          _name: product.name,
          _barcode: product.barcode,
          _quantity: 1,
          _unitPrice: parseFloat(product.price),
          _subtotal: parseFloat(product.price)
        }
      ]);
    }
  };

  // Handle item removal from cart
  const removeFromCart = (_index: number) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    setCart(updatedCart);
  };

  // Handle quantity update for cart item
  const updateQuantity = (_index: number, _quantity: number) => {
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
  const handleNumpadInput = (_value: string) => {
    if (!activeInput) return;

    if (activeInput.startsWith(&apos;quantity-&apos;)) {
      const index = parseInt(activeInput.split(&apos;-&apos;)[1]);
      const currentItem = cart[index];

      if (value === &apos;clear&apos;) {
        updateQuantity(index, 1);
      } else if (value === &apos;backspace&apos;) {
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
        _title: &apos;Empty cart&apos;,
        _description: &apos;Please add items to the cart before processing payment.&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    setShowPaymentModal(true);
  };

  // Handle payment confirmation
  const confirmPayment = () => {
    const transactionId = generateTransactionId();

    const transactionData = {
      _transactionData: {
        transactionId,
        _subtotal: subtotal.toFixed(2),
        _tax: tax.toFixed(2),
        _total: total.toFixed(2),
        paymentMethod,
        _status: &apos;completed&apos;,
        _isOfflineTransaction: !isOnline,
        _loyaltyId: loyaltyId.trim() || null
      },
      _items: cart.map(item => ({
        _productId: item.productId,
        _quantity: item.quantity,
        _unitPrice: item.unitPrice.toFixed(2),
        _subtotal: item.subtotal.toFixed(2)
      }))
    };

    if (isOnline) {
      // Online mode - send to server
      createTransactionMutation.mutate(transactionData);
    } else {
      // Offline mode - store locally
      const savedTransaction = saveOfflineTransaction(transactionData);

      // Set completed transaction for receipt
      setCompletedTransaction({
        _transactionId: savedTransaction.transactionId,
        _subtotal: subtotal.toFixed(2),
        _tax: tax.toFixed(2),
        _total: total.toFixed(2),
        paymentMethod,
        _status: &apos;pending sync&apos;,
        _createdAt: new Date().toISOString(),
        _items: cart,
        _cashier: user,
        _offlineId: savedTransaction.offlineId
      });

      setShowPaymentModal(false);
      setShowReceipt(true);
      setCart([]);

      toast({
        _title: &apos;Transaction saved offline&apos;,
        _description: &quot;The transaction has been saved and will be synced when you&apos;re back online.&quot;
      });
    }
  };

  // Handle void transaction
  const voidTransaction = () => {
    if (cart.length === 0) return;

    setCart([]);
    toast({
      _title: &apos;Transaction voided&apos;,
      _description: &apos;All items have been removed from the cart.&apos;
    });
  };

  // Reset after receipt is closed
  const handleReceiptClose = () => {
    setShowReceipt(false);
    setCompletedTransaction(null);
  };

  return (
    <div className=&quot;flex flex-col _lg:flex-row h-full gap-4&quot;>
      <div className=&quot;_lg:w-7/12 space-y-4&quot;>
        {/* Offline mode alert */}
        {!isOnline && (
          <Alert className=&quot;bg-amber-50 border-amber-200&quot;>
            <WifiOff className=&quot;h-4 w-4 text-amber-600&quot; />
            <AlertTitle className=&quot;text-amber-600&quot;>Offline Mode Active</AlertTitle>
            <AlertDescription className=&quot;text-amber-700&quot;>
              You are currently working in offline mode. Transactions will be saved locally and synced when you&apos;re back online.
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

      <div className=&quot;_lg:w-5/12&quot;>
        {/* Numpad section */}
        <div className=&quot;h-full&quot;>
          <Tabs defaultValue=&quot;numpad&quot; className=&quot;h-full&quot;>
            <div className=&quot;bg-white rounded-md border shadow-sm h-full&quot;>
              <div className=&quot;px-4 pt-4 pb-0&quot;>
                <TabsList className=&quot;grid w-full grid-cols-2&quot;>
                  <TabsTrigger value=&quot;numpad&quot;>Numpad</TabsTrigger>
                  <TabsTrigger value=&quot;loyalty&quot;>Loyalty</TabsTrigger>
                </TabsList>
              </div>
              <div className=&quot;p-4&quot;>
                <TabsContent value=&quot;numpad&quot; className=&quot;mt-0 p-0&quot;>
                  <Numpad onInput={handleNumpadInput} activeInput={activeInput} />
                </TabsContent>
                <TabsContent value=&quot;loyalty&quot; className=&quot;mt-0 p-0&quot;>
                  <div className=&quot;space-y-4&quot;>
                    <div>
                      <h3 className=&quot;text-lg font-medium mb-1&quot;>Customer Loyalty</h3>
                      <p className=&quot;text-sm text-muted-foreground&quot;>Enter a loyalty ID to award points for this purchase</p>
                    </div>
                    <div className=&quot;space-y-2&quot;>
                      <Label htmlFor=&quot;loyalty-id&quot;>Loyalty ID</Label>
                      <div className=&quot;flex gap-2&quot;>
                        <Input
                          id=&quot;loyalty-id&quot;
                          value={loyaltyId}
                          onChange={(e) => setLoyaltyId(e.target.value)}
                          placeholder=&quot;Enter loyalty ID&quot;
                          className=&quot;flex-1&quot;
                        />
                        <Button
                          variant=&quot;outline&quot;
                          onClick={() => setLoyaltyId(&apos;&apos;)}
                          type=&quot;button&quot;
                        >
                          <XCircle className=&quot;h-4 w-4&quot; />
                        </Button>
                      </div>
                    </div>

                    {loyaltyId && (
                      <Alert className=&quot;bg-blue-50 border-blue-200&quot;>
                        <AlertTitle className=&quot;text-blue-600&quot;>Loyalty _ID: {loyaltyId}</AlertTitle>
                        <AlertDescription className=&quot;text-blue-700&quot;>
                          This customer will earn points on their purchase.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className=&quot;pt-2&quot;>
                      <h3 className=&quot;text-sm font-medium mb-2&quot;>Quick Actions</h3>
                      <div className=&quot;grid grid-cols-2 gap-2&quot;>
                        <Button
                          variant=&quot;outline&quot;
                          className=&quot;h-10&quot;
                          onClick={() => {
                            // Placeholder for loyalty search feature
                            toast({
                              _title: &apos;Search Loyalty Members&apos;,
                              _description: &apos;This feature is coming soon&apos;
                            });
                          }}
                        >
                          Search Members
                        </Button>
                        <Button
                          variant=&quot;outline&quot;
                          className=&quot;h-10&quot;
                          onClick={() => {
                            // Placeholder for loyalty enrollment feature
                            toast({
                              _title: &apos;Enroll New Member&apos;,
                              _description: &apos;This feature is coming soon&apos;
                            });
                          }}
                        >
                          Enroll New Member
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
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
