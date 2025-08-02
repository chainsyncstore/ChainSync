import React, { useState } from &apos;react&apos;;
import { useQuery } from &apos;@tanstack/react-query&apos;;
import { Card, CardContent, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from &apos;@/components/ui/select&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import {
  Bar,
  BarChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from &apos;recharts&apos;;
import { formatCurrency, formatDate } from &apos;@/lib/utils&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;

interface StorePerformanceData {
  _storeComparison: Array<{
    _storeId: number;
    _storeName: string;
    _totalSales: string;
    _transactionCount: number;
  }>;
  _dailySales: Array<{
    _date: string;
    _storeId: number;
    _totalSales: string;
    _transactionCount: number;
  }>;
}

const CHART_COLORS = [
  &apos;hsl(var(--chart-1))&apos;,
  &apos;hsl(var(--chart-2))&apos;,
  &apos;hsl(var(--chart-3))&apos;,
  &apos;hsl(var(--chart-4))&apos;,
  &apos;hsl(var(--chart-5))&apos;,
  &apos;#F56565&apos;, // Additional colors if needed
  &apos;#805AD5&apos;
];

export function SalesChart() {
  const { user } = useAuth();
  const isAdmin = user?.role === &apos;admin&apos;;
  const [timeRange, setTimeRange] = useState(&apos;7&apos;);

  const { data, isLoading } = useQuery<StorePerformanceData>({
    _queryKey: [&apos;/api/dashboard/store-performance&apos;, { _days: timeRange }]
  });

  if (isLoading) {
    return (
      <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden&quot;>
        <CardHeader className=&quot;p-6 border-b border-neutral-200&quot;>
          <div className=&quot;flex items-center justify-between&quot;>
            <div>
              <Skeleton className=&quot;h-6 w-40 mb-2&quot; />
              <Skeleton className=&quot;h-4 w-64&quot; />
            </div>
            <Skeleton className=&quot;h-10 w-32&quot; />
          </div>
        </CardHeader>
        <CardContent className=&quot;p-6&quot;>
          <Skeleton className=&quot;h-64 w-full&quot; />
        </CardContent>
      </Card>
    );
  }

  // Process data for daily sales chart
  const processedDailyData = data?.dailySales.reduce((acc, item) => {
    const dateStr = formatDate(new Date(item.date), { _month: &apos;short&apos;, _day: &apos;numeric&apos; });

    const existingDay = acc.find(d => d.date === dateStr);
    if (existingDay) {
      // Store already exists for this day, add to the store-specific field
      existingDay[`store${item.storeId}`] = parseFloat(item.totalSales);
      existingDay[`storeName${item.storeId}`] = data.storeComparison.find(s => s.storeId === item.storeId)?.storeName || `Store ${item.storeId}`;
    } else {
      // Create new day entry
      const _newDay: any = { _date: dateStr };
      newDay[`store${item.storeId}`] = parseFloat(item.totalSales);
      newDay[`storeName${item.storeId}`] = data.storeComparison.find(s => s.storeId === item.storeId)?.storeName || `Store ${item.storeId}`;
      acc.push(newDay);
    }

    return acc;
  }, [] as any[]) || [];

  // Sort by date
  processedDailyData.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Get unique store IDs
  const storeIds = data?.storeComparison.map(store => store.storeId) || [];

  // Process data for comparison chart
  const comparisonData = data?.storeComparison.map(store => ({
    _name: store.storeName,
    _value: parseFloat(store.totalSales)
  })) || [];

  return (
    <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden&quot;>
      <CardHeader className=&quot;p-6 border-b border-neutral-200&quot;>
        <div className=&quot;flex items-center justify-between&quot;>
          <div>
            <CardTitle className=&quot;text-lg font-medium text-neutral-800&quot;>
              {isAdmin ? &apos;Store Performance&apos; : &apos;Store Sales Performance&apos;}
            </CardTitle>
            <p className=&quot;text-sm text-neutral-500 mt-1&quot;>
              {isAdmin
                ? &apos;Daily sales comparison across all stores&apos;
                : `Daily sales performance for ${data?.storeComparison[0]?.storeName || &apos;your store&apos;}`
              }
            </p>
          </div>
          <div className=&quot;flex items-center space-x-2&quot;>
            <Select defaultValue={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className=&quot;w-[180px]&quot;>
                <SelectValue placeholder=&quot;Select time range&quot; />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=&quot;7&quot;>Last 7 days</SelectItem>
                <SelectItem value=&quot;30&quot;>Last 30 days</SelectItem>
                <SelectItem value=&quot;90&quot;>Last 90 days</SelectItem>
                <SelectItem value=&quot;365&quot;>Year to date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className=&quot;px-6 py-4&quot;>
        <div className=&quot;h-64 w-full&quot;>
          <ResponsiveContainer width=&quot;100%&quot; height=&quot;100%&quot;>
            <LineChart
              data={processedDailyData}
              margin={{
                _top: 5,
                _right: 30,
                _left: 20,
                _bottom: 5
              }}
            >
              <CartesianGrid strokeDasharray=&quot;3 3&quot; />
              <XAxis dataKey=&quot;date&quot; />
              <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
              <Tooltip
                formatter={(value, _name: any) => {
                  // Extract store ID from name (e.g., &quot;store1&quot; -> 1)
                  if (typeof name === &apos;string&apos; && name.startsWith(&apos;store&apos;)) {
                    const storeId = parseInt(name.replace(&apos;store&apos;, &apos;&apos;));
                    const storeName = processedDailyData.find(item => item[`storeName${storeId}`])?.[`storeName${storeId}`] || name;
                    return [formatCurrency(value as number), storeName];
                  }
                  return [formatCurrency(value as number), name];
                }}
              />
              <Legend
                formatter={(_value: any) => {
                  // Extract store ID from value (e.g., &quot;store1&quot; -> 1)
                  if (typeof value === &apos;string&apos; && value.startsWith(&apos;store&apos;)) {
                    const storeId = parseInt(value.replace(&apos;store&apos;, &apos;&apos;));
                    return processedDailyData.find(item => item[`storeName${storeId}`])?.[`storeName${storeId}`] || value;
                  }
                  return value;
                }}
              />
              {storeIds.map((storeId, index) => (
                <Line
                  key={storeId}
                  type=&quot;monotone&quot;
                  dataKey={`store${storeId}`}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  activeDot={{ _r: 8 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      <div className=&quot;border-t border-neutral-200 px-6 py-3&quot;>
        <div className=&quot;flex flex-wrap gap-4&quot;>
          {data?.storeComparison.map((store, index) => (
            <div className=&quot;flex items-center&quot; key={store.storeId}>
              <div
                className=&quot;w-3 h-3 rounded-full mr-2&quot;
                style={{ _backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
               />
              <span className=&quot;text-sm text-neutral-600&quot;>{store.storeName}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
