import React from &apos;react&apos;;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from &apos;@/components/ui/dialog&apos;;
import TransactionReceipt from &apos;./transaction-receipt&apos;;

interface ReceiptProps {
  _transaction: any;
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
