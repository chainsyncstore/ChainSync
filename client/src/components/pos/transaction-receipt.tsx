import React, { useState } from &apos;react&apos;;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from &apos;@/components/ui/dialog&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import ReceiptPrint from &apos;./receipt-print&apos;;
import ThermalPrinter from &apos;./thermal-printer&apos;;
import { SelectStore, SelectUser, SelectLoyaltyMember } from &apos;@shared/schema&apos;;
import { TransactionWithDetails } from &apos;@/types/analytics&apos;;

// Interface for transaction data
interface TransactionItem {
  _id: number;
  _productId: number;
  _productName: string;
  _quantity: number;
  _unitPrice: number;
  _subtotal: number;
}

interface Transaction {
  _id: number;
  _transactionId: string;
  _storeId: number;
  _userId: number;
  _cashierId: number;
  customerId?: number;
  loyaltyMemberId?: number;
  _subtotal: string;
  _tax: string;
  discount?: string | null;
  _total: string;
  _paymentMethod: string;
  _status: string;
  _createdAt: Date;
  store?: SelectStore;
  cashier?: SelectUser;
  customer?: SelectUser;
  loyaltyMember?: SelectLoyaltyMember;
  _items: TransactionItem[];
  pointsEarned?: number;
}

interface TransactionReceiptProps {
  _transaction: Transaction;
  _isOpen: boolean;
  onClose: () => void;
}

export const _TransactionReceipt: React.FC<TransactionReceiptProps> = ({
  transaction,
  isOpen,
  onClose
}) => {
  // Format data for the receipt component
  const receiptData = {
    _receiptNumber: transaction.transactionId,
    _storeName: transaction.store?.name || &apos;ChainSync Store&apos;,
    _storeAddress: transaction.store?.address
      ? `${transaction.store.address}, ${transaction.store.city || &apos;&apos;}, ${transaction.store.state || &apos;&apos;}`
      : undefined,
    _storePhone: transaction.store?.phone ?? undefined,
    _date: new Date(transaction.createdAt),
    _cashierName: transaction.cashier?.name || &apos;Cashier&apos;,
    _items: transaction.items.map(item => ({
      _name: item.productName,
      _quantity: item.quantity,
      _unitPrice: parseFloat(item.unitPrice.toString()),
      _subtotal: parseFloat(item.subtotal.toString())
    })),
    _subtotal: parseFloat(transaction.subtotal),
    _tax: parseFloat(transaction.tax),
    _discount: parseFloat(transaction.discount ?? &apos;0&apos;),
    _total: parseFloat(transaction.total),
    _paymentMethod: transaction.paymentMethod,
    _customerName: transaction.customer?.name,
    _loyaltyPoints: transaction.pointsEarned ? {
      _earned: transaction.pointsEarned,
      _balance: transaction.loyaltyMember?.points ?? transaction.pointsEarned
    } : undefined
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className=&quot;max-w-lg max-h-[90vh] overflow-y-auto&quot;>
        <DialogHeader>
          <DialogTitle>Transaction _Receipt: {transaction.transactionId}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue=&quot;standard&quot; className=&quot;w-full&quot;>
          <TabsList className=&quot;grid w-full grid-cols-2&quot;>
            <TabsTrigger value=&quot;standard&quot;>Standard Receipt</TabsTrigger>
            <TabsTrigger value=&quot;thermal&quot;>Thermal Printer</TabsTrigger>
          </TabsList>

          <TabsContent value=&quot;standard&quot; className=&quot;py-4&quot;>
            <ReceiptPrint
              data={receiptData}
              onClose={onClose}
            />
          </TabsContent>

          <TabsContent value=&quot;thermal&quot; className=&quot;py-4&quot;>
            {transaction.store && (
              <ThermalPrinter
                transaction={transaction as TransactionWithDetails}
                onClose={onClose}
              />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant=&quot;outline&quot; onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionReceipt;
