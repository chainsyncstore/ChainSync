import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/providers/auth-provider";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { ProcessRefund } from "@/components/pos/process-refund";

// Transaction details page for viewing transactions and processing refunds
export default function TransactionDetailsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const params = useParams();
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("details");

  // Extract transaction ID from URL parameters
  const transactionId = params.id ? parseInt(params.id) : undefined;

  // Fetch transaction details
  const {
    data: transaction,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [`/api/pos/transactions/${transactionId}`],
    enabled: !!transactionId && !!user,
  });

  // Fetch refunds for this transaction
  const {
    data: refunds,
    isLoading: isLoadingRefunds,
    isError: isErrorRefunds,
    refetch: refetchRefunds,
  } = useQuery({
    queryKey: [`/api/transactions/${transactionId}/refunds`],
    enabled: !!transactionId && !!user,
  });

  // Handle success of refund process
  const handleRefundSuccess = () => {
    refetch();
    refetchRefunds();
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  // Calculate the total amount of refunded items
  const calculateRefundedAmount = (item: any) => {
    if (!item.returnedQuantity) return 0;
    return parseFloat(item.unitPrice) * item.returnedQuantity;
  };

  // Check if any items have been refunded
  const hasRefundedItems = transaction?.items?.some(
    (item: any) => item.returnedQuantity > 0
  );

  // Check if all items have been fully refunded
  const isFullyRefunded = transaction?.items?.every(
    (item: any) => item.returnedQuantity === item.quantity
  );

  // Check if any items are available for refund
  const hasRefundableItems = transaction?.items?.some(
    (item: any) => (item.quantity || 0) - (item.returnedQuantity || 0) > 0
  );

  // Check if user has permission to process refunds (admin or manager)
  const canProcessRefunds = user?.role === "admin" || user?.role === "manager";

  // Navigate back to transactions list
  const handleBack = () => {
    setLocation("/transactions");
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Transaction Details</h1>
            <p className="text-muted-foreground">
              View and manage transaction information
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleBack}>
              Back to Transactions
            </Button>
            {canProcessRefunds && hasRefundableItems && !isFullyRefunded && (
              <Button
                onClick={() => setIsRefundDialogOpen(true)}
                variant="default"
                disabled={isLoading || !transaction}
              >
                Process Refund
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : isError ? (
          <div className="h-80 flex items-center justify-center text-center">
            <div>
              <p className="text-destructive mb-2">
                Error loading transaction details
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          </div>
        ) : !transaction ? (
          <div className="h-80 flex items-center justify-center text-center">
            <div>
              <p className="text-muted-foreground mb-2">
                Transaction not found or you don't have permission to view it
              </p>
              <Button variant="outline" onClick={handleBack}>
                Go Back
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle>Transaction #{transaction.transactionId}</CardTitle>
                <CardDescription>
                  {formatDate(transaction.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Status</h3>
                    <div className="flex items-center">
                      <Badge
                        variant={
                          isFullyRefunded
                            ? "destructive"
                            : hasRefundedItems
                            ? "warning"
                            : "success"
                        }
                      >
                        {isFullyRefunded
                          ? "Fully Refunded"
                          : hasRefundedItems
                          ? "Partially Refunded"
                          : transaction.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Store</h3>
                    <p>{transaction.store?.name || "Unknown Store"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Cashier</h3>
                    <p>{transaction.cashier?.fullName || "Unknown Cashier"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Subtotal</h3>
                    <p>₦{parseFloat(transaction.subtotal).toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Tax</h3>
                    <p>₦{parseFloat(transaction.tax).toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Total</h3>
                    <p className="text-lg font-bold">
                      ₦{parseFloat(transaction.total).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Payment Method</h3>
                    <p className="capitalize">
                      {transaction.paymentMethod.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Offline Transaction</h3>
                    <p>{transaction.isOfflineTransaction ? "Yes" : "No"}</p>
                  </div>
                  {transaction.isOfflineTransaction && (
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Synced</h3>
                      <p>
                        {transaction.syncedAt
                          ? formatDate(transaction.syncedAt)
                          : "Not synced"}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="details">Items</TabsTrigger>
                <TabsTrigger value="refunds">
                  Refunds {refunds?.length ? `(${refunds.length})` : ""}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Transaction Items</CardTitle>
                    {hasRefundedItems && (
                      <CardDescription>
                        Some items in this transaction have been refunded
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead>Refunded</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transaction.items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.product?.name || "Unknown Product"}
                            </TableCell>
                            <TableCell>
                              {item.product?.isPerishable ? (
                                <Badge variant="destructive">Perishable</Badge>
                              ) : (
                                <Badge variant="outline">Non-Perishable</Badge>
                              )}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>₦{parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                            <TableCell>₦{parseFloat(item.subtotal).toFixed(2)}</TableCell>
                            <TableCell>
                              {item.returnedQuantity ? (
                                <div>
                                  <Badge
                                    variant={
                                      item.returnedQuantity === item.quantity
                                        ? "destructive"
                                        : "warning"
                                    }
                                  >
                                    {item.returnedQuantity} / {item.quantity}
                                  </Badge>
                                  <p className="text-xs mt-1">
                                    ₦{calculateRefundedAmount(item).toFixed(2)}
                                  </p>
                                </div>
                              ) : (
                                "None"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="refunds">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Refund History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingRefunds ? (
                      <div className="h-40 flex items-center justify-center">
                        <Spinner size="md" />
                      </div>
                    ) : isErrorRefunds ? (
                      <div className="h-40 flex items-center justify-center text-center">
                        <div>
                          <p className="text-destructive mb-2">
                            Error loading refunds
                          </p>
                          <Button variant="outline" onClick={() => refetchRefunds()}>
                            Try Again
                          </Button>
                        </div>
                      </div>
                    ) : !refunds || refunds.length === 0 ? (
                      <div className="h-40 flex items-center justify-center text-center">
                        <p className="text-muted-foreground">
                          No refunds have been processed for this transaction
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Refund ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Processed By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {refunds.map((refund: any) => (
                            <TableRow key={refund.id}>
                              <TableCell className="font-medium">
                                {refund.refundId}
                              </TableCell>
                              <TableCell>{formatDate(refund.createdAt)}</TableCell>
                              <TableCell className="capitalize">
                                {refund.refundMethod.replace("_", " ")}
                              </TableCell>
                              <TableCell>{refund.reason}</TableCell>
                              <TableCell>₦{parseFloat(refund.total).toFixed(2)}</TableCell>
                              <TableCell>
                                {refund.processedBy?.fullName || "Unknown"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Process Refund Dialog */}
            {transaction && (
              <ProcessRefund
                transaction={transaction}
                isOpen={isRefundDialogOpen}
                onClose={() => setIsRefundDialogOpen(false)}
                onSuccess={handleRefundSuccess}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}