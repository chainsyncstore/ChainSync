import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Wallet, 
  CheckCircle, 
  RefreshCw,
  DollarSign,
  User
} from 'lucide-react';

interface MobilePosPaymentProps {
  cart: any[];
  subtotal: number;
  tax: number;
  total: number;
  customer: any;
  loyaltyMember: any;
  onPaymentComplete: (paymentData: any) => void;
  onCancel: () => void;
}

export function MobilePosPayment({ 
  cart, 
  subtotal, 
  tax, 
  total, 
  customer, 
  loyaltyMember,
  onPaymentComplete, 
  onCancel 
}: MobilePosPaymentProps) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountTendered, setAmountTendered] = useState(total.toFixed(2));
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  
  // Calculate change amount for cash payments
  const changeAmount = Math.max(0, parseFloat(amountTendered) - total);
  
  // Process payment
  const handleProcessPayment = () => {
    setProcessingPayment(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setProcessingPayment(false);
      setPaymentComplete(true);
      
      // Complete the transaction
      onPaymentComplete({
        method: paymentMethod,
        amountTendered: parseFloat(amountTendered),
        changeAmount: changeAmount,
        cardDetails: paymentMethod === 'card' ? {
          cardNumber,
          expiryDate,
          cvv
        } : undefined
      });
    }, 1500);
  };
  
  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    return value
      .replace(/\s/g, '')
      .replace(/(\d{4})/g, '$1 ')
      .trim()
      .substring(0, 19);
  };
  
  // Format expiry date (MM/YY)
  const formatExpiryDate = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .substring(0, 5);
  };

  if (paymentComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] px-4">
        <div className="rounded-full bg-green-100 p-6 mb-4">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <h3 className="text-xl font-medium text-center">Payment Complete</h3>
        <p className="text-muted-foreground text-center mt-2 mb-6">
          The transaction has been successfully processed
        </p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <div className="bg-muted p-3 rounded-md text-center">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">${total.toFixed(2)}</p>
          </div>
          <div className="bg-muted p-3 rounded-md text-center">
            <p className="text-sm text-muted-foreground">Method</p>
            <p className="text-lg font-semibold capitalize">{paymentMethod}</p>
          </div>
          {paymentMethod === 'cash' && (
            <>
              <div className="bg-muted p-3 rounded-md text-center">
                <p className="text-sm text-muted-foreground">Amount Tendered</p>
                <p className="text-lg font-semibold">${parseFloat(amountTendered).toFixed(2)}</p>
              </div>
              <div className="bg-muted p-3 rounded-md text-center">
                <p className="text-sm text-muted-foreground">Change</p>
                <p className="text-lg font-semibold">${changeAmount.toFixed(2)}</p>
              </div>
            </>
          )}
        </div>
        <Button className="mt-6 w-full max-w-md" onClick={onCancel}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4 py-4">
        {/* Order summary */}
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Order Summary</h3>
          <div className="bg-muted/50 rounded-md p-3">
            <div className="grid grid-cols-3 text-sm mb-1">
              <span className="font-medium">Item</span>
              <span className="text-center font-medium">Qty</span>
              <span className="text-right font-medium">Price</span>
            </div>
            <Separator className="my-2" />
            {cart.map((item) => (
              <div key={item.id} className="grid grid-cols-3 text-sm py-1">
                <span className="truncate pr-2">{item.name}</span>
                <span className="text-center">{item.quantity}</span>
                <span className="text-right">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="grid grid-cols-2 text-sm pt-1">
              <span>Subtotal</span>
              <span className="text-right">${subtotal.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 text-sm pt-1">
              <span>Tax</span>
              <span className="text-right">${tax.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 text-base font-medium pt-2">
              <span>Total</span>
              <span className="text-right">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {/* Customer details */}
        {customer && (
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Customer</h3>
            <div className="bg-muted/50 rounded-md p-3 flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">{customer.fullName}</p>
                {customer.email && <p className="text-sm">{customer.email}</p>}
                {customer.phone && <p className="text-sm">{customer.phone}</p>}
                {loyaltyMember && (
                  <Badge variant="outline" className="mt-1">
                    Loyalty Member
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Payment method selection */}
        <div>
          <h3 className="text-lg font-medium mb-2">Payment Method</h3>
          <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="cash">
                <DollarSign className="h-4 w-4 mr-2" />
                Cash
              </TabsTrigger>
              <TabsTrigger value="card">
                <CreditCard className="h-4 w-4 mr-2" />
                Card
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="cash">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount-tendered">Amount Tendered</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="amount-tendered"
                        type="text"
                        className="pl-9"
                        value={amountTendered}
                        onChange={(e) => {
                          // Allow only numbers and decimal point
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setAmountTendered(value);
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="bg-muted p-3 rounded-md">
                    <div className="grid grid-cols-2 text-sm">
                      <span>Total</span>
                      <span className="text-right">${total.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 text-sm pt-1">
                      <span>Amount Tendered</span>
                      <span className="text-right">${parseFloat(amountTendered || '0').toFixed(2)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="grid grid-cols-2 text-base font-medium">
                      <span>Change</span>
                      <span className="text-right">${changeAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="card">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="card-number">Card Number</Label>
                    <Input
                      id="card-number"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry-date">Expiry Date</Label>
                      <Input
                        id="expiry-date"
                        placeholder="MM/YY"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        placeholder="123"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 3))}
                        maxLength={3}
                        type="password"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-muted p-3 rounded-md">
                    <div className="grid grid-cols-2 text-base font-medium">
                      <span>Total Amount</span>
                      <span className="text-right">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
      
      <div className="px-4 py-4 border-t flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          className="flex-1" 
          onClick={handleProcessPayment}
          disabled={
            processingPayment || 
            (paymentMethod === 'cash' && (parseFloat(amountTendered) < total)) ||
            (paymentMethod === 'card' && (
              cardNumber.replace(/\s/g, '').length < 16 ||
              expiryDate.length < 5 ||
              cvv.length < 3
            ))
          }
        >
          {processingPayment ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4 mr-2" />
              Complete Payment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}