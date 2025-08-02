import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, ClipboardCheck, Search, RefreshCw, Ban, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Types for returns
interface ReturnReason {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

interface ReturnItem {
  id: number;
  returnId: number;
  productId: number;
  product: {
    id: number;
    name: string;
    price: string;
    barcode: string;
    isPerishable: boolean;
  };
  quantity: number;
  unitPrice: string;
  refundAmount: string;
  isPerishable: boolean;
  returnReasonId: number | null;
  returnReason?: ReturnReason;
  restocked: boolean;
  notes: string | null;
  createdAt: string;
}

interface ReturnData {
  id: number;
  returnId: string;
  originalTransactionId: number;
  storeId: number;
  processedBy: number;
  customerId: number | null;
  returnDate: string;
  totalRefundAmount: string;
  status: "processing" | "completed" | "cancelled";
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  items: ReturnItem[];
  store?: {
    id: number;
    name: string;
  };
  processor?: {
    id: number;
    fullName: string;
  };
  customer?: {
    id: number;
    fullName: string;
    email: string | null;
    phone: string | null;
  };
}

interface ReturnAnalytics {
  totalReturns: number;
  totalRefundAmount: number;
  perishableReturns: number;
  nonPerishableReturns: number;
  restockedItems: number;
  storeBreakdown: Array<{
    storeName: string;
    returnCount: number;
    refundAmount: number;
  }>;
  reasonBreakdown: Array<{
    reasonName: string;
    count: number;
  }>;
}

// Product selection for return
interface Product {
  id: number;
  name: string;
  barcode: string;
  price: string;
  isPerishable: boolean;
  quantity: number;
}

// Customer interface
interface Customer {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  storeId: number | null;
}

function ReturnProcessForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  // Mock fetch reasons - this will be replaced with real API call
  const { data: reasons, isLoading: isLoadingReasons } = useQuery({
    queryKey: ["/api/returns/reasons"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/returns/reasons");
      const data = await response.json();
      return data as ReturnReason[];
    }
  });

