import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

interface StorePerformanceData {
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

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#F56565", // Additional colors if needed
  "#805AD5",
];

export function SalesChart() {
  const [timeRange, setTimeRange] = useState('7');
  
  const { data, isLoading } = useQuery<StorePerformanceData>({
    queryKey: ['/api/dashboard/store-performance', { days: timeRange }],
  });

  if (isLoading) {
    return (
      <Card className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <CardHeader className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Process data for daily sales chart
  const processedDailyData = data?.dailySales.reduce((acc, item) => {
    const dateStr = formatDate(new Date(item.date), { month: 'short', day: 'numeric' });
    
    const existingDay = acc.find(d => d.date === dateStr);
    if (existingDay) {
      // Store already exists for this day, add to the store-specific field
      existingDay[`store${item.storeId}`] = parseFloat(item.totalSales);
      existingDay[`storeName${item.storeId}`] = data.storeComparison.find(s => s.storeId === item.storeId)?.storeName || `Store ${item.storeId}`;
    } else {
      // Create new day entry
      const newDay: any = { date: dateStr };
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
    name: store.storeName,
    value: parseFloat(store.totalSales),
  })) || [];

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
      <CardHeader className="p-6 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium text-neutral-800">Store Performance</CardTitle>
            <p className="text-sm text-neutral-500 mt-1">Daily sales comparison across all stores</p>
          </div>
          <div className="flex items-center space-x-2">
            <Select defaultValue={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Year to date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 py-4">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={processedDailyData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
              <Tooltip 
                formatter={(value, name) => {
                  // Extract store ID from name (e.g., "store1" -> 1)
                  const storeId = parseInt(name.replace('store', ''));
                  const storeName = processedDailyData.find(item => item[`storeName${storeId}`])?.[`storeName${storeId}`] || name;
                  return [formatCurrency(value as number), storeName];
                }}
              />
              <Legend 
                formatter={(value) => {
                  // Extract store ID from value (e.g., "store1" -> 1)
                  const storeId = parseInt(value.replace('store', ''));
                  return processedDailyData.find(item => item[`storeName${storeId}`])?.[`storeName${storeId}`] || value;
                }}
              />
              {storeIds.map((storeId, index) => (
                <Line
                  key={storeId}
                  type="monotone"
                  dataKey={`store${storeId}`}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  activeDot={{ r: 8 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      <div className="border-t border-neutral-200 px-6 py-3">
        <div className="grid grid-cols-3 gap-4">
          {data?.storeComparison.map((store, index) => (
            <div className="flex items-center" key={store.storeId}>
              <div 
                className="w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              ></div>
              <span className="text-sm text-neutral-600">{store.storeName}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
