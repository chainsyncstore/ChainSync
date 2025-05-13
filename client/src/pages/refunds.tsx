import { useState } from "react";
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

// Refunds page to view all refunds
export default function RefundsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [pageSize] = useState(10);
  const [, params] = useRoute("/refunds/:id");
  const [location, setLocation] = useLocation();

  // Fetch stores for filtering (if admin)
  const { data: stores } = useQuery({
    queryKey: ["/api/stores"],
    enabled: !!user && user.role === "admin",
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

  // Fetch refunds
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [`/api/refunds?${queryParams.toString()}`],
    enabled: !!user,
  });

  // Filter refunds by search term
  const filteredRefunds = data?.refunds?.filter((refund: any) => {
    return (
      refund.refundId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.transaction?.transactionId
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      refund.processedBy?.fullName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      refund.transaction?.store?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
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
    setDateRange(range as { from: Date | undefined; to: Date | undefined });
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
            <h1 className="text-3xl font-bold">Refunds</h1>
            <p className="text-muted-foreground">
              View and manage refund history
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
                  placeholder="Search refunds..."
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
            <CardTitle>Refund History</CardTitle>
            {data?.pagination && (
              <CardDescription>
                Showing {filteredRefunds?.length || 0} of{" "}
                {data.pagination.totalItems} refunds
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
                    Error loading refunds
                  </p>
                  <Button variant="outline" onClick={() => refetch()}>
                    Try Again
                  </Button>
                </div>
              </div>
            ) : !filteredRefunds || filteredRefunds.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-center">
                <div>
                  <p className="text-muted-foreground mb-2">
                    No refunds found
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
                      <TableHead>Refund ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Processed By</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRefunds.map((refund: any) => (
                      <TableRow key={refund.id}>
                        <TableCell className="font-medium">
                          {refund.refundId}
                        </TableCell>
                        <TableCell>
                          {formatDate(refund.createdAt)}
                        </TableCell>
                        <TableCell>
                          {refund.transaction?.transactionId || "Unknown"}
                        </TableCell>
                        <TableCell>
                          {refund.transaction?.store?.name || "Unknown Store"}
                        </TableCell>
                        <TableCell>
                          {refund.processedBy?.fullName || "Unknown"}
                        </TableCell>
                        <TableCell className="capitalize">
                          {refund.refundMethod.replace("_", " ")}
                        </TableCell>
                        <TableCell>
                          ₦{parseFloat(refund.total).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              refund.status === "completed"
                                ? "outline"
                                : refund.status === "failed"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {refund.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleViewTransaction(refund.transactionId)
                            }
                          >
                            View Transaction
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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