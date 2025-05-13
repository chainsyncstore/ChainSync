import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  RefreshCw,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CloudOff,
  X,
  Download,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { CalendarDateRangePicker } from "@/components/ui/date-range-picker";
import { useToast } from "@/hooks/use-toast";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";

export default function TransactionsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [date, setDate] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Construct the query params
  const queryParams = new URLSearchParams();
  queryParams.append("page", currentPage.toString());
  
  if (date.from) {
    queryParams.append("startDate", date.from.toISOString());
  }
  if (date.to) {
    queryParams.append("endDate", date.to.toISOString());
  }
  if (statusFilter !== "all") {
    queryParams.append("status", statusFilter);
  }
  if (searchTerm) {
    queryParams.append("search", searchTerm);
  }

  // Fetch transactions with filters
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [`/api/transactions?${queryParams.toString()}`],
  });

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle date change
  const handleDateChange = (range: { from?: Date; to?: Date }) => {
    setDate(range as { from: Date | undefined; to: Date | undefined });
    setCurrentPage(1); // Reset to first page when changing filters
  };

  // Handle status filter change
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1); // Reset to first page when changing filters
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDate({ from: undefined, to: undefined });
    setCurrentPage(1);
  };

  // Navigate to transaction details
  const viewTransaction = (id: number) => {
    setLocation(`/transactions/${id}`);
  };

  // Format date
  const formatDate = (dateString: string) => {
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
        return "secondary";
    }
  };

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return `₦${numAmount.toFixed(2)}`;
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
          <div className="text-destructive mb-4 text-4xl">
            <X className="h-16 w-16" />
          </div>
          <h1 className="text-xl font-semibold text-destructive">Error loading transactions</h1>
          <p className="mb-4 text-muted-foreground">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Transactions</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Date Range</span>
                <CalendarDateRangePicker 
                  date={date}
                  onChange={handleDateChange}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Status</span>
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Search Transaction</span>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input
                    placeholder="Transaction ID, Customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button type="submit" size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                </form>
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  disabled={!searchTerm && statusFilter === "all" && !date.from && !date.to}
                  className="w-full"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium">
                {data?.pagination?.total ? (currentPage - 1) * data.pagination.perPage + 1 : 0}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {data?.pagination?.total
                  ? Math.min(currentPage * data.pagination.perPage, data.pagination.total)
                  : 0}
              </span>{" "}
              of <span className="font-medium">{data?.pagination?.total || 0}</span> transactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data?.transactions?.some((t: any) => t.isOfflineTransaction && !t.syncedAt) && (
              <Badge variant="warning" className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                <span>Unsynced offline transactions</span>
              </Badge>
            )}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.transactions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                data?.transactions?.map((transaction: any) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {transaction.transactionId || transaction.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatDate(transaction.createdAt)}</span>
                        {transaction.isOfflineTransaction && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {transaction.syncedAt ? (
                              <RefreshCw className="h-3 w-3 text-success" />
                            ) : (
                              <CloudOff className="h-3 w-3 text-warning" />
                            )}
                            <span>
                              {transaction.syncedAt
                                ? "Synced"
                                : "Offline"}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{transaction.store?.name || "Unknown"}</TableCell>
                    <TableCell>{transaction.cashier?.fullName || "Unknown"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {transaction.items?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(transaction.subtotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(transaction.tax)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(transaction.total)}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {transaction.paymentMethod
                          ? transaction.paymentMethod.replace("_", " ")
                          : "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewTransaction(transaction.id)}
                      >
                        View
                      </Button>
                      {transaction.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewTransaction(transaction.id)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Refund
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {data?.pagination?.total > 0 && (
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {/* First page */}
              {currentPage > 3 && (
                <PaginationItem>
                  <PaginationLink onClick={() => handlePageChange(1)}>1</PaginationLink>
                </PaginationItem>
              )}
              
              {/* Ellipsis if needed */}
              {currentPage > 4 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              
              {/* Pages before current */}
              {currentPage > 2 && (
                <PaginationItem>
                  <PaginationLink onClick={() => handlePageChange(currentPage - 2)}>
                    {currentPage - 2}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationLink onClick={() => handlePageChange(currentPage - 1)}>
                    {currentPage - 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Current page */}
              <PaginationItem>
                <PaginationLink isActive>{currentPage}</PaginationLink>
              </PaginationItem>
              
              {/* Pages after current */}
              {currentPage < data.pagination.totalPages && (
                <PaginationItem>
                  <PaginationLink onClick={() => handlePageChange(currentPage + 1)}>
                    {currentPage + 1}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {currentPage < data.pagination.totalPages - 1 && (
                <PaginationItem>
                  <PaginationLink onClick={() => handlePageChange(currentPage + 2)}>
                    {currentPage + 2}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              {/* Ellipsis if needed */}
              {currentPage < data.pagination.totalPages - 3 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              
              {/* Last page */}
              {currentPage < data.pagination.totalPages - 2 && (
                <PaginationItem>
                  <PaginationLink onClick={() => handlePageChange(data.pagination.totalPages)}>
                    {data.pagination.totalPages}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(Math.min(data.pagination.totalPages, currentPage + 1))}
                  className={currentPage === data.pagination.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </AppShell>
  );
}