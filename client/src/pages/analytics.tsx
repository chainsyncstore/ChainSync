import React, { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { StorePerformance } from '@/components/dashboard/store-performance';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  LineChart, 
  BarChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { CalendarIcon, Download, RefreshCw } from 'lucide-react';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { formatCurrency, formatNumber } from '@/lib/utils';

// Chart colors
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#F56565",
  "#805AD5",
];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [timeRange, setTimeRange] = useState('7');
  const [activeTab, setActiveTab] = useState('sales');
  // For non-admin users, force their assigned store ID
  const isAdmin = user?.role === 'admin';
  const [selectedStore, setSelectedStore] = useState<string>(
    !isAdmin && user?.storeId 
      ? user.storeId.toString() 
      : 'all'
  );

  interface Store {
    id: number;
    name: string;
    address: string;
    isActive: boolean;
  }
  
  interface PerformanceData {
    storeComparison: Array<{
      storeId: number;
      storeName: string;
      totalSales: string;
      transactionCount: number;
    }>;
    dailySales: Array<{
      date: string;
      storeId: number;
      totalSales: string;
      transactionCount: number;
    }>;
  }
  
  // Fetch stores data (for dropdown)
  const { data: storesData = [] } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
    enabled: user?.role === 'admin'
  });

  // Fetch store performance data
  const { data: performanceData, isLoading: isLoadingPerformance } = useQuery<PerformanceData>({
    queryKey: ['/api/dashboard/store-performance', { days: timeRange }]
  });

  interface Transaction {
    id: number;
    transactionId: string;
    total: number;
    createdAt: string;
    status: string;
    isOfflineTransaction: boolean;
    syncedAt?: string;
    items: Array<{
      id: number;
      quantity: number;
      unitPrice: number;
      product: {
        id: number;
        name: string;
        barcode: string;
      };
    }>;
    store: {
      id: number;
      name: string;
    };
    cashier: {
      id: number;
      fullName: string;
    };
  }
  
  // Fetch transactions data with pagination
  // For non-admin users, always use their assigned store
  const transactionStoreId = !isAdmin && user?.storeId 
    ? user.storeId 
    : (selectedStore !== 'all' ? parseInt(selectedStore) : undefined);
    
  const { data: transactionsData = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/dashboard/recent-transactions', { limit: 10, storeId: transactionStoreId }],
  });
  
  // Define interface for low stock items
  interface LowStockItem {
    id: number;
    storeId: number;
    productId: number;
    quantity: number;
    product?: {
      id: number;
      name: string;
      minimumStockLevel: number;
    };
  }

  // Fetch low stock items for the inventory section
  const { data: lowStockItems = [] } = useQuery<LowStockItem[]>({
    queryKey: ['/api/inventory/low-stock', { storeId: transactionStoreId }],
  });

  // Define interfaces for category and payment method data
  interface CategorySalesData {
    name: string;
    value: number;
  }
  
  interface PaymentMethodData {
    name: string;
    value: number;
  }
  
  interface HourlySalesData {
    hour: string;
    sales: number;
  }
  
  // Sales by category - will be fetched from API in future
  const { data: salesByCategoryData = [] } = useQuery<CategorySalesData[]>({
    queryKey: ['/api/analytics/sales-by-category', { storeId: transactionStoreId, days: timeRange }],
    enabled: false // Disabled until API endpoint is available
  });
  
  // Payment methods - will be fetched from API in future
  const { data: paymentMethodsData = [] } = useQuery<PaymentMethodData[]>({
    queryKey: ['/api/analytics/payment-methods', { storeId: transactionStoreId, days: timeRange }],
    enabled: false // Disabled until API endpoint is available
  });
  
  // Hourly sales - will be fetched from API in future
  const { data: hourlySalesData = [] } = useQuery<HourlySalesData[]>({
    queryKey: ['/api/analytics/hourly-sales', { storeId: transactionStoreId, days: timeRange }],
    enabled: false // Disabled until API endpoint is available
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Analytics</h1>
          <p className="text-neutral-500 mt-1">In-depth analysis of your retail performance</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {user?.role === 'admin' && (
            <Select
              value={selectedStore}
              onValueChange={setSelectedStore}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {storesData?.map((store: Store) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Year to date</SelectItem>
            </SelectContent>
          </Select>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
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
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                selected={dateRange}
                onSelect={setDateRange as any}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="sales" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales Analysis</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Analysis</TabsTrigger>
          <TabsTrigger value="customers">Customer Insights</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales" className="space-y-4">
          {/* Store Performance - Visible on both mobile and desktop */}
          <div className="col-span-12">
            <StorePerformance />
          </div>
          
          {/* Sales Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    (performanceData?.storeComparison && performanceData.storeComparison.length > 0)
                      ? performanceData.storeComparison.reduce((sum, store) => sum + parseFloat(store.totalSales), 0)
                      : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-500">Updated in real-time</span>
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(
                    (performanceData?.storeComparison && performanceData.storeComparison.length > 0)
                      ? performanceData.storeComparison.reduce((sum, store) => sum + store.transactionCount, 0)
                      : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-500">Updated in real-time</span>
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    (performanceData?.storeComparison && performanceData.storeComparison.length > 0)
                      ? performanceData.storeComparison.reduce((sum, store) => sum + parseFloat(store.totalSales), 0) /
                        (performanceData.storeComparison.reduce((sum, store) => sum + store.transactionCount, 0) || 1)
                      : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-500">Updated in real-time</span>
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Sales Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Sales Trend</CardTitle>
                <CardDescription>Performance across selected time period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={performanceData?.dailySales}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return format(date, "MMM d");
                        }}
                      />
                      <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                      <Tooltip 
                        formatter={(value) => [`$${Number(value).toLocaleString()}`, "Sales"]}
                        labelFormatter={(label) => format(new Date(label), "MMM d, yyyy")}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="totalSales"
                        stroke={CHART_COLORS[0]}
                        activeDot={{ r: 8 }}
                        name="Sales"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Hourly Sales Distribution</CardTitle>
                <CardDescription>Sales activity throughout the day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[]} // Will be populated from API when hourly sales endpoint is available
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                      <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Sales"]} />
                      <Legend />
                      <Bar dataKey="sales" name="Sales" fill={CHART_COLORS[1]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
                <CardDescription>Product category breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={salesByCategoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => 
                          name && percent ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                      >
                        {/* Cells will be added when real data is available */}
                      </Pie>
                      <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Sales"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Distribution of transaction payment types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => 
                          name && percent ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                      >
                        {/* Cells will be added when real data is available */}
                      </Pie>
                      <Tooltip formatter={(value) => [`${Number(value).toFixed(0)}%`, "Percentage"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Transactions Table */}
          <RecentTransactions limit={10} />
        </TabsContent>
        
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Turnover</CardTitle>
              <CardDescription>Analysis of inventory movement over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[]} // Will be populated from API when inventory turnover endpoint is available
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value} times`, "Turnover Rate"]} />
                    <Bar dataKey="turnover" name="Turnover Rate" fill={CHART_COLORS[2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Items</CardTitle>
                <CardDescription>Products that need replenishment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={lowStockItems?.map((item: LowStockItem) => ({
                        product: item.product?.name || 'Unknown',
                        current: item.quantity,
                        minimum: item.product?.minimumStockLevel || 10
                      })) || []}
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="product" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="current" name="Current Stock" fill={CHART_COLORS[4]} />
                      <Bar dataKey="minimum" name="Minimum Level" fill={CHART_COLORS[0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Expiry Date Analysis</CardTitle>
                <CardDescription>Products approaching expiration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[]} // Will be populated from API when expiry tracking endpoint is available
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timeframe" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" name="Product Count" fill={CHART_COLORS[3]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-muted">Customer data will be available when integrated</span>
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Basket Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-muted">Customer data will be available when integrated</span>
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Repeat Purchase Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-muted">Customer data will be available when integrated</span>
                </p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Purchase Frequency</CardTitle>
              <CardDescription>How often customers make purchases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[]} // Will be populated from API when customer tracking is available
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="percentage"
                      nameKey="frequency"
                      label={({ frequency, percent }) => 
                        frequency && percent ? `${frequency}: ${(percent * 100).toFixed(0)}%` : ''}
                    >
                      {/* Cells will be added when real data is available */}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, "Percentage"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
