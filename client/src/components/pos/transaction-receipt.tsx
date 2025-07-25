import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReceiptPrint from './receipt-print';
import ThermalPrinter from './thermal-printer';
import { SelectStore, SelectUser, SelectLoyaltyMember } from '@shared/schema';
import { TransactionWithDetails } from '@/types/analytics';

// Interface for transaction data
interface TransactionItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Transaction {
  id: number;
  transactionId: string;
  storeId: number;
  userId: number;
  cashierId: number;
  customerId?: number;
  loyaltyMemberId?: number;
  subtotal: string;
  tax: string;
  discount?: string | null;
  total: string;
  paymentMethod: string;
  status: string;
  createdAt: Date;
  store?: SelectStore;
  cashier?: SelectUser;
  customer?: SelectUser;
  loyaltyMember?: SelectLoyaltyMember;
  items: TransactionItem[];
  pointsEarned?: number;
}

interface TransactionReceiptProps {
  transaction: Transaction;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionReceipt: React.FC<TransactionReceiptProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  // Format data for the receipt component
  const receiptData = {
    receiptNumber: transaction.transactionId,
    storeName: transaction.store?.name || 'ChainSync Store',
    storeAddress: transaction.store?.address 
      ? `${transaction.store.address}, ${transaction.store.city || ''}, ${transaction.store.state || ''}`
      : undefined,
    storePhone: transaction.store?.phone ?? undefined,
    date: new Date(transaction.createdAt),
    cashierName: transaction.cashier?.name || 'Cashier',
    items: transaction.items.map(item => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice.toString()),
      subtotal: parseFloat(item.subtotal.toString()),
    })),
    subtotal: parseFloat(transaction.subtotal),
    tax: parseFloat(transaction.tax),
    discount: parseFloat(transaction.discount ?? '0'),
    total: parseFloat(transaction.total),
    paymentMethod: transaction.paymentMethod,
    customerName: transaction.customer?.name,
    loyaltyPoints: transaction.pointsEarned ? {
      earned: transaction.pointsEarned,
      balance: transaction.loyaltyMember?.points ?? transaction.pointsEarned,
    } : undefined,
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction Receipt: {transaction.transactionId}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="standard">Standard Receipt</TabsTrigger>
            <TabsTrigger value="thermal">Thermal Printer</TabsTrigger>
          </TabsList>
          
          <TabsContent value="standard" className="py-4">
            <ReceiptPrint
              data={receiptData}
              onClose={onClose}
            />
          </TabsContent>
          
          <TabsContent value="thermal" className="py-4">
            {transaction.store && (
              <ThermalPrinter
                transaction={transaction as TransactionWithDetails}
                onClose={onClose}
              />
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionReceipt;
