import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StorePerformanceResponse, StoreWithMetrics, TopProduct } from '@/types/analytics';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, BarChart2, MapPin } from 'lucide-react';
import {
  BarChart,
  Bar,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/queryClient';

// Generate vibrant colors for charts
const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', 
  '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'
];

export const StoreComparison = () => {
  // State for filters
  const [startDate, setStartDate] = useState<Date | undefined>(
    () => {
      // Default to 30 days ago
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date;
    }
  );
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Fetch store performance data
  const { 
    data: storePerformance, 
    isLoading, 
    isError, 
    refetch 
  } = useQuery<StorePerformanceResponse>({
    queryKey: ['/api/analytics/store-performance', startDate, endDate],
    queryFn: async () => {
      // Build URL with query parameters
      const url = new URL('/api/analytics/store-performance', window.location.origin);
      
      if (startDate) {
        url.searchParams.append('startDate', startDate.toISOString());
      }
      
      if (endDate) {
        url.searchParams.append('endDate', endDate.toISOString());
      }
      
      return await apiRequest('GET', url.toString());
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData: {
      storePerformance: [],
      globalMetrics: { totalRevenue: 0, averageTransaction: 0, transactionCount: 0 },
      dateRangeDescription: 'Compare performance metrics across all store locations',
    },
  });

  // Currency formatter
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Generate formatted data for revenue comparison chart
  const generateRevenueData = () => {
    if (!storePerformance.storePerformance.length) return [];

    return storePerformance.storePerformance.map((store: StoreWithMetrics, index: number) => ({
      name: store.name,
      revenue: store.metrics.totalRevenue,
      color: COLORS[index % COLORS.length]
    }));
  };

  // Generate formatted data for average transaction comparison
  const generateAvgTransactionData = () => {
    if (!storePerformance.storePerformance.length) return [];

    return storePerformance.storePerformance.map((store: StoreWithMetrics, index: number) => ({
      name: store.name,
      value: store.metrics.averageTransaction,
      color: COLORS[index % COLORS.length]
    }));
  };

  // Render the revenue comparison chart
  const renderRevenueChart = () => {
    const data = generateRevenueData();
    
    if (!data.length) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground">No data available for the selected period</p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 80,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => `Store: ${label}`}
          />
          <Legend />
          <Bar 
            dataKey="revenue" 
            name="Revenue" 
            fill="#8884d8"
          >
            {data.map((entry: { color: string }, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Render average transaction chart
  const renderAvgTransactionChart = () => {
    const data = generateAvgTransactionData();
    
    if (!data.length) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground">No data available for the selected period</p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={150}
            fill="#8884d8"
            label={(entry: { name: string; value: number }) => `${entry.name}: ${formatCurrency(entry.value)}`}
          >
            {data.map((entry: { color: string }, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // Render store metrics
  const renderStoreMetrics = () => {
    if (!storePerformance.storePerformance.length) return null;

    return (
      <div className="space-y-6">
        {storePerformance.storePerformance.map((store: StoreWithMetrics) => (
          <Card key={store.id} className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <MapPin className="mr-2 h-4 w-4" />
                    {store.name}
                  </CardTitle>
                  <CardDescription>{store.address}, {store.city}, {store.state}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(store.metrics.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium mb-3">Store Performance</h4>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-muted-foreground">Transactions:</dt>
                      <dd className="text-sm font-medium">{store.metrics.transactionCount}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-muted-foreground">Avg. Transaction:</dt>
                      <dd className="text-sm font-medium">{formatCurrency(store.metrics.averageTransaction)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-muted-foreground">Share of Revenue:</dt>
                      <dd className="text-sm font-medium">
                        {storePerformance.globalMetrics.totalRevenue > 0 
                          ? `${((store.metrics.totalRevenue / storePerformance.globalMetrics.totalRevenue) * 100).toFixed(1)}%` 
                          : '0%'}
                      </dd>
                    </div>
                  </dl>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-3">Top Products</h4>
                  {store.topProducts.length > 0 ? (
                    <ScrollArea className="h-28">
                      <ul className="space-y-1">
                        {store.topProducts.map((product: TopProduct) => (
                          <li key={product.id} className="text-sm">
                            <div className="flex justify-between">
                              <span className="truncate">{product.name}</span>
                              <span className="font-medium">{formatCurrency(product.total)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Qty: {product.quantity}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">No product data available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // Render global metrics
  const renderGlobalMetrics = () => {
    if (!storePerformance.globalMetrics) return null;

    const { globalMetrics } = storePerformance;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(globalMetrics.totalRevenue)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transaction Count</CardDescription>
            <CardTitle className="text-2xl">
              {globalMetrics.transactionCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Transaction</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(globalMetrics.averageTransaction)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Store Performance Comparison</CardTitle>
          <CardDescription>
            {storePerformance.dateRangeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 mb-6">
            <div className="flex space-x-4">
              {/* Date Range Selector - Start Date */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[200px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : 'Start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date Range Selector - End Date */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[200px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : 'End date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      disabled={(date) =>
                        startDate ? date < startDate : false
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Apply Filters Button */}
              <Button onClick={() => refetch()}>
                Apply Filters
              </Button>
            </div>
          </div>

          {/* Global Metrics */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            renderGlobalMetrics()
          )}

          {/* Charts */}
          <Tabs defaultValue="revenue" className="mb-6">
            <TabsList>
              <TabsTrigger value="revenue">Revenue Comparison</TabsTrigger>
              <TabsTrigger value="avgTransaction">Avg. Transaction</TabsTrigger>
            </TabsList>
            
            <TabsContent value="revenue" className="pt-4">
              {isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : isError ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <p className="text-red-500">Failed to load comparison data. Please try again.</p>
                </div>
              ) : (
                renderRevenueChart()
              )}
            </TabsContent>
            
            <TabsContent value="avgTransaction" className="pt-4">
              {isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : isError ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <p className="text-red-500">Failed to load comparison data. Please try again.</p>
                </div>
              ) : (
                renderAvgTransactionChart()
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Store Metrics Cards */}
      <div>
        <h3 className="text-lg font-medium mb-4">Store Details</h3>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-red-500">Failed to load store details. Please try again.</p>
            </CardContent>
          </Card>
        ) : (
          renderStoreMetrics()
        )}
      </div>
    </div>
  );
};

export default StoreComparison;
