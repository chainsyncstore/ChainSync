import React from 'react';
import { Line, Bar } from 'recharts';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface MobilePerformanceChartProps {
  salesData?: any;
  storeData?: any;
}

export function MobilePerformanceChart({ salesData, storeData }: MobilePerformanceChartProps) {
  // Determine which data to use
  const data = salesData || storeData;
  const type = salesData ? 'sales' : 'stores';
  
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{type === 'sales' ? 'Daily Sales' : 'Store Performance'}</CardTitle>
          <CardDescription>
            {type === 'sales' ? 'Last 7 days' : 'Comparison by location'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <Skeleton className="h-[180px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for sales chart
  const formattedData = type === 'sales' 
    ? data.map((day: any) => ({
        date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total: parseFloat(day.total)
      }))
    : data.map((store: any) => ({
        name: store.name,
        sales: parseFloat(store.total)
      }));

  // Colors for store bars
  const storeColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{type === 'sales' ? 'Daily Sales' : 'Store Performance'}</CardTitle>
        <CardDescription>
          {type === 'sales' ? 'Last 7 days' : 'Comparison by location'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'sales' ? (
              <ComposedChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `$${value}`} 
                />
                <Tooltip 
                  formatter={(value: any) => [`$${value}`, 'Sales']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#4f46e5" 
                  strokeWidth={2} 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 6, strokeWidth: 2 }} 
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={formattedData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `$${value}`} 
                />
                <YAxis dataKey="name" type="category" width={80} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(value: any) => [`$${value}`, 'Sales']}
                  labelFormatter={(label) => `Store: ${label}`}
                />
                <Bar 
                  dataKey="sales" 
                  fill="#4f46e5" 
                  barSize={20} 
                  radius={[0, 4, 4, 0]}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}