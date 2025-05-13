import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, Pie, Cell, BarChart, PieChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export function MobileInventoryStats() {
  const [viewType, setViewType] = useState('category');
  const [storeFilter, setStoreFilter] = useState('');

  // Fetch stores for filter
  const { data: stores } = useQuery({
    queryKey: ['/api/stores'],
  });

  // Fetch inventory stats
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['/api/inventory/stats', viewType, storeFilter],
    queryFn: async () => {
      let url = `/api/inventory/stats?view=${viewType}`;
      if (storeFilter) url += `&store=${storeFilter}`;
      const response = await fetch(url);
      return response.json();
    },
  });

  // Colors for the charts
  const COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6',
    '#a855f7', '#f43f5e', '#84cc16', '#6366f1'
  ];

  // Format data for the charts
  const formatData = () => {
    if (!statsData) return [];
    
    return viewType === 'category'
      ? statsData.map((item: any, index: number) => ({
          name: item.name,
          value: item.count,
          fill: COLORS[index % COLORS.length],
        }))
      : statsData.map((item: any, index: number) => ({
          name: item.name,
          inStock: item.inStock,
          lowStock: item.lowStock,
          outOfStock: item.outOfStock,
        }));
  };

  const chartData = formatData();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Inventory Statistics</CardTitle>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
          <Select value={viewType} onValueChange={setViewType}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="View by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">By Category</SelectItem>
              <SelectItem value="store">By Store</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={storeFilter} onValueChange={setStoreFilter} disabled={viewType === 'store'}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Stores</SelectItem>
              {stores && stores.map((store: any) => (
                <SelectItem key={store.id} value={store.id.toString()}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] w-full">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              {viewType === 'category' ? (
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} items`, 'Count']} />
                  <Legend />
                </PieChart>
              ) : (
                <BarChart
                  data={chartData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="inStock" name="In Stock" fill="#10b981" />
                  <Bar dataKey="lowStock" name="Low Stock" fill="#f59e0b" />
                  <Bar dataKey="outOfStock" name="Out of Stock" fill="#ef4444" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}