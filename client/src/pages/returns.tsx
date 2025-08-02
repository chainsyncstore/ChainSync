import { useState, useEffect } from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import { formatCurrency } from &apos;@/lib/utils&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from &apos;@/components/ui/table&apos;;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from &apos;@/components/ui/select&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Label } from &apos;@/components/ui/label&apos;;
import { Alert, AlertDescription, AlertTitle } from &apos;@/components/ui/alert&apos;;
import { Avatar, AvatarFallback } from &apos;@/components/ui/avatar&apos;;
import { Badge } from &apos;@/components/ui/badge&apos;;
import { ScrollArea } from &apos;@/components/ui/scroll-area&apos;;
import { Separator } from &apos;@/components/ui/separator&apos;;
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from &apos;@/components/ui/dialog&apos;;
import { Calendar } from &apos;@/components/ui/calendar&apos;;
import { format } from &apos;date-fns&apos;;
import { CalendarIcon, ClipboardCheck, Search, RefreshCw, Ban, AlertCircle } from &apos;lucide-react&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;

import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from &apos;@/components/ui/popover&apos;;

// Types for returns
interface ReturnReason {
  _id: number;
  _name: string;
  _description: string | null;
  _active: boolean;
  _createdAt: string;
}

interface ReturnItem {
  _id: number;
  _returnId: number;
  _productId: number;
  product: {
    _id: number;
    _name: string;
    _price: string;
    _barcode: string;
    _isPerishable: boolean;
  };
  _quantity: number;
  _unitPrice: string;
  _refundAmount: string;
  _isPerishable: boolean;
  _returnReasonId: number | null;
  returnReason?: ReturnReason;
  _restocked: boolean;
  _notes: string | null;
  _createdAt: string;
}

interface ReturnData {
  _id: number;
  _returnId: string;
  _originalTransactionId: number;
  _storeId: number;
  _processedBy: number;
  _customerId: number | null;
  _returnDate: string;
  _totalRefundAmount: string;
  status: &apos;processing&apos; | &apos;completed&apos; | &apos;cancelled&apos;;
  _notes: string | null;
  _createdAt: string;
  _updatedAt: string | null;
  _items: ReturnItem[];
  store?: {
    _id: number;
    _name: string;
  };
  processor?: {
    _id: number;
    _fullName: string;
  };
  customer?: {
    _id: number;
    _fullName: string;
    _email: string | null;
    _phone: string | null;
  };
}

interface ReturnAnalytics {
  _totalReturns: number;
  _totalRefundAmount: number;
  _perishableReturns: number;
  _nonPerishableReturns: number;
  _restockedItems: number;
  _storeBreakdown: Array<{
    _storeName: string;
    _returnCount: number;
    _refundAmount: number;
  }>;
  _reasonBreakdown: Array<{
    _reasonName: string;
    _count: number;
  }>;
}

// Product selection for return
interface Product {
  _id: number;
  _name: string;
  _barcode: string;
  _price: string;
  _isPerishable: boolean;
  _quantity: number;
}

// Customer interface
interface Customer {
  _id: number;
  _fullName: string;
  _email: string | null;
  _phone: string | null;
  _storeId: number | null;
}

function ReturnProcessForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState(&apos;&apos;);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState(&apos;&apos;);
  const [selectedTransaction, setSelectedTransaction] = useState<number | null>(null);
  const [notes, setNotes] = useState(&apos;&apos;);

  // Mock fetch reasons - this will be replaced with real API call
  const { _data: reasons, _isLoading: isLoadingReasons } = useQuery({
    queryKey: [&apos;/api/returns/reasons&apos;],
    _queryFn: async() => {
      const response = await apiRequest(&apos;GET&apos;, &apos;/api/returns/reasons&apos;);
      const data = await response.json();
      return data as ReturnReason[];
    }
  });

  // Product search query - will be replaced with real inventory API
  const { _data: searchResults, _isLoading: isSearching } = useQuery({
    queryKey: [&apos;/api/inventory/search&apos;, searchQuery],
    _queryFn: async() => {
      if (!searchQuery || searchQuery.length < 3) return [];

      const response = await apiRequest(&apos;GET&apos;, `/api/inventory/search?q=${searchQuery}`);
      const data = await response.json();
      return data;
    },
    _enabled: searchQuery.length >= 3
  });

  // Customer search query
  const { _data: customerResults, _isLoading: isSearchingCustomer } = useQuery({
    queryKey: [&apos;/api/customers/lookup&apos;, customerSearchQuery],
    _queryFn: async() => {
      if (!customerSearchQuery || customerSearchQuery.length < 3) return null;

      const response = await apiRequest(&apos;GET&apos;, `/api/customers/lookup?${
        customerSearchQuery.includes(&apos;@&apos;) ? `email=${customerSearchQuery}` : `phone=${customerSearchQuery}`
      }`);

      if (response.status === 404) {
        return null;
      }

      const data = await response.json();
      return data as Customer;
    },
    _enabled: customerSearchQuery.length >= 3
  });

  // Watch for customer search results
  useEffect(() => {
    if (customerResults) {
      setCustomer(customerResults);
    }
  }, [customerResults]);

  // Add a product to the return
  const addProduct = (_product: any) => {
    // Check if product already exists
    if (selectedProducts.some(p => p.id === product.id)) {
      // Update quantity if it exists
      setSelectedProducts(prev =>
        prev.map(p => p.id === product.id
          ? { ...p, _quantity: p.quantity + 1 }
          : p
        )
      );
    } else {
      // Add new product with quantity 1
      setSelectedProducts(prev => [...prev, { ...product, _quantity: 1 }]);
    }
    setSearchQuery(&apos;&apos;);
  };

  // Remove a product from the return
  const removeProduct = (_productId: number) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  // Update product quantity
  const updateProductQuantity = (_productId: number, _quantity: number) => {
    if (quantity <= 0) {
      removeProduct(productId);
      return;
    }

    setSelectedProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, quantity } : p)
    );
  };

  // Calculate total refund amount
  const totalRefundAmount = selectedProducts.reduce(
    (total, product) => total + (parseFloat(product.price) * product.quantity),
    0
  );

  // Submit the return
  const handleSubmit = async() => {
    if (selectedProducts.length === 0) {
      toast({
        _title: &apos;Error&apos;,
        _description: &apos;Please select at least one product to return&apos;,
        _variant: &apos;destructive&apos;
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare return items with reasons
      const items = selectedProducts.map(product => {
        const itemElement = document.getElementById(`reason-${product.id}`) as HTMLSelectElement;
        const reasonId = itemElement ? parseInt(itemElement.value) : null;

        return {
          _productId: product.id,
          _quantity: product.quantity,
          _unitPrice: product.price,
          _refundAmount: (parseFloat(product.price) * product.quantity).toFixed(2),
          _isPerishable: product.isPerishable,
          _returnReasonId: reasonId,
          _notes: &apos;&apos;
        };
      });

      // Create return payload
      const payload = {
        _originalTransactionId: selectedTransaction || 0,
        _storeId: 1, // Replace with actual store ID from context
        _customerId: customer?.id,
        _totalRefundAmount: totalRefundAmount.toFixed(2),
        items,
        notes
      };

      // Submit to API
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/returns&apos;, payload);

      if (response.ok) {
        const data = await response.json();
        toast({
          _title: &apos;Return Processed&apos;,
          _description: `Return #${data.returnId} successfully processed`
        });

        // Reset form
        setSelectedProducts([]);
        setCustomer(null);
        setCustomerSearchQuery(&apos;&apos;);
        setSelectedTransaction(null);
        setNotes(&apos;&apos;);
      } else {
        const error = await response.json();
        throw new Error(error.error || &apos;Failed to process return&apos;);
      }
    } catch (_error: any) {
      toast({
        _title: &apos;Error&apos;,
        _description: error.message || &apos;Failed to process return&apos;,
        _variant: &apos;destructive&apos;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className=&quot;space-y-6&quot;>
      <Card>
        <CardHeader>
          <CardTitle>Process Return</CardTitle>
          <CardDescription>
            Enter customer information and select products to be returned
          </CardDescription>
        </CardHeader>
        <CardContent className=&quot;space-y-4&quot;>
          {/* Customer Information */}
          <div className=&quot;space-y-2&quot;>
            <Label htmlFor=&quot;customer&quot;>Customer Information</Label>
            <div className=&quot;flex gap-2&quot;>
              <Input
                id=&quot;customer&quot;
                placeholder=&quot;Search by email or phone&quot;
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className=&quot;flex-1&quot;
              />
              {customer && (
                <Button
                  variant=&quot;outline&quot;
                  onClick={() => {
                    setCustomer(null);
                    setCustomerSearchQuery(&apos;&apos;);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>

            {isSearchingCustomer && (
              <div className=&quot;flex items-center space-x-2&quot;>
                <Skeleton className=&quot;h-4 w-4 rounded-full&quot; />
                <Skeleton className=&quot;h-4 w-24&quot; />
              </div>
            )}

            {customer && (
              <div className=&quot;p-2 border rounded-md&quot;>
                <div className=&quot;flex justify-between&quot;>
                  <div>
                    <p className=&quot;font-medium&quot;>{customer.fullName}</p>
                    {customer.email && <p className=&quot;text-sm text-gray-500&quot;>{customer.email}</p>}
                    {customer.phone && <p className=&quot;text-sm text-gray-500&quot;>{customer.phone}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transaction Info (optional) */}
          <div className=&quot;space-y-2&quot;>
            <Label htmlFor=&quot;transaction&quot;>Transaction ID (Optional)</Label>
            <Input
              id=&quot;transaction&quot;
              placeholder=&quot;Original transaction ID&quot;
              type=&quot;number&quot;
              value={selectedTransaction || &apos;&apos;}
              onChange={(e) => setSelectedTransaction(e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>

          {/* Product Search */}
          <div className=&quot;space-y-2&quot;>
            <Label htmlFor=&quot;product-search&quot;>Search Products</Label>
            <div className=&quot;flex gap-2&quot;>
              <div className=&quot;relative flex-1&quot;>
                <Search className=&quot;absolute left-2 top-2.5 h-4 w-4 text-muted-foreground&quot; />
                <Input
                  id=&quot;product-search&quot;
                  placeholder=&quot;Search by name or barcode&quot;
                  className=&quot;pl-8&quot;
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Search Results */}
            {isSearching && searchQuery.length >= 3 && (
              <div className=&quot;border rounded-md p-2&quot;>
                <div className=&quot;flex items-center space-x-2&quot;>
                  <Skeleton className=&quot;h-4 w-4 rounded-full&quot; />
                  <Skeleton className=&quot;h-4 w-24&quot; />
                </div>
                <div className=&quot;flex items-center space-x-2 mt-2&quot;>
                  <Skeleton className=&quot;h-4 w-4 rounded-full&quot; />
                  <Skeleton className=&quot;h-4 w-24&quot; />
                </div>
              </div>
            )}

            {searchResults && searchResults.length > 0 && searchQuery.length >= 3 && (
              <div className=&quot;border rounded-md max-h-40 overflow-y-auto&quot;>
                <ul className=&quot;divide-y&quot;>
                  {searchResults.map((_product: any) => (
                    <li
                      key={product.id}
                      className=&quot;p-2 _hover:bg-gray-50 cursor-pointer flex justify-between items-center&quot;
                      onClick={() => addProduct(product)}
                    >
                      <div>
                        <p className=&quot;font-medium&quot;>{product.name}</p>
                        <p className=&quot;text-sm text-gray-500&quot;>Barcode: {product.barcode}</p>
                      </div>
                      <div className=&quot;text-right&quot;>
                        <p className=&quot;font-medium&quot;>{formatCurrency(parseFloat(product.price))}</p>
                        <Badge variant={product.isPerishable ? &apos;destructive&apos; : &apos;outline&apos;}>
                          {product.isPerishable ? &apos;Perishable&apos; : &apos;Non-Perishable&apos;}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {searchQuery.length >= 3 && searchResults && searchResults.length === 0 && (
              <Alert variant=&quot;destructive&quot;>
                <AlertCircle className=&quot;h-4 w-4&quot; />
                <AlertTitle>No products found</AlertTitle>
                <AlertDescription>
                  No products match your search criteria
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Selected Products */}
          {selectedProducts.length > 0 && (
            <div className=&quot;space-y-2&quot;>
              <Label>Selected Products</Label>
              <div className=&quot;border rounded-md&quot;>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className=&quot;text-right&quot;>Amount</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className=&quot;font-medium&quot;>{product.name}</p>
                            <p className=&quot;text-xs text-gray-500&quot;>{product.barcode}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.isPerishable ? &apos;destructive&apos; : &apos;outline&apos;}>
                            {product.isPerishable ? &apos;Perishable&apos; : &apos;Non-Perishable&apos;}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select defaultValue=&quot;&quot;>
                            <SelectTrigger className=&quot;w-[180px]&quot; id={`reason-trigger-${product.id}`}>
                              <SelectValue placeholder=&quot;Select reason&quot; />
                            </SelectTrigger>
                            <SelectContent>
                              {!isLoadingReasons && reasons && reasons.map((reason) => (
                                <SelectItem key={reason.id} value={reason.id.toString()}>
                                  {reason.name}
                                </SelectItem>
                              ))}
                              {isLoadingReasons && (
                                <SelectItem value=&quot;loading&quot;>Loading reasons...</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className=&quot;flex items-center space-x-2&quot;>
                            <Button
                              variant=&quot;outline&quot;
                              size=&quot;icon&quot;
                              className=&quot;h-8 w-8&quot;
                              onClick={() => updateProductQuantity(product.id, product.quantity - 1)}
                            >
                              -
                            </Button>
                            <span>{product.quantity}</span>
                            <Button
                              variant=&quot;outline&quot;
                              size=&quot;icon&quot;
                              className=&quot;h-8 w-8&quot;
                              onClick={() => updateProductQuantity(product.id, product.quantity + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className=&quot;text-right&quot;>
                          {formatCurrency(parseFloat(product.price) * product.quantity)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant=&quot;ghost&quot;
                            size=&quot;icon&quot;
                            onClick={() => removeProduct(product.id)}
                          >
                            <Ban className=&quot;h-4 w-4&quot; />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className=&quot;text-right font-medium&quot;>
                        Total Refund
                      </TableCell>
                      <TableCell className=&quot;text-right font-bold&quot;>
                        {formatCurrency(totalRefundAmount)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className=&quot;space-y-2&quot;>
            <Label htmlFor=&quot;notes&quot;>Notes</Label>
            <Input
              id=&quot;notes&quot;
              placeholder=&quot;Additional notes about this return&quot;
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <Button
            disabled={selectedProducts.length === 0 || isSubmitting}
            onClick={handleSubmit}
            className=&quot;w-full&quot;
          >
            {isSubmitting ? (
              <>
                <RefreshCw className=&quot;mr-2 h-4 w-4 animate-spin&quot; />
                Processing...
              </>
            ) : (
              <>Process Return</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ReturnsHistory() {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  // const [storeFilter, setStoreFilter] = useState<string | null>(null); // Unused
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Fetch recent returns
  const { _data: recentReturns, isLoading } = useQuery({
    _queryKey: [&apos;/api/returns/recent&apos;],
    _queryFn: async() => {
      const response = await apiRequest(&apos;GET&apos;, &apos;/api/returns/recent?limit=20&apos;);
      const data = await response.json();
      return data;
    }
  });

  return (
    <div className=&quot;space-y-6&quot;>
      <Card>
        <CardHeader className=&quot;flex flex-row items-center justify-between&quot;>
          <div>
            <CardTitle>Returns History</CardTitle>
            <CardDescription>
              View and manage return records
            </CardDescription>
          </div>

          <div className=&quot;flex items-center space-x-2&quot;>
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant=&quot;outline&quot; className=&quot;w-[260px] justify-start text-left font-normal&quot;>
                  <CalendarIcon className=&quot;mr-2 h-4 w-4&quot; />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, &apos;LLL dd, y&apos;)} - {format(dateRange.to, &apos;LLL dd, y&apos;)}
                      </>
                    ) : (
                      format(dateRange.from, &apos;LLL dd, y&apos;)
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className=&quot;w-auto p-0&quot;>
                <Calendar
                  mode=&quot;range&quot;
                  selected={{
                    _from: dateRange.from,
                    _to: dateRange.to
                  }}
                  onSelect={(range: { _from: Date | undefined; _to: Date | undefined } | undefined) => {
                    if (range) {
                      setDateRange({ _from: range.from, _to: range.to });
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Status Filter */}
            <Select value={statusFilter || &apos;&apos;} onValueChange={setStatusFilter}>
              <SelectTrigger className=&quot;w-[160px]&quot;>
                <SelectValue placeholder=&quot;All Statuses&quot; />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=&quot;&quot;>All Statuses</SelectItem>
                <SelectItem value=&quot;completed&quot;>Completed</SelectItem>
                <SelectItem value=&quot;processing&quot;>Processing</SelectItem>
                <SelectItem value=&quot;cancelled&quot;>Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Apply Filters Button */}
            <Button variant=&quot;outline&quot;>Apply Filters</Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className=&quot;space-y-2&quot;>
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className=&quot;flex items-center space-x-4&quot;>
                  <Skeleton className=&quot;h-12 w-12 rounded-full&quot; />
                  <div className=&quot;space-y-2&quot;>
                    <Skeleton className=&quot;h-4 w-[250px]&quot; />
                    <Skeleton className=&quot;h-4 w-[200px]&quot; />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className=&quot;text-right&quot;>Amount</TableHead>
                  <TableHead>Processor</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {recentReturns && recentReturns.length > 0 ? (
                  recentReturns.map((_returnItem: ReturnData) => (
                    <TableRow key={returnItem.id}>
                      <TableCell className=&quot;font-medium&quot;>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant=&quot;link&quot;>{returnItem.returnId}</Button>
                          </DialogTrigger>
                          <DialogContent className=&quot;max-w-3xl&quot;>
                            <DialogHeader>
                              <DialogTitle>Return Details - {returnItem.returnId}</DialogTitle>
                              <DialogDescription>
                                Processed on {format(new Date(returnItem.returnDate), &apos;PPP p&apos;)}
                              </DialogDescription>
                            </DialogHeader>

                            <div className=&quot;grid grid-cols-2 gap-4&quot;>
                              <div>
                                <h4 className=&quot;text-sm font-medium mb-1&quot;>Customer</h4>
                                <p className=&quot;text-sm&quot;>
                                  {returnItem.customer?.fullName || &apos;No customer information&apos;}
                                </p>
                                {returnItem.customer?.email && (
                                  <p className=&quot;text-sm text-muted-foreground&quot;>{returnItem.customer.email}</p>
                                )}
                                {returnItem.customer?.phone && (
                                  <p className=&quot;text-sm text-muted-foreground&quot;>{returnItem.customer.phone}</p>
                                )}
                              </div>

                              <div>
                                <h4 className=&quot;text-sm font-medium mb-1&quot;>Status</h4>
                                <Badge
                                  variant={
                                    returnItem.status === &apos;completed&apos; ? &apos;default&apos; :
                                    returnItem.status === &apos;processing&apos; ? &apos;outline&apos; : &apos;destructive&apos;
                                  }
                                >
                                  {returnItem.status.charAt(0).toUpperCase() + returnItem.status.slice(1)}
                                </Badge>
                              </div>

                              <div>
                                <h4 className=&quot;text-sm font-medium mb-1&quot;>Store</h4>
                                <p className=&quot;text-sm&quot;>{returnItem.store?.name || &apos;Unknown&apos;}</p>
                              </div>

                              <div>
                                <h4 className=&quot;text-sm font-medium mb-1&quot;>Processed By</h4>
                                <p className=&quot;text-sm&quot;>{returnItem.processor?.fullName || &apos;Unknown&apos;}</p>
                              </div>

                              {returnItem.notes && (
                                <div className=&quot;col-span-2&quot;>
                                  <h4 className=&quot;text-sm font-medium mb-1&quot;>Notes</h4>
                                  <p className=&quot;text-sm&quot;>{returnItem.notes}</p>
                                </div>
                              )}
                            </div>

                            <Separator className=&quot;my-4&quot; />

                            <h4 className=&quot;text-sm font-medium mb-2&quot;>Returned Items</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Reason</TableHead>
                                  <TableHead>Quantity</TableHead>
                                  <TableHead>Unit Price</TableHead>
                                  <TableHead className=&quot;text-right&quot;>Refund Amount</TableHead>
                                </TableRow>
                              </TableHeader>

                              <TableBody>
                                {returnItem.items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.product.name}</TableCell>
                                    <TableCell>
                                      <Badge variant={item.isPerishable ? &apos;destructive&apos; : &apos;outline&apos;}>
                                        {item.isPerishable ? &apos;Perishable&apos; : &apos;Non-Perishable&apos;}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {item.returnReason?.name || &apos;Not specified&apos;}
                                    </TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell>{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                                    <TableCell className=&quot;text-right&quot;>
                                      {formatCurrency(parseFloat(item.refundAmount))}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow>
                                  <TableCell colSpan={5} className=&quot;text-right font-medium&quot;>
                                    Total Refund
                                  </TableCell>
                                  <TableCell className=&quot;text-right font-bold&quot;>
                                    {formatCurrency(parseFloat(returnItem.totalRefundAmount))}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </DialogContent>
                        </Dialog>
                      </TableCell>

                      <TableCell>{format(new Date(returnItem.returnDate), &apos;PP&apos;)}</TableCell>

                      <TableCell>
                        {returnItem.customer ? (
                          <div className=&quot;flex items-center&quot;>
                            <Avatar className=&quot;h-8 w-8 mr-2&quot;>
                              <AvatarFallback>
                                {returnItem.customer.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className=&quot;text-sm font-medium&quot;>{returnItem.customer.fullName}</p>
                              <p className=&quot;text-xs text-gray-500&quot;>
                                {returnItem.customer.email || returnItem.customer.phone || &apos;No contact info&apos;}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className=&quot;text-muted-foreground&quot;>No customer</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className=&quot;flex items-center&quot;>
                          <span className=&quot;font-medium mr-1&quot;>{returnItem.items.length}</span>
                          <span className=&quot;text-muted-foreground&quot;>
                            {returnItem.items.length === 1 ? &apos;item&apos; : &apos;items&apos;}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            returnItem.status === &apos;completed&apos; ? &apos;default&apos; :
                            returnItem.status === &apos;processing&apos; ? &apos;outline&apos; : &apos;destructive&apos;
                          }
                        >
                          {returnItem.status.charAt(0).toUpperCase() + returnItem.status.slice(1)}
                        </Badge>
                      </TableCell>

                      <TableCell className=&quot;text-right&quot;>
                        {formatCurrency(parseFloat(returnItem.totalRefundAmount))}
                      </TableCell>

                      <TableCell>
                        {returnItem.processor?.fullName || &apos;Unknown&apos;}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className=&quot;text-center&quot;>
                      No returns found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReturnAnalytics() {
  // Fetch analytics data
  const { _data: analytics, isLoading } = useQuery({
    _queryKey: [&apos;/api/returns/analytics&apos;],
    _queryFn: async() => {
      const response = await apiRequest(&apos;GET&apos;, &apos;/api/returns/analytics&apos;);
      const data = await response.json();
      return data as ReturnAnalytics;
    }
  });

  return (
    <div className=&quot;space-y-6&quot;>
      <div className=&quot;grid grid-cols-1 _md:grid-cols-2 _lg:grid-cols-4 gap-4&quot;>
        {/* Total Returns Card */}
        <Card>
          <CardHeader className=&quot;flex flex-row items-center justify-between space-y-0 pb-2&quot;>
            <CardTitle className=&quot;text-sm font-medium&quot;>Total Returns</CardTitle>
            <ClipboardCheck className=&quot;h-4 w-4 text-muted-foreground&quot; />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className=&quot;h-7 w-20&quot; />
            ) : (
              <div className=&quot;text-2xl font-bold&quot;>{analytics?.totalReturns || 0}</div>
            )}
          </CardContent>
        </Card>

        {/* Total Refund Amount Card */}
        <Card>
          <CardHeader className=&quot;flex flex-row items-center justify-between space-y-0 pb-2&quot;>
            <CardTitle className=&quot;text-sm font-medium&quot;>Total Refund Amount</CardTitle>
            <svg
              xmlns=&quot;http://www.w3.org/2000/svg&quot;
              viewBox=&quot;0 0 24 24&quot;
              fill=&quot;none&quot;
              stroke=&quot;currentColor&quot;
              strokeLinecap=&quot;round&quot;
              strokeLinejoin=&quot;round&quot;
              strokeWidth=&quot;2&quot;
              className=&quot;h-4 w-4 text-muted-foreground&quot;
            >
              <path d=&quot;M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6&quot; />
            </svg>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className=&quot;h-7 w-20&quot; />
            ) : (
              <div className=&quot;text-2xl font-bold&quot;>
                {formatCurrency(analytics?.totalRefundAmount || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Perishable vs Non-Perishable Card */}
        <Card>
          <CardHeader className=&quot;flex flex-row items-center justify-between space-y-0 pb-2&quot;>
            <CardTitle className=&quot;text-sm font-medium&quot;>Perishable Returns</CardTitle>
            <AlertCircle className=&quot;h-4 w-4 text-muted-foreground&quot; />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className=&quot;h-7 w-20&quot; />
            ) : (
              <>
                <div className=&quot;text-2xl font-bold&quot;>{analytics?.perishableReturns || 0}</div>
                <p className=&quot;text-xs text-muted-foreground mt-1&quot;>
                  vs {analytics?.nonPerishableReturns || 0} non-perishable
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Restocked Items Card */}
        <Card>
          <CardHeader className=&quot;flex flex-row items-center justify-between space-y-0 pb-2&quot;>
            <CardTitle className=&quot;text-sm font-medium&quot;>Restocked Items</CardTitle>
            <RefreshCw className=&quot;h-4 w-4 text-muted-foreground&quot; />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className=&quot;h-7 w-20&quot; />
            ) : (
              <div className=&quot;text-2xl font-bold&quot;>{analytics?.restockedItems || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-6&quot;>
        {/* Breakdown by Store */}
        <Card className=&quot;h-[400px]&quot;>
          <CardHeader>
            <CardTitle>Returns by Store</CardTitle>
            <CardDescription>
              Number of returns and refund amounts by store
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className=&quot;space-y-2&quot;>
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className=&quot;w-full&quot;>
                    <Skeleton className=&quot;h-4 w-full&quot; />
                    <Skeleton className=&quot;h-4 w-3/4 mt-1&quot; />
                  </div>
                ))}
              </div>
            ) : analytics?.storeBreakdown && analytics.storeBreakdown.length > 0 ? (
              <ScrollArea className=&quot;h-[300px]&quot;>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Returns</TableHead>
                      <TableHead className=&quot;text-right&quot;>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.storeBreakdown.map((store, index) => (
                      <TableRow key={index}>
                        <TableCell>{store.storeName}</TableCell>
                        <TableCell>{store.returnCount}</TableCell>
                        <TableCell className=&quot;text-right&quot;>{formatCurrency(store.refundAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className=&quot;flex h-[300px] items-center justify-center&quot;>
                <p className=&quot;text-sm text-muted-foreground&quot;>No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Breakdown by Reason */}
        <Card className=&quot;h-[400px]&quot;>
          <CardHeader>
            <CardTitle>Return Reasons</CardTitle>
            <CardDescription>
              Breakdown of returns by reason
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className=&quot;space-y-2&quot;>
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className=&quot;w-full&quot;>
                    <Skeleton className=&quot;h-4 w-full&quot; />
                    <Skeleton className=&quot;h-4 w-2/3 mt-1&quot; />
                  </div>
                ))}
              </div>
            ) : analytics?.reasonBreakdown && analytics.reasonBreakdown.length > 0 ? (
              <ScrollArea className=&quot;h-[300px]&quot;>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reason</TableHead>
                      <TableHead className=&quot;text-right&quot;>Count</TableHead>
                      <TableHead className=&quot;text-right&quot;>Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.reasonBreakdown.map((reason, index) => (
                      <TableRow key={index}>
                        <TableCell>{reason.reasonName}</TableCell>
                        <TableCell className=&quot;text-right&quot;>{reason.count}</TableCell>
                        <TableCell className=&quot;text-right&quot;>
                          {((reason.count / analytics.totalReturns) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className=&quot;flex h-[300px] items-center justify-center&quot;>
                <p className=&quot;text-sm text-muted-foreground&quot;>No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <AppShell>
      <div className=&quot;container mx-auto py-6&quot;>
        <h1 className=&quot;text-3xl font-bold mb-6&quot;>Returns and Refunds</h1>
        <Tabs defaultValue=&quot;process&quot;>
          <TabsList className=&quot;mb-6&quot;>
            <TabsTrigger value=&quot;process&quot;>Process Return</TabsTrigger>
            <TabsTrigger value=&quot;history&quot;>Returns History</TabsTrigger>
            <TabsTrigger value=&quot;analytics&quot;>Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value=&quot;process&quot;>
            <ReturnProcessForm />
          </TabsContent>

          <TabsContent value=&quot;history&quot;>
            <ReturnsHistory />
          </TabsContent>

          <TabsContent value=&quot;analytics&quot;>
            <ReturnAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
