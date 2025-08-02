import React from &apos;react&apos;;
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from &apos;@/components/ui/card&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { formatCurrency } from &apos;@/lib/utils&apos;;
import { Trash2, CreditCard, AlertOctagon } from &apos;lucide-react&apos;;
import { Separator } from &apos;@/components/ui/separator&apos;;

interface CartProps {
  _items: Array<{
    _productId: number;
    _name: string;
    _barcode: string;
    _quantity: number;
    _unitPrice: number;
    _subtotal: number;
  }>;
  _subtotal: number;
  _tax: number;
  _total: number;
  onRemove: (_index: number) => void;
  _onQuantityChange: (_index: number, _quantity: number) => void;
  _onProcessPayment: () => void;
  _onVoidTransaction: () => void;
  _setActiveInput: (_inputId: string | null) => void;
  _isLoading: boolean;
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
  isLoading
}: CartProps) {
  return (
    <Card>
      <CardHeader className=&quot;pb-3&quot;>
        <CardTitle className=&quot;text-lg font-medium&quot;>Current Transaction</CardTitle>
      </CardHeader>

      <CardContent className=&quot;p-0&quot;>
        <div className=&quot;border-y&quot;>
          <div className=&quot;max-h-[300px] overflow-y-auto&quot;>
            {items.length === 0 ? (
              <div className=&quot;flex flex-col items-center justify-center py-8 text-muted-foreground&quot;>
                <svg className=&quot;w-12 h-12 mb-3 text-muted-foreground/50&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;>
                  <path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth=&quot;1.5&quot; d=&quot;M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z&quot; />
                </svg>
                <p>No items in cart</p>
                <p className=&quot;text-sm&quot;>Scan or search products to add them to the cart</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className=&quot;text-right w-20&quot;>Qty</TableHead>
                    <TableHead className=&quot;text-right&quot;>Price</TableHead>
                    <TableHead className=&quot;text-right&quot;>Total</TableHead>
                    <TableHead className=&quot;w-10&quot; />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={`${item.productId}-${index}`}>
                      <TableCell className=&quot;font-medium&quot;>
                        <div>
                          {item.name}
                          <div className=&quot;text-xs text-muted-foreground&quot;>{item.barcode}</div>
                        </div>
                      </TableCell>
                      <TableCell className=&quot;text-right&quot;>
                        <Input
                          type=&quot;number&quot;
                          value={item.quantity}
                          min={1}
                          onChange={(e) => {
                            const newValue = parseInt(e.target.value);
                            if (!isNaN(newValue) && newValue > 0) {
                              onQuantityChange(index, newValue);
                            }
                          }}
                          onClick={() => setActiveInput(`quantity-${index}`)}
                          onFocus={() => setActiveInput(`quantity-${index}`)}
                          className=&quot;w-16 text-right&quot;
                        />
                      </TableCell>
                      <TableCell className=&quot;text-right font-mono&quot;>
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className=&quot;text-right font-mono font-bold&quot;>
                        {formatCurrency(item.subtotal)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant=&quot;ghost&quot;
                          size=&quot;icon&quot;
                          onClick={() => onRemove(index)}
                          className=&quot;h-8 w-8 text-destructive&quot;
                        >
                          <Trash2 className=&quot;h-4 w-4&quot; />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className=&quot;p-4 space-y-2&quot;>
          <div className=&quot;flex justify-between text-sm&quot;>
            <span>Subtotal:</span>
            <span className=&quot;font-mono&quot;>{formatCurrency(subtotal)}</span>
          </div>
          <div className=&quot;flex justify-between text-sm&quot;>
            <span>Tax (8.25%):</span>
            <span className=&quot;font-mono&quot;>{formatCurrency(tax)}</span>
          </div>
          <Separator className=&quot;my-2&quot; />
          <div className=&quot;flex justify-between font-bold&quot;>
            <span>Total:</span>
            <span className=&quot;font-mono text-lg&quot;>{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className=&quot;flex flex-col space-y-2 _sm:flex-row _sm:justify-between _sm:space-y-0 _sm:space-x-2 p-4 pt-0&quot;>
        <Button
          variant=&quot;destructive&quot;
          onClick={onVoidTransaction}
          disabled={items.length === 0 || isLoading}
          className=&quot;w-full _sm:w-auto&quot;
        >
          <AlertOctagon className=&quot;mr-2 h-4 w-4&quot; />
          Void Transaction
        </Button>

        <Button
          onClick={onProcessPayment}
          disabled={items.length === 0 || isLoading}
          className=&quot;w-full _sm:w-auto&quot;
        >
          {isLoading ? (
            <div className=&quot;h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2&quot; />
          ) : (
            <CreditCard className=&quot;mr-2 h-4 w-4&quot; />
          )}
          Process Payment
        </Button>
      </CardFooter>
    </Card>
  );
}
