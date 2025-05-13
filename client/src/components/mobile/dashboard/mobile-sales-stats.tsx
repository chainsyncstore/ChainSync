import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, ArrowRight } from 'lucide-react';

export function MobileSalesStats() {
  const { data: salesStats, isLoading } = useQuery({
    queryKey: ['/api/analytics/sales/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array(4).fill(0).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-8 w-[80px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Sales',
      value: salesStats?.totalSales ? `$${parseFloat(salesStats.totalSales).toFixed(2)}` : '$0.00',
      trend: salesStats?.salesTrend,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-100'
    },
    {
      title: 'Orders',
      value: salesStats?.totalOrders || 0,
      trend: salesStats?.ordersTrend,
      icon: ShoppingBag,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Customers',
      value: salesStats?.totalCustomers || 0,
      trend: salesStats?.customersTrend,
      icon: Users,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-100'
    },
    {
      title: 'AVG Order',
      value: salesStats?.avgOrderValue ? `$${parseFloat(salesStats.avgOrderValue).toFixed(2)}` : '$0.00',
      trend: salesStats?.avgOrderTrend,
      icon: ArrowRight,
      color: 'text-amber-500',
      bgColor: 'bg-amber-100'
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground">{stat.title}</p>
                <p className="text-xl font-semibold mt-1">{stat.value}</p>
              </div>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            {stat.trend !== undefined && (
              <div className="mt-2 flex items-center">
                {stat.trend > 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-rose-500 mr-1" />
                )}
                <span className={`text-xs ${stat.trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {Math.abs(stat.trend)}% {stat.trend > 0 ? 'up' : 'down'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}