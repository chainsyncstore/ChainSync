import { useState } from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { StorePerformanceResponse, StoreWithMetrics, TopProduct } from &apos;@/types/analytics&apos;;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from &apos;@/components/ui/card&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Calendar } from &apos;@/components/ui/calendar&apos;;
import { Popover, PopoverContent, PopoverTrigger } from &apos;@/components/ui/popover&apos;;
import { format } from &apos;date-fns&apos;;
import { CalendarIcon, BarChart2, MapPin } from &apos;lucide-react&apos;;
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
} from &apos;recharts&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { ScrollArea } from &apos;@/components/ui/scroll-area&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;

// Generate vibrant colors for charts
const COLORS = [
  &apos;#8884d8&apos;, &apos;#82ca9d&apos;, &apos;#ffc658&apos;, &apos;#ff8042&apos;, &apos;#0088FE&apos;,
  &apos;#00C49F&apos;, &apos;#FFBB28&apos;, &apos;#FF8042&apos;, &apos;#8884d8&apos;, &apos;#82ca9d&apos;
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
    _data: storePerformance,
    isLoading,
    isError,
    refetch
  } = useQuery<StorePerformanceResponse>({
    _queryKey: [&apos;/api/analytics/store-performance&apos;, startDate, endDate],
    _queryFn: async() => {
      // Build URL with query parameters
      const url = new URL(&apos;/api/analytics/store-performance&apos;, window.location.origin);

      if (startDate) {
        url.searchParams.append(&apos;startDate&apos;, startDate.toISOString());
      }

      if (endDate) {
        url.searchParams.append(&apos;endDate&apos;, endDate.toISOString());
      }

      return await apiRequest(&apos;GET&apos;, url.toString());
    },
    _staleTime: 5 * 60 * 1000, // 5 minutes
    _initialData: {
      storePerformance: [],
      _globalMetrics: { _totalRevenue: 0, _averageTransaction: 0, _transactionCount: 0 },
      _dateRangeDescription: &apos;Compare performance metrics across all store locations&apos;
    }
  });

  // Currency formatter
  const formatCurrency = (_value: number) => {
    return new Intl.NumberFormat(&apos;en-US&apos;, {
      _style: &apos;currency&apos;,
      _currency: &apos;USD&apos;
    }).format(value);
  };

  // Generate formatted data for revenue comparison chart
  const generateRevenueData = () => {
    if (!storePerformance.storePerformance.length) return [];

    return storePerformance.storePerformance.map((_store: StoreWithMetrics, _index: number) => ({
      _name: store.name,
      _revenue: store.metrics.totalRevenue,
      _color: COLORS[index % COLORS.length]
    }));
  };

  // Generate formatted data for average transaction comparison
  const generateAvgTransactionData = () => {
    if (!storePerformance.storePerformance.length) return [];

    return storePerformance.storePerformance.map((_store: StoreWithMetrics, _index: number) => ({
      _name: store.name,
      _value: store.metrics.averageTransaction,
      _color: COLORS[index % COLORS.length]
    }));
  };

  // Render the revenue comparison chart
  const renderRevenueChart = () => {
    const data = generateRevenueData();

    if (!data.length) {
      return (
        <div className=&quot;flex flex-col items-center justify-center h-64&quot;>
          <p className=&quot;text-muted-foreground&quot;>No data available for the selected period</p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width=&quot;100%&quot; height={400}>
        <BarChart
          data={data}
          margin={{
            _top: 20,
            _right: 30,
            _left: 20,
            _bottom: 80
          }}
        >
          <CartesianGrid strokeDasharray=&quot;3 3&quot; />
          <XAxis
            dataKey=&quot;name&quot;
            angle={-45}
            textAnchor=&quot;end&quot;
            height={80}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            formatter={(_value: number) => formatCurrency(value)}
            labelFormatter={(label) => `Store: ${label}`}
          />
          <Legend />
          <Bar
            dataKey=&quot;revenue&quot;
            name=&quot;Revenue&quot;
            fill=&quot;#8884d8&quot;
          >
            {data.map((entry: { _color: string }, _index: number) => (
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
        <div className=&quot;flex flex-col items-center justify-center h-64&quot;>
          <p className=&quot;text-muted-foreground&quot;>No data available for the selected period</p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width=&quot;100%&quot; height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey=&quot;value&quot;
            nameKey=&quot;name&quot;
            cx=&quot;50%&quot;
            cy=&quot;50%&quot;
            outerRadius={150}
            fill=&quot;#8884d8&quot;
            label={(entry: { _name: string; _value: number }) => `${entry.name}: ${formatCurrency(entry.value)}`}
          >
            {data.map((entry: { _color: string }, _index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(_value: number) => formatCurrency(value)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // Render store metrics
  const renderStoreMetrics = () => {
    if (!storePerformance.storePerformance.length) return null;

    return (
      <div className=&quot;space-y-6&quot;>
        {storePerformance.storePerformance.map((_store: StoreWithMetrics) => (
          <Card key={store.id} className=&quot;overflow-hidden&quot;>
            <CardHeader className=&quot;bg-muted/50&quot;>
              <div className=&quot;flex items-start justify-between&quot;>
                <div>
                  <CardTitle className=&quot;flex items-center&quot;>
                    <MapPin className=&quot;mr-2 h-4 w-4&quot; />
                    {store.name}
                  </CardTitle>
                  <CardDescription>{store.address}, {store.city}, {store.state}</CardDescription>
                </div>
                <div className=&quot;text-right&quot;>
                  <p className=&quot;text-lg font-bold&quot;>{formatCurrency(store.metrics.totalRevenue)}</p>
                  <p className=&quot;text-sm text-muted-foreground&quot;>Total Revenue</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className=&quot;p-6&quot;>
              <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-6&quot;>
                <div>
                  <h4 className=&quot;text-sm font-medium mb-3&quot;>Store Performance</h4>
                  <dl className=&quot;space-y-2&quot;>
                    <div className=&quot;flex justify-between&quot;>
                      <dt className=&quot;text-sm text-muted-foreground&quot;>Transactions:</dt>
                      <dd className=&quot;text-sm font-medium&quot;>{store.metrics.transactionCount}</dd>
                    </div>
                    <div className=&quot;flex justify-between&quot;>
                      <dt className=&quot;text-sm text-muted-foreground&quot;>Avg. Transaction:</dt>
                      <dd className=&quot;text-sm font-medium&quot;>{formatCurrency(store.metrics.averageTransaction)}</dd>
                    </div>
                    <div className=&quot;flex justify-between&quot;>
                      <dt className=&quot;text-sm text-muted-foreground&quot;>Share of _Revenue:</dt>
                      <dd className=&quot;text-sm font-medium&quot;>
                        {storePerformance.globalMetrics.totalRevenue > 0
                          ? `${((store.metrics.totalRevenue / storePerformance.globalMetrics.totalRevenue) * 100).toFixed(1)}%`
                          : &apos;0%&apos;}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className=&quot;text-sm font-medium mb-3&quot;>Top Products</h4>
                  {store.topProducts.length > 0 ? (
                    <ScrollArea className=&quot;h-28&quot;>
                      <ul className=&quot;space-y-1&quot;>
                        {store.topProducts.map((_product: TopProduct) => (
                          <li key={product.id} className=&quot;text-sm&quot;>
                            <div className=&quot;flex justify-between&quot;>
                              <span className=&quot;truncate&quot;>{product.name}</span>
                              <span className=&quot;font-medium&quot;>{formatCurrency(product.total)}</span>
                            </div>
                            <div className=&quot;text-xs text-muted-foreground&quot;>
                              _Qty: {product.quantity}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  ) : (
                    <p className=&quot;text-sm text-muted-foreground&quot;>No product data available</p>
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
      <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4 mb-6&quot;>
        <Card>
          <CardHeader className=&quot;pb-2&quot;>
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className=&quot;text-2xl&quot;>
              {formatCurrency(globalMetrics.totalRevenue)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className=&quot;pb-2&quot;>
            <CardDescription>Transaction Count</CardDescription>
            <CardTitle className=&quot;text-2xl&quot;>
              {globalMetrics.transactionCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className=&quot;pb-2&quot;>
            <CardDescription>Average Transaction</CardDescription>
            <CardTitle className=&quot;text-2xl&quot;>
              {formatCurrency(globalMetrics.averageTransaction)}
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
          <CardTitle>Store Performance Comparison</CardTitle>
          <CardDescription>
            {storePerformance.dateRangeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className=&quot;flex flex-col space-y-4 _md:flex-row _md:space-y-0 _md:space-x-4 mb-6&quot;>
            <div className=&quot;flex space-x-4&quot;>
              {/* Date Range Selector - Start Date */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant=&quot;outline&quot;
                      className=&quot;w-[200px] justify-start text-left font-normal&quot;
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
                      className=&quot;w-[200px] justify-start text-left font-normal&quot;
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

              {/* Apply Filters Button */}
              <Button onClick={() => refetch()}>
                Apply Filters
              </Button>
            </div>
          </div>

          {/* Global Metrics */}
          {isLoading ? (
            <div className=&quot;grid grid-cols-1 _md:grid-cols-3 gap-4 mb-6&quot;>
              <Skeleton className=&quot;h-24&quot; />
              <Skeleton className=&quot;h-24&quot; />
              <Skeleton className=&quot;h-24&quot; />
            </div>
          ) : (
            renderGlobalMetrics()
          )}

          {/* Charts */}
          <Tabs defaultValue=&quot;revenue&quot; className=&quot;mb-6&quot;>
            <TabsList>
              <TabsTrigger value=&quot;revenue&quot;>Revenue Comparison</TabsTrigger>
              <TabsTrigger value=&quot;avgTransaction&quot;>Avg. Transaction</TabsTrigger>
            </TabsList>

            <TabsContent value=&quot;revenue&quot; className=&quot;pt-4&quot;>
              {isLoading ? (
                <Skeleton className=&quot;h-[400px] w-full&quot; />
              ) : isError ? (
                <div className=&quot;flex flex-col items-center justify-center h-64&quot;>
                  <p className=&quot;text-red-500&quot;>Failed to load comparison data. Please try again.</p>
                </div>
              ) : (
                renderRevenueChart()
              )}
            </TabsContent>

            <TabsContent value=&quot;avgTransaction&quot; className=&quot;pt-4&quot;>
              {isLoading ? (
                <Skeleton className=&quot;h-[400px] w-full&quot; />
              ) : isError ? (
                <div className=&quot;flex flex-col items-center justify-center h-64&quot;>
                  <p className=&quot;text-red-500&quot;>Failed to load comparison data. Please try again.</p>
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
        <h3 className=&quot;text-lg font-medium mb-4&quot;>Store Details</h3>
        {isLoading ? (
          <div className=&quot;space-y-4&quot;>
            <Skeleton className=&quot;h-48 w-full&quot; />
            <Skeleton className=&quot;h-48 w-full&quot; />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className=&quot;p-6&quot;>
              <p className=&quot;text-red-500&quot;>Failed to load store details. Please try again.</p>
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
