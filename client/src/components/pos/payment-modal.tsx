import React, { useState } from &apos;react&apos;;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from &apos;@/components/ui/dialog&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { RadioGroup, RadioGroupItem } from &apos;@/components/ui/radio-group&apos;;
import { formatCurrency } from &apos;@/lib/utils&apos;;
import { Check, CreditCard, DollarSign, X } from &apos;lucide-react&apos;;

interface PaymentModalProps {
  _total: number;
  onClose: () => void;
  _onConfirm: () => void;
  _paymentMethod: string;
  setPaymentMethod: (_method: string) => void;
  _isProcessing: boolean;
  _loyaltyId: string;
  setLoyaltyId: (_id: string) => void;
}

export function PaymentModal({
  total,
  onClose,
  onConfirm,
  paymentMethod,
  setPaymentMethod,
  isProcessing,
  loyaltyId,
  setLoyaltyId
}: PaymentModalProps) {
  const [cashAmount, setCashAmount] = useState<string>(total.toFixed(2));

  const handleCashAmountChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
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
      <DialogContent className=&quot;_sm:max-w-[425px]&quot;>
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
          <DialogDescription>
            Select payment method and complete the transaction.
          </DialogDescription>
        </DialogHeader>

        <div className=&quot;space-y-6 py-4&quot;>
          <div className=&quot;text-center bg-muted/30 p-4 rounded-md&quot;>
            <div className=&quot;text-sm text-muted-foreground&quot;>Amount Due</div>
            <div className=&quot;text-3xl font-bold&quot;>{formatCurrency(total)}</div>
          </div>

          <div className=&quot;space-y-3&quot;>
            <Label htmlFor=&quot;loyalty-id&quot;>Loyalty ID (Optional)</Label>
            <Input
              id=&quot;loyalty-id&quot;
              placeholder=&quot;Enter loyalty ID&quot;
              value={loyaltyId}
              onChange={(e) => setLoyaltyId(e.target.value)}
            />
          </div>

          <RadioGroup
            value={paymentMethod}
            onValueChange={setPaymentMethod}
            className=&quot;grid grid-cols-2 gap-4&quot;
          >
            <div>
              <RadioGroupItem
                value=&quot;cash&quot;
                id=&quot;cash&quot;
                className=&quot;peer sr-only&quot;
              />
              <Label
                htmlFor=&quot;cash&quot;
                className=&quot;flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 _hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5&quot;
              >
                <DollarSign className=&quot;h-6 w-6 mb-2&quot; />
                Cash
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value=&quot;credit_card&quot;
                id=&quot;credit_card&quot;
                className=&quot;peer sr-only&quot;
              />
              <Label
                htmlFor=&quot;credit_card&quot;
                className=&quot;flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 _hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5&quot;
              >
                <CreditCard className=&quot;h-6 w-6 mb-2&quot; />
                Card
              </Label>
            </div>
          </RadioGroup>

          {paymentMethod === &apos;cash&apos; && (
            <div className=&quot;space-y-4&quot;>
              <div className=&quot;space-y-2&quot;>
                <Label htmlFor=&quot;cash-amount&quot;>Cash Amount</Label>
                <Input
                  id=&quot;cash-amount&quot;
                  type=&quot;text&quot;
                  value={cashAmount}
                  onChange={handleCashAmountChange}
                  className=&quot;text-right text-lg&quot;
                />
              </div>

              <div className=&quot;flex justify-between items-center&quot;>
                <Label>Change Due</Label>
                <div className=&quot;text-xl font-bold&quot;>
                  {formatCurrency(getCashChange())}
                </div>
              </div>

              <div className=&quot;grid grid-cols-3 gap-2&quot;>
                {[5, 10, 20, 50, 100].map((amount) => (
                  <Button
                    key={amount}
                    type=&quot;button&quot;
                    variant=&quot;outline&quot;
                    onClick={() => setCashAmount(amount.toFixed(2))}
                  >
                    {formatCurrency(amount)}
                  </Button>
                ))}
                <Button
                  type=&quot;button&quot;
                  variant=&quot;outline&quot;
                  onClick={() => setCashAmount(total.toFixed(2))}
                >
                  Exact
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant=&quot;outline&quot; onClick={onClose} disabled={isProcessing}>
            <X className=&quot;mr-2 h-4 w-4&quot; />
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={
              isProcessing ||
              (paymentMethod === &apos;cash&apos; && parseFloat(cashAmount) < total)
            }
          >
            {isProcessing ? (
              <div className=&quot;h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2&quot; />
            ) : (
              <Check className=&quot;mr-2 h-4 w-4&quot; />
            )}
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
