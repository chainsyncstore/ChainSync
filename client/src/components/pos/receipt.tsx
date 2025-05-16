import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TransactionReceipt from './transaction-receipt';

interface ReceiptProps {
  transaction: any;
  onClose: () => void;
}

export function Receipt({ transaction, onClose }: ReceiptProps) {
  return (
    <TransactionReceipt
      transaction={transaction}
      isOpen={true}
      onClose={onClose}
    />
  );
}
