import { useState } from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { type SelectStore as Store } from &apos;@shared/schema&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from &apos;@/components/ui/select&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Calendar } from &apos;@/components/ui/calendar&apos;;
import { Popover, PopoverContent, PopoverTrigger } from &apos;@/components/ui/popover&apos;;
import { format } from &apos;date-fns&apos;;
import { CalendarIcon, LineChart, BarChart } from &apos;lucide-react&apos;;
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
} from &apos;recharts&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { formatCurrency } from &apos;@/lib/utils&apos;;
import { useCurrency } from &apos;@/providers/currency-provider&apos;;

interface TrendData {
  _dateGroup: string;
  _totalSales: number;
  _transactionCount: number;
  _averageTransaction: number;
}

interface StoreBreakdown {
  _storeId: number;
  _storeName: string;
  _totalSales: number;
  _transactionCount: number;
  _averageTransaction: number;
}

interface PaymentMethodBreakdown {
  _paymentMethodId: number;
  _paymentMethodName: string;
  _total: number;
  _count: number;
}

interface SalesTrendsResponse {
  _trendData: TrendData[];
  _storeBreakdown: StoreBreakdown[];
  totals: {
    _totalSales: number;
    _transactionCount: number;
    _averageTransaction: number;
  };
  _paymentMethodBreakdown: PaymentMethodBreakdown[];
  _dateRangeDescription: string;
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
  const [groupBy, setGroupBy] = useState<&apos;day&apos; | &apos;week&apos; | &apos;month&apos;>(&apos;day&apos;);
  const [storeId, setStoreId] = useState<string | undefined>();
  const [chartType, setChartType] = useState<&apos;line&apos; | &apos;bar&apos;>(&apos;line&apos;);

  // Fetch stores for the store filter
  const { _data: stores } = useQuery<Store[]>({
    queryKey: [&apos;/api/stores&apos;],
    _queryFn: () => apiRequest(&apos;GET&apos;, &apos;/api/stores&apos;),
    _staleTime: 5 * 60 * 1000, // 5 minutes
    _initialData: []
  });

  // Fetch sales trend data
  const {
    _data: salesTrends,
    isLoading,
    isError,
    refetch
  } = useQuery<SalesTrendsResponse>({
    _queryKey: [&apos;/api/analytics/sales-trends&apos;, startDate, endDate, groupBy, storeId],
    _queryFn: async() => {
      // Build URL with query parameters
      const url = new URL(&apos;/api/analytics/sales-trends&apos;, window.location.origin);

      if (startDate) {
        url.searchParams.append(&apos;startDate&apos;, startDate.toISOString());
      }

      if (endDate) {
        url.searchParams.append(&apos;endDate&apos;, endDate.toISOString());
      }

      url.searchParams.append(&apos;groupBy&apos;, groupBy);

      if (storeId) {
        url.searchParams.append(&apos;store&apos;, storeId);
      }

      return await apiRequest(&apos;GET&apos;, url.toString());
    },
    _staleTime: 5 * 60 * 1000, // 5 minutes
    _initialData: {
      trendData: [],
      _storeBreakdown: [],
      _totals: { _totalSales: 0, _transactionCount: 0, _averageTransaction: 0 },
      _paymentMethodBreakdown: [],
      _dateRangeDescription: &apos;Select date range to analyze sales trends&apos;
    }
  });

  const { currency } = useCurrency();

