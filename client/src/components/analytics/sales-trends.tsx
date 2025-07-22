import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, LineChart, BarChart } from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { useCurrency } from '@/providers/currency-provider';

// Type definitions
interface SalesTrend {
  dateGroup: string;
  totalSales: number;
  transactionCount: number;
  averageTransaction: number;
}

interface StoreBreakdown {
  storeId: number;
  storeName: string;
  totalSales: number;
  transactionCount: number;
  averageTransaction: number;
}

interface PaymentMethodBreakdown {
  paymentMethodId: number;
  paymentMethodName: string;
  total: number;
  count: number;
}

interface SalesTrendsResponse {
  trendData: SalesTrend[];
  storeBreakdown: StoreBreakdown[];
  totals: {
    totalSales: number;
    transactionCount: number;
    averageTransaction: number;
  };
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  dateRangeDescription: string;
}

export const SalesTrends = () => {
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
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [storeId, setStoreId] = useState<string | undefined>();
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Fetch stores for the store filter
  const { data: stores } = useQuery({
    queryKey: ['/api/stores'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch sales trend data
  const { 
    data: salesTrends, 
    isLoading, 
    isError, 
    refetch 
  } = useQuery<SalesTrendsResponse>({
    queryKey: ['/api/analytics/sales-trends', startDate, endDate, groupBy, storeId],
    queryFn: async () => {
      // Build URL with query parameters
      const url = new URL('/api/analytics/sales-trends', window.location.origin);
      
      if (startDate) {
        url.searchParams.append('startDate', startDate.toISOString());
      }
      
      if (endDate) {
        url.searchParams.append('endDate', endDate.toISOString());
      }
      
      url.searchParams.append('groupBy', groupBy);
      
      if (storeId) {
        url.searchParams.append('store', storeId);
      }
      
      return await apiRequest('GET', url.toString());
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { currency } = useCurrency();

  // Display data with the chosen chart type
  const renderChart = () => {
    if (!salesTrends?.trendData || salesTrends.trendData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground">No data available for the selected period</p>
        </div>
      );
    }

    // Format data for displaying in chart
    const chartData = salesTrends.trendData.map(item => ({
      ...item,
      formattedDate: formatDateLabel(item.dateGroup, groupBy)
    }));

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <RechartsLineChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 80,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="formattedDate"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalSales"
              name="Total Sales"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="averageTransaction"
              name="Avg Transaction"
              stroke="#82ca9d"
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <RechartsBarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 80,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="formattedDate"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Bar
              dataKey="totalSales"
              name="Total Sales"
              fill="#8884d8"
            />
            <Bar
              dataKey="transactionCount"
              name="Transaction Count"
              fill="#82ca9d"
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      );
    }
  };

  // Helper function to format date labels based on groupBy
  const formatDateLabel = (dateGroup: string, groupBy: 'day' | 'week' | 'month') => {
    if (groupBy === 'day') {
      // Format: YYYY-MM-DD to MMM DD
      const date = new Date(dateGroup);
      return format(date, 'MMM dd');
    } else if (groupBy === 'week') {
      // Format: YYYY-WW to Week WW, YYYY
      const [year, week] = dateGroup.split('-');
      return `Week ${week}, ${year}`;
    } else if (groupBy === 'month') {
      // Format: YYYY-MM to MMM YYYY
      const [year, month] = dateGroup.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, 'MMM yyyy');
    }
    return dateGroup;
  };

  // Store breakdown card
  const renderStoreBreakdown = () => {
    if (!salesTrends?.storeBreakdown || salesTrends.storeBreakdown.length === 0) {
      return null;
    }

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Store Breakdown</CardTitle>
          <CardDescription>Sales performance by store</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">Store</th>
                  <th className="text-right p-2">Total Sales</th>
                  <th className="text-right p-2">Transactions</th>
                  <th className="text-right p-2">Avg. Transaction</th>
                </tr>
              </thead>
              <tbody>
                {salesTrends.storeBreakdown.map((store) => (
                  <tr key={store.storeId} className="border-t">
                    <td className="p-2">{store.storeName}</td>
                    <td className="text-right p-2">{formatCurrency(store.totalSales)}</td>
                    <td className="text-right p-2">{store.transactionCount}</td>
                    <td className="text-right p-2">{formatCurrency(store.averageTransaction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Payment method breakdown card
  const renderPaymentMethodBreakdown = () => {
    if (!salesTrends?.paymentMethodBreakdown || salesTrends.paymentMethodBreakdown.length === 0) {
      return null;
    }

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Payment Method Breakdown</CardTitle>
          <CardDescription>Sales by payment method</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">Payment Method</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Count</th>
                  <th className="text-right p-2">% of Sales</th>
                </tr>
              </thead>
              <tbody>
                {salesTrends.paymentMethodBreakdown.map((method) => (
                  <tr key={method.paymentMethodId} className="border-t">
                    <td className="p-2">{method.paymentMethodName}</td>
                    <td className="text-right p-2">{formatCurrency(method.total)}</td>
                    <td className="text-right p-2">{method.count}</td>
                    <td className="text-right p-2">
                      {salesTrends.totals.totalSales > 0
                        ? `${((method.total / salesTrends.totals.totalSales) * 100).toFixed(1)}%`
                        : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render totals card
  const renderTotals = () => {
    if (!salesTrends?.totals) {
      return null;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sales</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(salesTrends.totals.totalSales)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transaction Count</CardDescription>
            <CardTitle className="text-2xl">
              {salesTrends.totals.transactionCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Transaction</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(salesTrends.totals.averageTransaction)}
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
          <CardTitle>Sales Trends</CardTitle>
          <CardDescription>
            {salesTrends?.dateRangeDescription || 'Select date range to analyze sales trends'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 mb-6">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range Selector - Start Date */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
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
                      className="w-full justify-start text-left font-normal"
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

              {/* Group By Selector */}
              <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Store Selector */}
              <Select 
                value={storeId} 
                onValueChange={setStoreId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_stores">All Stores</SelectItem>
                  {Array.isArray(stores) && stores.map((store: any) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Chart Type Selector */}
              <div className="flex space-x-2">
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setChartType('line')}
                  title="Line Chart"
                >
                  <LineChart className="h-4 w-4" />
                </Button>
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setChartType('bar')}
                  title="Bar Chart"
                >
                  <BarChart className="h-4 w-4" />
                </Button>
              </div>

              {/* Apply Filters Button */}
              <Button onClick={() => refetch()}>Apply Filters</Button>
            </div>
          </div>

          {/* Totals */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            renderTotals()
          )}

          {/* Sales Chart */}
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-64">
              <p className="text-red-500">Failed to load sales trends. Please try again.</p>
            </div>
          ) : (
            renderChart()
          )}
        </CardContent>
      </Card>

      {/* Store Breakdown */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        !storeId && renderStoreBreakdown()
      )}

      {/* Payment Method Breakdown */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        renderPaymentMethodBreakdown()
      )}
    </div>
  );
};

export default SalesTrends;