import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

interface ProcessRefundProps {
  transaction: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProcessRefund({
  transaction,
  isOpen,
  onClose,
  onSuccess,
}: ProcessRefundProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refundMethod, setRefundMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [itemsToRefund, setItemsToRefund] = useState<{ 
    transactionItemId: number; 
    productId: number;
    name: string;
    quantity: number;
    maxQuantity: number;
    isPerishable: boolean;
    unitPrice: string;
    selected: boolean;
    refundQuantity: number;
    reasonPerItem: string;
  }[]>([]);

  // Initialize refund items from transaction
  useEffect(() => {
    if (transaction?.items) {
      const items = transaction.items.map((item: any) => ({
        transactionItemId: item.id,
        productId: item.productId,
        name: item.product?.name || "Unknown Product",
        quantity: item.quantity,
        maxQuantity: item.quantity - (item.returnedQuantity || 0),
        isPerishable: item.product?.isPerishable || false,
        unitPrice: item.unitPrice,
        selected: false,
        refundQuantity: 0,
        reasonPerItem: "",
      }));
      
      // Only show items that have available quantity to return
      setItemsToRefund(items.filter(item => item.maxQuantity > 0));
    }
  }, [transaction]);

  // Toggle item selection
  const toggleItemSelection = (index: number) => {
    const updatedItems = [...itemsToRefund];
    updatedItems[index].selected = !updatedItems[index].selected;
    
    // If selected, default refund quantity to max available
    if (updatedItems[index].selected && updatedItems[index].refundQuantity === 0) {
      updatedItems[index].refundQuantity = 1;
    }
    
    setItemsToRefund(updatedItems);
  };

  // Update refund quantity for an item
  const updateRefundQuantity = (index: number, quantity: number) => {
    const updatedItems = [...itemsToRefund];
    
    // Ensure quantity is within valid range
    let newQuantity = Math.max(0, quantity);
    newQuantity = Math.min(newQuantity, updatedItems[index].maxQuantity);
    
    updatedItems[index].refundQuantity = newQuantity;
    setItemsToRefund(updatedItems);
  };

  // Update reason for an item
  const updateItemReason = (index: number, itemReason: string) => {
    const updatedItems = [...itemsToRefund];
    updatedItems[index].reasonPerItem = itemReason;
    setItemsToRefund(updatedItems);
  };

  // Calculate total refund amount
  const calculateTotal = () => {
    return itemsToRefund
      .filter((item) => item.selected && item.refundQuantity > 0)
      .reduce((total, item) => {
        return total + parseFloat(item.unitPrice) * item.refundQuantity;
      }, 0);
  };

  // Process the refund
  const handleProcessRefund = async () => {
    // Validate if any items are selected
    const selectedItems = itemsToRefund.filter(
      (item) => item.selected && item.refundQuantity > 0
    );
    
    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to refund",
        variant: "destructive",
      });
      return;
    }
    
    // Validate if reason is provided
    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for the refund",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Format the refund items
      const refundItems = selectedItems.map((item) => ({
        transactionItemId: item.transactionItemId,
        quantity: item.refundQuantity,
        reason: item.reasonPerItem || reason,
      }));
      
      // Send the refund request
      const response = await apiRequest("POST", "/api/refunds", {
        transactionId: transaction.id,
        items: refundItems,
        refundMethod,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process refund");
      }
      
      // Success
      toast({
        title: "Refund processed successfully",
        description: `Refund amount: ₦${calculateTotal().toFixed(2)}`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/refunds'] });
      queryClient.invalidateQueries({ queryKey: [`/api/pos/transactions/${transaction.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/pos/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      
      // Close dialog and notify parent
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error processing refund:", error);
      toast({
        title: "Refund failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
          <DialogDescription>
            Transaction ID: {transaction?.transactionId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <Label htmlFor="refundMethod">Refund Method</Label>
            <Select
              value={refundMethod}
              onValueChange={setRefundMethod}
              disabled={isSubmitting}
            >
              <SelectTrigger id="refundMethod">
                <SelectValue placeholder="Select refund method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="store_credit">Store Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="reason">General Reason for Refund</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for refund"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="h-20"
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Select Items to Refund</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Refund Amount</TableHead>
                  <TableHead>Item-Specific Reason (Optional)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsToRefund.map((item, index) => (
                  <TableRow key={item.transactionItemId}>
                    <TableCell>
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItemSelection(index)}
                        disabled={isSubmitting || item.maxQuantity === 0}
                      />
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      {item.isPerishable ? (
                        <Badge variant="destructive">Perishable</Badge>
                      ) : (
                        <Badge variant="outline">Non-Perishable</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          min="0"
                          max={item.maxQuantity}
                          value={item.refundQuantity}
                          onChange={(e) =>
                            updateRefundQuantity(index, parseInt(e.target.value) || 0)
                          }
                          disabled={!item.selected || isSubmitting}
                          className="w-16"
                        />
                        <span className="text-xs text-muted-foreground">
                          / {item.maxQuantity} available
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>₦{parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell>
                      ₦
                      {item.selected
                        ? (
                            parseFloat(item.unitPrice) * item.refundQuantity
                          ).toFixed(2)
                        : "0.00"}
                    </TableCell>
                    <TableCell>
                      <Input 
                        placeholder="Specific reason"
                        value={item.reasonPerItem}
                        onChange={(e) => updateItemReason(index, e.target.value)}
                        disabled={!item.selected || isSubmitting}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {itemsToRefund.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4">
                      No items available for refund
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="bg-muted p-4 rounded-md">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Perishable items cannot be restocked to inventory
                </p>
                <p className="text-sm text-muted-foreground">
                  Non-perishable items will be automatically restocked
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="text-2xl font-bold">
                  ₦{calculateTotal().toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleProcessRefund}
            disabled={
              isSubmitting ||
              itemsToRefund.filter((item) => item.selected && item.refundQuantity > 0)
                .length === 0
            }
          >
            {isSubmitting ? <Spinner className="mr-2" /> : null}
            Process Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}