  // Display data with the chosen chart type
  const renderChart = () => {
    if (!salesTrends.trendData.length) {
      return (
        <div className=&quot;flex flex-col items-center justify-center h-64&quot;>
          <p className=&quot;text-muted-foreground&quot;>No data available for the selected period</p>
        </div>
      );
    }

    // Format data for displaying in chart
    const chartData = salesTrends.trendData.map((_item: TrendData) => ({
      ...item,
      _formattedDate: formatDateLabel(item.dateGroup, groupBy)
    }));

    if (chartType === &apos;line&apos;) {
      return (
        <ResponsiveContainer width=&quot;100%&quot; height={400}>
          <RechartsLineChart
            data={chartData}
            margin={{
              _top: 20,
              _right: 30,
              _left: 20,
              _bottom: 80
            }}
          >
            <CartesianGrid strokeDasharray=&quot;3 3&quot; />
            <XAxis
              dataKey=&quot;formattedDate&quot;
              angle={-45}
              textAnchor=&quot;end&quot;
              height={80}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              formatter={(_value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line
              type=&quot;monotone&quot;
              dataKey=&quot;totalSales&quot;
              name=&quot;Total Sales&quot;
              stroke=&quot;#8884d8&quot;
              activeDot={{ _r: 8 }}
            />
            <Line
              type=&quot;monotone&quot;
              dataKey=&quot;averageTransaction&quot;
              name=&quot;Avg Transaction&quot;
              stroke=&quot;#82ca9d&quot;
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width=&quot;100%&quot; height={400}>
          <RechartsBarChart
            data={chartData}
            margin={{
              _top: 20,
              _right: 30,
              _left: 20,
              _bottom: 80
            }}
          >
            <CartesianGrid strokeDasharray=&quot;3 3&quot; />
            <XAxis
              dataKey=&quot;formattedDate&quot;
              angle={-45}
              textAnchor=&quot;end&quot;
              height={80}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              formatter={(_value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Bar
              dataKey=&quot;totalSales&quot;
              name=&quot;Total Sales&quot;
              fill=&quot;#8884d8&quot;
            />
            <Bar
              dataKey=&quot;transactionCount&quot;
              name=&quot;Transaction Count&quot;
              fill=&quot;#82ca9d&quot;
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      );
    }
  };

  // Helper function to format date labels based on groupBy
  const formatDateLabel = (_dateGroup: string, _groupBy: &apos;day&apos; | &apos;week&apos; | &apos;month&apos;) => {
    if (groupBy === &apos;day&apos;) {
      // _Format: YYYY-MM-DD to MMM DD
      const date = new Date(dateGroup);
      return format(date, &apos;MMM dd&apos;);
    } else if (groupBy === &apos;week&apos;) {
      // _Format: YYYY-WW to Week WW, YYYY
      const [year, week] = dateGroup.split(&apos;-&apos;);
      return `Week ${week}, ${year}`;
    } else if (groupBy === &apos;month&apos;) {
      // _Format: YYYY-MM to MMM YYYY
      const [year, month] = dateGroup.split(&apos;-&apos;);
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, &apos;MMM yyyy&apos;);
    }
    return dateGroup;
  };

  // Store breakdown card
  const renderStoreBreakdown = () => {
    if (!salesTrends.storeBreakdown.length) {
      return null;
    }

    return (
      <Card className=&quot;mt-4&quot;>
        <CardHeader>
          <CardTitle>Store Breakdown</CardTitle>
          <CardDescription>Sales performance by store</CardDescription>
        </CardHeader>
        <CardContent>
          <div className=&quot;overflow-x-auto&quot;>
            <table className=&quot;w-full&quot;>
              <thead>
                <tr>
                  <th className=&quot;text-left p-2&quot;>Store</th>
                  <th className=&quot;text-right p-2&quot;>Total Sales</th>
                  <th className=&quot;text-right p-2&quot;>Transactions</th>
                  <th className=&quot;text-right p-2&quot;>Avg. Transaction</th>
                </tr>
              </thead>
              <tbody>
                {salesTrends.storeBreakdown.map((_store: StoreBreakdown) => (
                  <tr key={store.storeId} className=&quot;border-t&quot;>
                    <td className=&quot;p-2&quot;>{store.storeName}</td>
                    <td className=&quot;text-right p-2&quot;>{formatCurrency(store.totalSales)}</td>
                    <td className=&quot;text-right p-2&quot;>{store.transactionCount}</td>
                    <td className=&quot;text-right p-2&quot;>{formatCurrency(store.averageTransaction)}</td>
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
    if (!salesTrends.paymentMethodBreakdown.length) {
      return null;
    }

    return (
      <Card className=&quot;mt-4&quot;>
        <CardHeader>
          <CardTitle>Payment Method Breakdown</CardTitle>
          <CardDescription>Sales by payment method</CardDescription>
        </CardHeader>
        <CardContent>
          <div className=&quot;overflow-x-auto&quot;>
            <table className=&quot;w-full&quot;>
              <thead>
                <tr>
                  <th className=&quot;text-left p-2&quot;>Payment Method</th>
                  <th className=&quot;text-right p-2&quot;>Total</th>
                  <th className=&quot;text-right p-2&quot;>Count</th>
                  <th className=&quot;text-right p-2&quot;>% of Sales</th>
                </tr>
              </thead>
              <tbody>
                {salesTrends.paymentMethodBreakdown.map((_method: PaymentMethodBreakdown) => (
                  <tr key={method.paymentMethodId} className=&quot;border-t&quot;>
                    <td className=&quot;p-2&quot;>{method.paymentMethodName}</td>
                    <td className=&quot;text-right p-2&quot;>{formatCurrency(method.total)}</td>
                    <td className=&quot;text-right p-2&quot;>{method.count}</td>
                    <td className=&quot;text-right p-2&quot;>
                      {salesTrends.totals.totalSales > 0
                        ? `${((method.total / salesTrends.totals.totalSales) * 100).toFixed(1)}%`
                        : &apos;0%&apos;}
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
    if (!salesTrends.totals) {
      return null;
    }

    return (
      <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4 mb-6&quot;>
        <Card>
          <CardHeader className=&quot;pb-2&quot;>
            <CardDescription>Total Sales</CardDescription>
            <CardTitle className=&quot;text-2xl&quot;>
              {formatCurrency(salesTrends.totals.totalSales)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className=&quot;pb-2&quot;>
            <CardDescription>Transaction Count</CardDescription>
            <CardTitle className=&quot;text-2xl&quot;>
              {salesTrends.totals.transactionCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className=&quot;pb-2&quot;>
            <CardDescription>Average Transaction</CardDescription>
            <CardTitle className=&quot;text-2xl&quot;>
              {formatCurrency(salesTrends.totals.averageTransaction)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  };

  return (
    <div className=&quot;space-y-4&quot;>
      <Card>
        <CardHeader>
          <CardTitle>Sales Trends</CardTitle>
          <CardDescription>
            {salesTrends.dateRangeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className=&quot;flex flex-col space-y-4 _md:flex-row _md:space-y-0 _md:space-x-4 mb-6&quot;>
            <div className=&quot;flex-1 grid grid-cols-1 _md:grid-cols-3 gap-4&quot;>
              {/* Date Range Selector - Start Date */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant=&quot;outline&quot;
                      className=&quot;w-full justify-start text-left font-normal&quot;
                    >
                      <CalendarIcon className=&quot;mr-2 h-4 w-4&quot; />
                      {startDate ? format(startDate, &apos;PPP&apos;) : &apos;Start date&apos;}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className=&quot;w-auto p-0&quot;>
                    <Calendar
                      mode=&quot;single&quot;
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
                      variant=&quot;outline&quot;
                      className=&quot;w-full justify-start text-left font-normal&quot;
                    >
                      <CalendarIcon className=&quot;mr-2 h-4 w-4&quot; />
                      {endDate ? format(endDate, &apos;PPP&apos;) : &apos;End date&apos;}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className=&quot;w-auto p-0&quot;>
                    <Calendar
                      mode=&quot;single&quot;
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      disabled={(_date: Date) =>
                        startDate ? date < _startDate : false
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Group By Selector */}
              <Select value={groupBy} onValueChange={(_value: any) => setGroupBy(value)}>
                <SelectTrigger>
                  <SelectValue placeholder=&quot;Group by&quot; />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value=&quot;day&quot;>Day</SelectItem>
                    <SelectItem value=&quot;week&quot;>Week</SelectItem>
                    <SelectItem value=&quot;month&quot;>Month</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className=&quot;flex-1 grid grid-cols-1 _md:grid-cols-3 gap-4&quot;>
              {/* Store Selector */}
              <Select
                value={storeId}
                onValueChange={setStoreId}
              >
                <SelectTrigger>
                  <SelectValue placeholder=&quot;All Stores&quot; />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=&quot;all_stores&quot;>All Stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Chart Type Selector */}
              <div className=&quot;flex space-x-2&quot;>
                <Button
                  variant={chartType === &apos;line&apos; ? &apos;default&apos; : &apos;outline&apos;}
                  size=&quot;icon&quot;
                  onClick={() => setChartType(&apos;line&apos;)}
                  title=&quot;Line Chart&quot;
                >
                  <LineChart className=&quot;h-4 w-4&quot; />
                </Button>
                <Button
                  variant={chartType === &apos;bar&apos; ? &apos;default&apos; : &apos;outline&apos;}
                  size=&quot;icon&quot;
                  onClick={() => setChartType(&apos;bar&apos;)}
                  title=&quot;Bar Chart&quot;
                >
                  <BarChart className=&quot;h-4 w-4&quot; />
                </Button>
              </div>

              {/* Apply Filters Button */}
              <Button onClick={() => refetch()}>Apply Filters</Button>
            </div>
          </div>

          {/* Totals */}
          {isLoading ? (
            <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4 mb-6&quot;>
              <Skeleton className=&quot;h-24&quot; />
              <Skeleton className=&quot;h-24&quot; />
              <Skeleton className=&quot;h-24&quot; />
            </div>
          ) : (
            renderTotals()
          )}

          {/* Sales Chart */}
          {isLoading ? (
            <Skeleton className=&quot;h-[400px] w-full&quot; />
          ) : isError ? (
            <div className=&quot;flex flex-col items-center justify-center h-64&quot;>
              <p className=&quot;text-red-500&quot;>Failed to load sales trends. Please try again.</p>
            </div>
          ) : (
            renderChart()
          )}
        </CardContent>
      </Card>

      {/* Store Breakdown */}
      {isLoading ? (
        <Skeleton className=&quot;h-64 w-full&quot; />
      ) : (
        !storeId && renderStoreBreakdown()
      )}

      {/* Payment Method Breakdown */}
      {isLoading ? (
        <Skeleton className=&quot;h-64 w-full&quot; />
      ) : (
        renderPaymentMethodBreakdown()
      )}
    </div>
  );
};

export default SalesTrends;
