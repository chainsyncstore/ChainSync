import { Trash2, CreditCard, AlertOctagon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';

interface CartProps {
  items: Array<{
    productId: number;
    name: string;
    barcode: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  onRemove: (index: number) => void;
  onQuantityChange: (index: number, quantity: number) => void;
  onProcessPayment: () => void;
  onVoidTransaction: () => void;
  setActiveInput: (inputId: string | null) => void;
  isLoading: boolean;
}

export function Cart({
  items,
  subtotal,
  tax,
  total,
  onRemove,
  onQuantityChange,
  onProcessPayment,
  onVoidTransaction,
  setActiveInput,
  isLoading,
}: CartProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Current Transaction</CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-y">
          <div className="max-h-[300px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <svg
                  className="w-12 h-12 mb-3 text-muted-foreground/50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  ></path>
                </svg>
                <p>No items in cart</p>
                <p className="text-sm">Scan or search products to add them to the cart</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right w-20">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={`${item.productId}-${index}`}>
                      <TableCell className="font-medium">
                        <div>
                          {item.name}
                          <div className="text-xs text-muted-foreground">{item.barcode}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.quantity}
                          min={1}
                          onChange={e => {
                            const newValue = parseInt(e.target.value);
                            if (!isNaN(newValue) && newValue > 0) {
                              onQuantityChange(index, newValue);
                            }
                          }}
                          onClick={() => setActiveInput(`quantity-${index}`)}
                          onFocus={() => setActiveInput(`quantity-${index}`)}
                          className="w-16 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(item.subtotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemove(index)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tax (8.25%):</span>
            <span className="font-mono">{formatCurrency(tax)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold">
            <span>Total:</span>
            <span className="font-mono text-lg">{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col space-y-2 sm:flex-row sm:justify-between sm:space-y-0 sm:space-x-2 p-4 pt-0">
        <Button
          variant="destructive"
          onClick={onVoidTransaction}
          disabled={items.length === 0 || isLoading}
          className="w-full sm:w-auto"
        >
          <AlertOctagon className="mr-2 h-4 w-4" />
          Void Transaction
        </Button>

        <Button
          onClick={onProcessPayment}
          disabled={items.length === 0 || isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
          ) : (
            <CreditCard className="mr-2 h-4 w-4" />
          )}
          Process Payment
        </Button>
      </CardFooter>
    </Card>
  );
}