  // Product search query - will be replaced with real inventory API
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/inventory/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];
      
      const response = await apiRequest("GET", `/api/inventory/search?q=${searchQuery}`);
      const data = await response.json();
      return data;
    },
    enabled: searchQuery.length >= 3
  });

  // Customer search query
  const { data: customerResults, isLoading: isSearchingCustomer } = useQuery({
    queryKey: ["/api/customers/lookup", customerSearchQuery],
    queryFn: async () => {
      if (!customerSearchQuery || customerSearchQuery.length < 3) return null;
      
      const response = await apiRequest("GET", `/api/customers/lookup?${
        customerSearchQuery.includes("@") ? `email=${customerSearchQuery}` : `phone=${customerSearchQuery}`
      }`);
      
      if (response.status === 404) {
        return null;
      }
      
      const data = await response.json();
      return data as Customer;
    },
    enabled: customerSearchQuery.length >= 3
  });

  // Watch for customer search results
  useEffect(() => {
    if (customerResults) {
      setCustomer(customerResults);
    }
  }, [customerResults]);

  // Add a product to the return
  const addProduct = (product: any) => {
    // Check if product already exists
    if (selectedProducts.some(p => p.id === product.id)) {
      // Update quantity if it exists
      setSelectedProducts(prev => 
        prev.map(p => p.id === product.id 
          ? { ...p, quantity: p.quantity + 1 } 
          : p
        )
      );
    } else {
      // Add new product with quantity 1
      setSelectedProducts(prev => [...prev, { ...product, quantity: 1 }]);
    }
    setSearchQuery("");
  };

  // Remove a product from the return
  const removeProduct = (productId: number) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  // Update product quantity
  const updateProductQuantity = (productId: number, quantity: number) => {
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
  const handleSubmit = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to return",
        variant: "destructive",
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
          productId: product.id,
          quantity: product.quantity,
          unitPrice: product.price,
          refundAmount: (parseFloat(product.price) * product.quantity).toFixed(2),
          isPerishable: product.isPerishable,
          returnReasonId: reasonId,
          notes: ""
        };
      });
      
      // Create return payload
      const payload = {
        originalTransactionId: selectedTransaction || 0,
        storeId: 1, // Replace with actual store ID from context
        customerId: customer?.id,
        totalRefundAmount: totalRefundAmount.toFixed(2),
        items,
        notes
      };
      
      // Submit to API
      const response = await apiRequest("POST", "/api/returns", payload);
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Return Processed",
          description: `Return #${data.returnId} successfully processed`,
        });
        
        // Reset form
        setSelectedProducts([]);
        setCustomer(null);
        setCustomerSearchQuery("");
        setSelectedTransaction(null);
        setNotes("");
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to process return");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process return",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Process Return</CardTitle>
          <CardDescription>
            Enter customer information and select products to be returned
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Information */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer Information</Label>
            <div className="flex gap-2">
              <Input
                id="customer"
                placeholder="Search by email or phone"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="flex-1"
              />
              {customer && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCustomer(null);
                    setCustomerSearchQuery("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            
            {isSearchingCustomer && (
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            )}
            
            {customer && (
              <div className="p-2 border rounded-md">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{customer.fullName}</p>
                    {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
                    {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Transaction Info (optional) */}
          <div className="space-y-2">
            <Label htmlFor="transaction">Transaction ID (Optional)</Label>
            <Input
              id="transaction"
              placeholder="Original transaction ID"
              type="number"
              value={selectedTransaction || ""}
              onChange={(e) => setSelectedTransaction(e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          
          {/* Product Search */}
          <div className="space-y-2">
            <Label htmlFor="product-search">Search Products</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="product-search"
                  placeholder="Search by name or barcode"
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            {/* Search Results */}
            {isSearching && searchQuery.length >= 3 && (
              <div className="border rounded-md p-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            )}
            
            {searchResults && searchResults.length > 0 && searchQuery.length >= 3 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                <ul className="divide-y">
                  {searchResults.map((product: any) => (
                    <li
                      key={product.id}
                      className="p-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      onClick={() => addProduct(product)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-500">Barcode: {product.barcode}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(parseFloat(product.price))}</p>
                        <Badge variant={product.isPerishable ? "destructive" : "outline"}>
                          {product.isPerishable ? "Perishable" : "Non-Perishable"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {searchQuery.length >= 3 && searchResults && searchResults.length === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No products found</AlertTitle>
                <AlertDescription>
                  No products match your search criteria
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          {/* Selected Products */}
          {selectedProducts.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Products</Label>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.barcode}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.isPerishable ? "destructive" : "outline"}>
                            {product.isPerishable ? "Perishable" : "Non-Perishable"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select defaultValue="">
                            <SelectTrigger className="w-[180px]" id={`reason-trigger-${product.id}`}>
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {!isLoadingReasons && reasons && reasons.map((reason) => (
                                <SelectItem key={reason.id} value={reason.id.toString()}>
                                  {reason.name}
                                </SelectItem>
                              ))}
                              {isLoadingReasons && (
                                <SelectItem value="loading">Loading reasons...</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateProductQuantity(product.id, product.quantity - 1)}
                            >
                              -
                            </Button>
                            <span>{product.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateProductQuantity(product.id, product.quantity + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(parseFloat(product.price) * product.quantity)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProduct(product.id)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">
                        Total Refund
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(totalRefundAmount)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Additional notes about this return"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          
          {/* Submit Button */}
          <Button 
            disabled={selectedProducts.length === 0 || isSubmitting}
            onClick={handleSubmit}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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
  const { data: recentReturns, isLoading } = useQuery({
    queryKey: ["/api/returns/recent"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/returns/recent?limit=20");
      const data = await response.json();
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Returns History</CardTitle>
            <CardDescription>
              View and manage return records
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[260px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={{ 
                    from: dateRange.from, 
                    to: dateRange.to 
                  }}
                  onSelect={(range: { from: Date | undefined; to: Date | undefined } | undefined) => {
                    if (range) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            {/* Status Filter */}
            <Select value={statusFilter || ""} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Apply Filters Button */}
            <Button variant="outline">Apply Filters</Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
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
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Processor</TableHead>
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {recentReturns && recentReturns.length > 0 ? (
                  recentReturns.map((returnItem: ReturnData) => (
                    <TableRow key={returnItem.id}>
                      <TableCell className="font-medium">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="link">{returnItem.returnId}</Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Return Details - {returnItem.returnId}</DialogTitle>
                              <DialogDescription>
                                Processed on {format(new Date(returnItem.returnDate), "PPP p")}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium mb-1">Customer</h4>
                                <p className="text-sm">
                                  {returnItem.customer?.fullName || "No customer information"}
                                </p>
                                {returnItem.customer?.email && (
                                  <p className="text-sm text-muted-foreground">{returnItem.customer.email}</p>
                                )}
                                {returnItem.customer?.phone && (
                                  <p className="text-sm text-muted-foreground">{returnItem.customer.phone}</p>
                                )}
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-medium mb-1">Status</h4>
                                <Badge
                                  variant={
                                    returnItem.status === "completed" ? "default" :
                                    returnItem.status === "processing" ? "outline" : "destructive"
                                  }
                                >
                                  {returnItem.status.charAt(0).toUpperCase() + returnItem.status.slice(1)}
                                </Badge>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-medium mb-1">Store</h4>
                                <p className="text-sm">{returnItem.store?.name || "Unknown"}</p>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-medium mb-1">Processed By</h4>
                                <p className="text-sm">{returnItem.processor?.fullName || "Unknown"}</p>
                              </div>
                              
                              {returnItem.notes && (
                                <div className="col-span-2">
                                  <h4 className="text-sm font-medium mb-1">Notes</h4>
                                  <p className="text-sm">{returnItem.notes}</p>
                                </div>
                              )}
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <h4 className="text-sm font-medium mb-2">Returned Items</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Reason</TableHead>
                                  <TableHead>Quantity</TableHead>
                                  <TableHead>Unit Price</TableHead>
                                  <TableHead className="text-right">Refund Amount</TableHead>
                                </TableRow>
                              </TableHeader>
                              
                              <TableBody>
                                {returnItem.items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.product.name}</TableCell>
                                    <TableCell>
                                      <Badge variant={item.isPerishable ? "destructive" : "outline"}>
                                        {item.isPerishable ? "Perishable" : "Non-Perishable"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {item.returnReason?.name || "Not specified"}
                                    </TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell>{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(parseFloat(item.refundAmount))}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow>
                                  <TableCell colSpan={5} className="text-right font-medium">
                                    Total Refund
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    {formatCurrency(parseFloat(returnItem.totalRefundAmount))}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      
                      <TableCell>{format(new Date(returnItem.returnDate), "PP")}</TableCell>
                      
                      <TableCell>
                        {returnItem.customer ? (
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarFallback>
                                {returnItem.customer.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{returnItem.customer.fullName}</p>
                              <p className="text-xs text-gray-500">
                                {returnItem.customer.email || returnItem.customer.phone || "No contact info"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No customer</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center">
                          <span className="font-medium mr-1">{returnItem.items.length}</span>
                          <span className="text-muted-foreground">
                            {returnItem.items.length === 1 ? "item" : "items"}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge
                          variant={
                            returnItem.status === "completed" ? "default" :
                            returnItem.status === "processing" ? "outline" : "destructive"
                          }
                        >
                          {returnItem.status.charAt(0).toUpperCase() + returnItem.status.slice(1)}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        {formatCurrency(parseFloat(returnItem.totalRefundAmount))}
                      </TableCell>
                      
                      <TableCell>
                        {returnItem.processor?.fullName || "Unknown"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
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
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/returns/analytics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/returns/analytics");
      const data = await response.json();
      return data as ReturnAnalytics;
    }
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Returns Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{analytics?.totalReturns || 0}</div>
            )}
          </CardContent>
        </Card>
        
        {/* Total Refund Amount Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Refund Amount</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(analytics?.totalRefundAmount || 0)}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Perishable vs Non-Perishable Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Perishable Returns</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{analytics?.perishableReturns || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {analytics?.nonPerishableReturns || 0} non-perishable
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Restocked Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restocked Items</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{analytics?.restockedItems || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Breakdown by Store */}
        <Card className="h-[400px]">
          <CardHeader>
            <CardTitle>Returns by Store</CardTitle>
            <CardDescription>
              Number of returns and refund amounts by store
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="w-full">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4 mt-1" />
                  </div>
                ))}
              </div>
            ) : analytics?.storeBreakdown && analytics.storeBreakdown.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Returns</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.storeBreakdown.map((store, index) => (
                      <TableRow key={index}>
                        <TableCell>{store.storeName}</TableCell>
                        <TableCell>{store.returnCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(store.refundAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Breakdown by Reason */}
        <Card className="h-[400px]">
          <CardHeader>
            <CardTitle>Return Reasons</CardTitle>
            <CardDescription>
              Breakdown of returns by reason
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="w-full">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-1" />
                  </div>
                ))}
              </div>
            ) : analytics?.reasonBreakdown && analytics.reasonBreakdown.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.reasonBreakdown.map((reason, index) => (
                      <TableRow key={index}>
                        <TableCell>{reason.reasonName}</TableCell>
                        <TableCell className="text-right">{reason.count}</TableCell>
                        <TableCell className="text-right">
                          {((reason.count / analytics.totalReturns) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <p className="text-sm text-muted-foreground">No data available</p>
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
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Returns and Refunds</h1>
        <Tabs defaultValue="process">
          <TabsList className="mb-6">
            <TabsTrigger value="process">Process Return</TabsTrigger>
            <TabsTrigger value="history">Returns History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="process">
            <ReturnProcessForm />
          </TabsContent>
          
          <TabsContent value="history">
            <ReturnsHistory />
          </TabsContent>
          
          <TabsContent value="analytics">
            <ReturnAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}