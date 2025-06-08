import React from 'react';

import TransactionReceipt from './transaction-receipt';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ReceiptProps {
  transaction: any;
  onClose: () => void;
}

export function Receipt({ transaction, onClose }: ReceiptProps) {
  return <TransactionReceipt transaction={transaction} isOpen={true} onClose={onClose} />;
}
