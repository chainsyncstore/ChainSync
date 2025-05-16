import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrency } from '@/lib/utils';
import { Check, CreditCard, DollarSign, X } from 'lucide-react';

interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onConfirm: () => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  isProcessing: boolean;
  loyaltyId: string;
  setLoyaltyId: (id: string) => void;
}

export function PaymentModal({
  total,
  onClose,
  onConfirm,
  paymentMethod,
  setPaymentMethod,
  isProcessing,
  loyaltyId,
  setLoyaltyId,
}: PaymentModalProps) {
  const [cashAmount, setCashAmount] = useState<string>(total.toFixed(2));
  
  const handleCashAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimals
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setCashAmount(value);
    }
  };
  
  const getCashChange = () => {
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount < total) {
      return 0;
    }
    return amount - total;
  };
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
          <DialogDescription>
            Select payment method and complete the transaction.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center bg-muted/30 p-4 rounded-md">
            <div className="text-sm text-muted-foreground">Amount Due</div>
            <div className="text-3xl font-bold">{formatCurrency(total)}</div>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="loyalty-id">Loyalty ID (Optional)</Label>
            <Input
              id="loyalty-id"
              placeholder="Enter loyalty ID"
              value={loyaltyId}
              onChange={(e) => setLoyaltyId(e.target.value)}
            />
          </div>
          
          <RadioGroup
            value={paymentMethod}
            onValueChange={setPaymentMethod}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="cash"
                id="cash"
                className="peer sr-only"
              />
              <Label
                htmlFor="cash"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
              >
                <DollarSign className="h-6 w-6 mb-2" />
                Cash
              </Label>
            </div>
            
            <div>
              <RadioGroupItem
                value="credit_card"
                id="credit_card"
                className="peer sr-only"
              />
              <Label
                htmlFor="credit_card"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
              >
                <CreditCard className="h-6 w-6 mb-2" />
                Card
              </Label>
            </div>
          </RadioGroup>
          
          {paymentMethod === 'cash' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cash-amount">Cash Amount</Label>
                <Input
                  id="cash-amount"
                  type="text"
                  value={cashAmount}
                  onChange={handleCashAmountChange}
                  className="text-right text-lg"
                />
              </div>
              
              <div className="flex justify-between items-center">
                <Label>Change Due</Label>
                <div className="text-xl font-bold">
                  {formatCurrency(getCashChange())}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 20, 50, 100].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    onClick={() => setCashAmount(amount.toFixed(2))}
                  >
                    {formatCurrency(amount)}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCashAmount(total.toFixed(2))}
                >
                  Exact
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={
              isProcessing || 
              (paymentMethod === 'cash' && parseFloat(cashAmount) < total)
            }
          >
            {isProcessing ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
