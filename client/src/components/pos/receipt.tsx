import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { useReactToPrint } from 'react-to-print';
import { Printer, X } from 'lucide-react';

interface ReceiptProps {
  transaction: any;
  onClose: () => void;
}

export function Receipt({ transaction, onClose }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: `Receipt-${transaction.transactionId}`,
  });
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Transaction Receipt</DialogTitle>
        </DialogHeader>
        
        <div ref={receiptRef} className="p-4 bg-white">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">ChainSync Market</h2>
            <p className="text-sm">{transaction.store?.name || "Store Location"}</p>
            <p className="text-sm">{transaction.store?.address || "123 Main Street"}</p>
            <p className="text-sm">{transaction.store?.phone || "(555) 123-4567"}</p>
          </div>
          
          <div className="flex justify-between text-sm mb-2">
            <span>Transaction #:</span>
            <span className="font-mono">{transaction.transactionId}</span>
          </div>
          
          <div className="flex justify-between text-sm mb-2">
            <span>Date:</span>
            <span>{formatDate(transaction.createdAt)}</span>
          </div>
          
          <div className="flex justify-between text-sm mb-2">
            <span>Time:</span>
            <span>{formatTime(transaction.createdAt)}</span>
          </div>
          
          <div className="flex justify-between text-sm mb-2">
            <span>Cashier:</span>
            <span>{transaction.cashier?.fullName || "Unknown"}</span>
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm font-medium">
              <span className="w-5/12">Item</span>
              <span className="w-2/12 text-right">Qty</span>
              <span className="w-2/12 text-right">Price</span>
              <span className="w-3/12 text-right">Total</span>
            </div>
            
            <Separator />
            
            {transaction.items.map((item: any, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="w-5/12 truncate">{item.name || item.product?.name}</span>
                <span className="w-2/12 text-right">{item.quantity}</span>
                <span className="w-2/12 text-right font-mono">{formatCurrency(item.unitPrice)}</span>
                <span className="w-3/12 text-right font-mono">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(transaction.subtotal)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span>Tax (8.25%):</span>
              <span className="font-mono">{formatCurrency(transaction.tax)}</span>
            </div>
            
            <div className="flex justify-between font-bold mt-2">
              <span>Total:</span>
              <span className="font-mono">{formatCurrency(transaction.total)}</span>
            </div>
            
            <div className="flex justify-between text-sm mt-4">
              <span>Payment Method:</span>
              <span className="capitalize">{transaction.paymentMethod}</span>
            </div>
            
            {transaction.status === 'pending sync' && (
              <div className="bg-amber-50 text-amber-800 p-2 text-xs text-center mt-4 rounded border border-amber-200">
                This transaction was processed in offline mode and will be synced when you're back online.
              </div>
            )}
          </div>
          
          <div className="text-center mt-6 text-sm">
            <p>Thank you for shopping with us!</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date().toLocaleString()}
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          <Button onClick={handlePrint} className="flex-1">
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
