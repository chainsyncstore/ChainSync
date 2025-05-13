import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { 
  RotateCcw, 
  AlertCircle, 
  Check, 
  X, 
  Percent,
  AlertTriangle
} from "lucide-react";

interface ProcessRefundProps {
  transactionId: number;
  onComplete: () => void;
}

export function ProcessRefund({ transactionId, onComplete }: ProcessRefundProps) {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<{
    [key: number]: { id: number; quantity: number; maxQuantity: number; reason: string }
  }>({});
  const [isFullRefund, setIsFullRefund] = useState(false);
  const [refundMethod, setRefundMethod] = useState("cash");
  const [generalReason, setGeneralReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch transaction details
  const {
    data: transaction,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [`/api/transactions/${transactionId}`],
    enabled: !!transactionId,
  });

  // Mutation for processing refund
  const processMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/refunds", data);
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transactionId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transactionId}/refunds`] });
      queryClient.invalidateQueries({ queryKey: ["/api/refunds"] });
      
      // Show success toast
      toast({
        title: "Refund processed successfully",
        description: "The items have been refunded.",
        variant: "default",
      });
      
      // Call the onComplete callback
      onComplete();
    },
    onError: (error: Error) => {
      console.error("Refund error:", error);
      toast({
        title: "Refund failed",
        description: error.message || "There was an error processing the refund.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  // Handle item selection toggle
  const handleItemToggle = (item: any) => {
    // If item is already selected, remove it from selection
    if (selectedItems[item.id]) {
      const updatedItems = { ...selectedItems };
      delete updatedItems[item.id];
      setSelectedItems(updatedItems);
    } else {
      // Otherwise add it with default quantity 1
      setSelectedItems({
        ...selectedItems,
        [item.id]: {
          id: item.id,
          quantity: 1,
          maxQuantity: item.quantity - item.returnedQuantity,
          reason: "",
        },
      });
    }
  };

  // Handle quantity change
  const handleQuantityChange = (id: number, value: string) => {
    const quantity = parseInt(value);
    if (isNaN(quantity) || quantity < 1) return;

    const maxQuantity = selectedItems[id].maxQuantity;
    const validQuantity = Math.min(quantity, maxQuantity);

    setSelectedItems({
      ...selectedItems,
      [id]: {
        ...selectedItems[id],
        quantity: validQuantity,
      },
    });
  };

  // Handle reason change
  const handleReasonChange = (id: number, reason: string) => {
    setSelectedItems({
      ...selectedItems,
      [id]: {
        ...selectedItems[id],
        reason,
      },
    });
  };

  // Handle full refund toggle
  useEffect(() => {
    if (isFullRefund && transaction?.items) {
      // Select all items with max quantity
      const allItems: { [key: number]: any } = {};
      transaction.items.forEach((item: any) => {
        const availableQuantity = item.quantity - item.returnedQuantity;
        if (availableQuantity > 0) {
          allItems[item.id] = {
            id: item.id,
            quantity: availableQuantity,
            maxQuantity: availableQuantity,
            reason: generalReason,
          };
        }
      });
      setSelectedItems(allItems);
    } else if (!isFullRefund && Object.keys(selectedItems).length > 0) {
      // Keep selected items but apply general reason to all
      const updatedItems = { ...selectedItems };
      Object.keys(updatedItems).forEach((key) => {
        updatedItems[parseInt(key)].reason = generalReason;
      });
      setSelectedItems(updatedItems);
    }
  }, [isFullRefund, transaction, generalReason]);

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return `₦${numAmount.toFixed(2)}`;
  };

  // Calculate refund total
  const calculateRefundTotal = () => {
    if (!transaction?.items) return 0;
    
    return Object.values(selectedItems).reduce((total, selected) => {
      const item = transaction.items.find((i: any) => i.id === selected.id);
      if (!item) return total;
      
      const itemTotal = parseFloat(item.unitPrice) * selected.quantity;
      return total + itemTotal;
    }, 0);
  };

  // Calculate tax based on the same rate as the original transaction
  const calculateRefundTax = () => {
    if (!transaction) return 0;
    
    const subtotal = calculateRefundTotal();
    const originalTaxRate = parseFloat(transaction.tax) / parseFloat(transaction.subtotal);
    return subtotal * originalTaxRate;
  };

  // Submit refund
  const handleSubmitRefund = async () => {
    if (Object.keys(selectedItems).length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to refund.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Transform selected items for API
    const refundItems = Object.values(selectedItems).map((selected) => ({
      transactionItemId: selected.id,
      quantity: selected.quantity,
      reason: selected.reason || generalReason || "Customer return",
    }));

    // Call the refund API
    processMutation.mutate({
      transactionId,
      items: refundItems,
      refundMethod,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-96 flex-col items-center justify-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h2 className="mt-4 text-xl font-semibold">Error Loading Transaction</h2>
        <p className="mb-4 text-center text-muted-foreground">
          Unable to load transaction details. Please try again.
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  // Check if any items are available for refund
  const hasRefundableItems = transaction?.items?.some(
    (item: any) => item.returnedQuantity < item.quantity
  );

  if (!hasRefundableItems) {
    return (
      <div className="flex h-96 flex-col items-center justify-center p-4">
        <Check className="h-16 w-16 text-success" />
        <h2 className="mt-4 text-xl font-semibold">All Items Already Refunded</h2>
        <p className="mb-4 text-center text-muted-foreground">
          There are no items available for refund in this transaction.
        </p>
        <Button onClick={onComplete}>Close</Button>
      </div>
    );
  }

  const subtotal = calculateRefundTotal();
  const tax = calculateRefundTax();
  const total = subtotal + tax;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none">
        <h2 className="text-xl font-semibold">Process Refund</h2>
        <p className="text-muted-foreground">
          Transaction #{transaction?.transactionId}
        </p>

        <Alert className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            Perishable items will not be restocked to inventory.
            Non-perishable items will be automatically added back to inventory.
          </AlertDescription>
        </Alert>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div>
          <div className="flex items-center justify-between">
            <Label>Refund Method</Label>
            <Select value={refundMethod} onValueChange={setRefundMethod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="store_credit">Store Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox 
            id="fullRefund" 
            checked={isFullRefund}
            onCheckedChange={(checked) => setIsFullRefund(!!checked)}
          />
          <label
            htmlFor="fullRefund"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Refund all items
          </label>
        </div>

        <div>
          <Label htmlFor="reason">Reason for Refund</Label>
          <Textarea
            id="reason"
            placeholder="General reason for the refund"
            value={generalReason}
            onChange={(e) => setGeneralReason(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex-grow overflow-auto">
        <h3 className="font-medium mb-2">Select Items to Refund</h3>
        <ScrollArea className="h-[300px] rounded-md border">
          <div className="p-4 space-y-4">
            {transaction?.items
              ?.filter((item: any) => item.returnedQuantity < item.quantity)
              .map((item: any) => {
                const availableQuantity = item.quantity - item.returnedQuantity;
                const isSelected = !!selectedItems[item.id];

                return (
                  <Card key={item.id} className={isSelected ? "border-primary" : ""}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between">
                        <div>
                          <CardTitle className="text-base">{item.product?.name}</CardTitle>
                          <CardDescription>
                            {formatCurrency(item.unitPrice)} × {availableQuantity} available
                          </CardDescription>
                        </div>
                        <div>
                          <Badge>
                            {item.product?.isPerishable ? "Perishable" : "Non-perishable"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`item-${item.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleItemToggle(item)}
                          />
                          <label
                            htmlFor={`item-${item.id}`}
                            className="text-sm font-medium leading-none"
                          >
                            Select for refund
                          </label>
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`quantity-${item.id}`} className="text-xs">Qty:</Label>
                            <Input
                              id={`quantity-${item.id}`}
                              type="number"
                              min={1}
                              max={availableQuantity}
                              value={selectedItems[item.id].quantity}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              className="w-16 h-8"
                            />
                          </div>
                        )}
                      </div>
                      
                      {isSelected && !generalReason && (
                        <div className="mt-2">
                          <Label htmlFor={`reason-${item.id}`} className="text-xs">Item reason:</Label>
                          <Input
                            id={`reason-${item.id}`}
                            placeholder="Reason for this item"
                            value={selectedItems[item.id].reason}
                            onChange={(e) => handleReasonChange(item.id, e.target.value)}
                            className="mt-1 h-8"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </ScrollArea>
      </div>

      <Separator className="my-4" />

      <div className="flex-none">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm">Subtotal:</div>
              <div className="text-sm text-right">{formatCurrency(subtotal)}</div>
              
              <div className="text-sm flex items-center">
                <Percent className="h-3 w-3 mr-1" />
                Tax:
              </div>
              <div className="text-sm text-right">{formatCurrency(tax)}</div>
              
              <div className="text-base font-bold">Total Refund:</div>
              <div className="text-base font-bold text-right">{formatCurrency(total)}</div>
            </div>
          </CardContent>
          <CardFooter className="px-4 py-3 flex justify-between">
            <Button
              variant="outline"
              onClick={onComplete}
              disabled={isSubmitting}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRefund}
              disabled={Object.keys(selectedItems).length === 0 || isSubmitting}
              className="min-w-32"
            >
              {isSubmitting ? (
                <Spinner className="mr-2" size="sm" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Process Refund
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}