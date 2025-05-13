import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistance } from "date-fns";

import {
  ChevronLeft,
  Receipt,
  Printer,
  RotateCcw,
  Calendar,
  Store,
  User,
  DollarSign,
  Percent,
  CreditCard,
  CloudOff,
  RefreshCw,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProcessRefund } from "@/components/pos/process-refund";
import { useAuth } from "@/providers/auth-provider";

export default function TransactionDetailsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [match, params] = useRoute<{ id: string }>("/transactions/:id");
  const [, setLocation] = useLocation();
  const [isRefundSheetOpen, setIsRefundSheetOpen] = useState(false);

  const transactionId = match ? parseInt(params.id) : undefined;

  // Fetch transaction details
  const {
    data: transaction,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [`/api/transactions/${transactionId}`],
    enabled: !!transactionId,
  });

  // Fetch refunds for the transaction
  const { data: refunds } = useQuery({
    queryKey: [`/api/transactions/${transactionId}/refunds`],
    enabled: !!transactionId,
  });

  const handleRefundComplete = () => {
    setIsRefundSheetOpen(false);
    refetch();
    toast({
      title: "Refund processed",
      description: "The refund has been processed successfully.",
      variant: "default",
    });
  };

  const handleBackClick = () => {
    setLocation("/transactions");
  };

  // Helper function to calculate total amount refunded
  const calculateTotalRefunded = () => {
    if (!refunds || !refunds.length) return "0.00";
    return refunds
      .reduce((total: number, refund: any) => {
        return total + parseFloat(refund.total);
      }, 0)
      .toFixed(2);
  };

  // Helper to check if an item has been fully refunded
  const isItemFullyRefunded = (item: any) => {
    if (!item) return false;
    return item.quantity === item.returnedQuantity;
  };

  // Check if all items have been fully refunded
  const areAllItemsRefunded = () => {
    if (!transaction?.items || transaction.items.length === 0) return false;
    return transaction.items.every(isItemFullyRefunded);
  };

  // Check if any items are left to refund
  const hasRefundableItems = () => {
    if (!transaction?.items || transaction.items.length === 0) return false;
    return transaction.items.some((item: any) => item.returnedQuantity < item.quantity);
  };

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return `₦${numAmount.toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "success";
      case "pending":
        return "warning";
      case "cancelled":
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell>
        <div className="flex h-screen flex-col items-center justify-center">
          <h1 className="text-xl font-semibold text-destructive">
            Error loading transaction
          </h1>
          <p className="mb-4 text-muted-foreground">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleBackClick} variant="outline">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Transactions
            </Button>
            <Button onClick={() => refetch()}>Try Again</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleBackClick}
              variant="outline"
              size="icon"
              className="h-10 w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                Transaction: {transaction?.transactionId}
              </h1>
              <p className="text-muted-foreground">
                {transaction?.createdAt && formatDate(transaction.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
            {user?.role === "manager" || user?.role === "admin" ? (
              <Sheet open={isRefundSheetOpen} onOpenChange={setIsRefundSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    disabled={!hasRefundableItems() || areAllItemsRefunded()}
                    variant={areAllItemsRefunded() ? "outline" : "default"}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {areAllItemsRefunded() ? "Fully Refunded" : "Process Refund"}
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-xl">
                  {transactionId && (
                    <ProcessRefund
                      transactionId={transactionId}
                      onComplete={handleRefundComplete}
                    />
                  )}
                </SheetContent>
              </Sheet>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Transaction summary */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex justify-between">
                <div>
                  <CardTitle>Transaction Details</CardTitle>
                  <CardDescription>Summary and items</CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(transaction?.status || "unknown")}>
                  {transaction?.status || "Unknown"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Store:</span>{" "}
                  {transaction?.store?.name || "Unknown Store"}
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Cashier:</span>{" "}
                  {transaction?.cashier?.fullName || "Unknown"}
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Subtotal:</span>{" "}
                  {formatCurrency(transaction?.subtotal || "0")}
                </div>
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Tax:</span>{" "}
                  {formatCurrency(transaction?.tax || "0")}
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary font-bold" />
                  <span className="font-bold">Total:</span>{" "}
                  <span className="font-bold">
                    {formatCurrency(transaction?.total || "0")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Payment Method:</span>{" "}
                  <span className="capitalize">
                    {transaction?.paymentMethod?.replace("_", " ") || "Unknown"}
                  </span>
                </div>
                {transaction?.isOfflineTransaction && (
                  <div className="col-span-2 flex items-center gap-2">
                    {transaction?.isOfflineTransaction ? (
                      transaction?.syncedAt ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-success" />
                          <span>
                            Offline transaction, synced{" "}
                            {formatDistance(
                              new Date(transaction.syncedAt),
                              new Date(),
                              { addSuffix: true }
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CloudOff className="h-4 w-4 text-warning" />
                          <span>
                            Offline transaction, not yet synced
                          </span>
                        </div>
                      )
                    ) : null}
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              {/* Items list */}
              <div>
                <h3 className="mb-2 font-medium">Items ({transaction?.items?.length || 0})</h3>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-4">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left">Product</th>
                          <th className="pb-2 text-center">Quantity</th>
                          <th className="pb-2 text-right">Unit Price</th>
                          <th className="pb-2 text-right">Total</th>
                          <th className="pb-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transaction?.items?.map((item: any) => (
                          <tr key={item.id} className="border-b">
                            <td className="py-2">
                              <div>
                                <p className="font-medium">{item.product?.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.product?.isPerishable ? "Perishable" : "Non-perishable"}
                                </p>
                              </div>
                            </td>
                            <td className="py-2 text-center">
                              {item.returnedQuantity > 0 ? (
                                <span>
                                  {item.quantity - item.returnedQuantity} / {item.quantity}
                                </span>
                              ) : (
                                item.quantity
                              )}
                            </td>
                            <td className="py-2 text-right">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="py-2 text-right">
                              {formatCurrency(item.subtotal)}
                            </td>
                            <td className="py-2 text-right">
                              {item.returnedQuantity > 0 ? (
                                <Badge
                                  variant={
                                    isItemFullyRefunded(item)
                                      ? "destructive"
                                      : "warning"
                                  }
                                >
                                  {isItemFullyRefunded(item)
                                    ? "Fully Refunded"
                                    : `Partially Refunded (${item.returnedQuantity})`}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Completed</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>

              {/* Refund info if applicable */}
              {refunds && refunds.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h3 className="mb-2 font-medium">Refunds ({refunds.length})</h3>
                    <ScrollArea className="h-[150px] rounded-md border">
                      <div className="p-4">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="pb-2 text-left">Refund ID</th>
                              <th className="pb-2 text-left">Date</th>
                              <th className="pb-2 text-left">Processed By</th>
                              <th className="pb-2 text-left">Method</th>
                              <th className="pb-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {refunds.map((refund: any) => (
                              <tr key={refund.id} className="border-b">
                                <td className="py-2">{refund.refundId}</td>
                                <td className="py-2">
                                  {formatDate(refund.createdAt)}
                                </td>
                                <td className="py-2">
                                  {refund.processedBy?.fullName || "Unknown"}
                                </td>
                                <td className="py-2 capitalize">
                                  {refund.refundMethod.replace("_", " ")}
                                </td>
                                <td className="py-2 text-right font-medium text-destructive">
                                  {formatCurrency(refund.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Refund summary */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Refund Summary
                </div>
              </CardTitle>
              <CardDescription>
                Refund status and remaining balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <div className="font-semibold">Total Amount</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(transaction?.total || "0")}
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-3">
                  <div className="font-semibold text-destructive">
                    Total Refunded
                  </div>
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrency(calculateTotalRefunded())}
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-3">
                  <div className="font-semibold">Remaining</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      Math.max(
                        0,
                        parseFloat(transaction?.total || "0") -
                          parseFloat(calculateTotalRefunded())
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-3">
                  <div className="font-semibold">Refund Status</div>
                  <div className="mt-1">
                    {areAllItemsRefunded() ? (
                      <Badge className="text-base" variant="destructive">
                        Fully Refunded
                      </Badge>
                    ) : refunds && refunds.length > 0 ? (
                      <Badge className="text-base" variant="warning">
                        Partially Refunded
                      </Badge>
                    ) : (
                      <Badge className="text-base" variant="outline">
                        No Refunds
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              {user?.role === "manager" || user?.role === "admin" ? (
                <Button
                  onClick={() => setIsRefundSheetOpen(true)}
                  disabled={!hasRefundableItems() || areAllItemsRefunded()}
                  className="w-full"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {areAllItemsRefunded()
                    ? "Fully Refunded"
                    : "Process Refund"}
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}