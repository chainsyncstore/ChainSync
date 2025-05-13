import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/ui/data-table";
import { Separator } from "@/components/ui/separator";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";

// Refund page for managers to process refunds
export default function RefundsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Fetch refunds
  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/refunds', currentPage, pageSize],
    enabled: !!user,
  });

  // Show refund details
  const showRefundDetails = (refund: any) => {
    setSelectedRefund(refund);
    setIsDetailOpen(true);
  };

  // Close refund details
  const closeRefundDetails = () => {
    setIsDetailOpen(false);
    setSelectedRefund(null);
  };

  // Filter refunds by search term
  const filteredRefunds = data?.refunds?.filter((refund: any) => {
    return (
      refund.refundId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.reason.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }) || [];

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  // Handle view transaction
  const handleViewTransaction = (transactionId: number) => {
    setLocation(`/transactions/${transactionId}`);
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Refunds</h1>
            <p className="text-muted-foreground">
              View and manage refunds
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle>All Refunds</CardTitle>
              <div className="flex gap-2">
                <Input
                  placeholder="Search refunds..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : isError ? (
              <div className="h-80 flex items-center justify-center text-center">
                <div>
                  <p className="text-destructive mb-2">
                    Error loading refunds
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/refunds'] })}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : filteredRefunds.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-center">
                <div>
                  <p className="text-muted-foreground mb-2">
                    No refunds found
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Refund ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRefunds.map((refund: any) => (
                      <TableRow key={refund.id}>
                        <TableCell className="font-medium">
                          {refund.refundId}
                        </TableCell>
                        <TableCell>{formatDate(refund.createdAt)}</TableCell>
                        <TableCell>₦{Number(refund.total).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              refund.status === "completed"
                                ? "success"
                                : refund.status === "pending"
                                ? "outline"
                                : "destructive"
                            }
                          >
                            {refund.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{refund.reason}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showRefundDetails(refund)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {data?.pagination && (
                  <div className="mt-4 flex justify-end">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={data.pagination.totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Refund Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Refund Details</DialogTitle>
            <DialogDescription>
              Refund ID: {selectedRefund?.refundId}
            </DialogDescription>
          </DialogHeader>

          {selectedRefund && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Refund Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge
                        variant={
                          selectedRefund.status === "completed"
                            ? "success"
                            : selectedRefund.status === "pending"
                            ? "outline"
                            : "destructive"
                        }
                      >
                        {selectedRefund.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>{formatDate(selectedRefund.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method:</span>
                      <span>{selectedRefund.refundMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>₦{Number(selectedRefund.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax:</span>
                      <span>₦{Number(selectedRefund.tax).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>₦{Number(selectedRefund.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Reason & Notes</h3>
                  <div className="p-2 bg-muted rounded-md min-h-[100px]">
                    {selectedRefund.reason}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Refunded Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead className="text-right">Restocked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRefund.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name || "Unknown Product"}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₦{Number(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell>₦{Number(item.subtotal).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {item.isRestocked ? (
                            <Badge variant="success">Restocked</Badge>
                          ) : item.product?.isPerishable ? (
                            <Badge variant="destructive">Not Restockable (Perishable)</Badge>
                          ) : (
                            <Badge variant="secondary">Not Restocked</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => handleViewTransaction(selectedRefund.transactionId)}
                >
                  View Original Transaction
                </Button>
                <Button variant="default" onClick={closeRefundDetails}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}