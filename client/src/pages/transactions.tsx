import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/app-shell";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { CalendarDateRangePicker } from "@/components/ui/date-range-picker";

// Transactions page to view and manage transactions
export default function TransactionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [pageSize] = useState(10);

  // Fetch stores for filtering (if admin)
  const { data: stores } = useQuery({
    queryKey: ['/api/stores'],
    enabled: !!user && user.role === 'admin',
  });

  // State for selected store filter
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
    undefined
  );

  // Compute query parameters
  const queryParams = new URLSearchParams();
  queryParams.append("page", currentPage.toString());
  queryParams.append("limit", pageSize.toString());
  
  if (selectedStoreId) {
    queryParams.append("storeId", selectedStoreId);
  }
  
  if (dateRange.from) {
    queryParams.append("startDate", dateRange.from.toISOString());
  }
  
  if (dateRange.to) {
    queryParams.append("endDate", dateRange.to.toISOString());
  }

  // Fetch transactions
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [`/api/pos/transactions?${queryParams.toString()}`],
    enabled: !!user,
  });

  // Filter transactions by search term
  const filteredTransactions = data?.transactions?.filter((transaction: any) => {
    return (
      transaction.transactionId
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transaction.cashier?.fullName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transaction.store?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle view transaction details
  const handleViewTransaction = (transactionId: number) => {
    setLocation(`/transactions/${transactionId}`);
  };

  // Handle store filter change
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId === "all" ? undefined : storeId);
    setCurrentPage(1); // Reset to first page
  };

  // Handle date range change
  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    setDateRange(range);
    setCurrentPage(1); // Reset to first page
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedStoreId(undefined);
    setDateRange({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Transactions</h1>
            <p className="text-muted-foreground">
              View and manage transaction history
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {user?.role === "admin" && (
                <div>
                  <Select
                    value={selectedStoreId || "all"}
                    onValueChange={handleStoreChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      {stores?.map((store: any) => (
                        <SelectItem key={store.id} value={store.id.toString()}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <CalendarDateRangePicker
                  date={dateRange}
                  onChange={handleDateRangeChange}
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="mt-4"
              onClick={handleClearFilters}
              disabled={
                !searchTerm && !selectedStoreId && !dateRange.from && !dateRange.to
              }
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Transaction History</CardTitle>
            {data?.pagination && (
              <CardDescription>
                Showing {filteredTransactions?.length || 0} of{" "}
                {data.pagination.totalItems} transactions
              </CardDescription>
            )}
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
                    Error loading transactions
                  </p>
                  <Button variant="outline" onClick={() => refetch()}>
                    Try Again
                  </Button>
                </div>
              </div>
            ) : !filteredTransactions || filteredTransactions.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-center">
                <div>
                  <p className="text-muted-foreground mb-2">
                    No transactions found
                  </p>
                  <Button variant="outline" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Cashier</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction: any) => {
                      // Check if any items have been refunded
                      const hasRefundedItems = transaction.items?.some(
                        (item: any) => item.returnedQuantity > 0
                      );
                      
                      // Check if all items have been fully refunded
                      const isFullyRefunded = transaction.items?.every(
                        (item: any) => 
                          item.returnedQuantity === item.quantity
                      );
                      
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">
                            {transaction.transactionId}
                          </TableCell>
                          <TableCell>
                            {formatDate(transaction.createdAt)}
                          </TableCell>
                          <TableCell>
                            {transaction.store?.name || "Unknown Store"}
                          </TableCell>
                          <TableCell>
                            {transaction.cashier?.fullName || "Unknown"}
                          </TableCell>
                          <TableCell>
                            ₦{parseFloat(transaction.total).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                isFullyRefunded
                                  ? "destructive"
                                  : hasRefundedItems
                                  ? "warning"
                                  : transaction.status === "completed"
                                  ? "success"
                                  : "secondary"
                              }
                            >
                              {isFullyRefunded
                                ? "Fully Refunded"
                                : hasRefundedItems
                                ? "Partially Refunded"
                                : transaction.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleViewTransaction(transaction.id)
                              }
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {data?.pagination && data.pagination.totalPages > 1 && (
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
    </AppShell>
  );
}