import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, LineChart, PieChart } from 'lucide-react';
import { MobileStockAlert } from './mobile-stock-alert';
import { MobilePerformanceChart } from './mobile-performance-chart';
import { MobileRecentTransactions } from './mobile-recent-transactions';
import { MobileRecentReturns } from './mobile-recent-returns';
import { MobileSalesStats } from './mobile-sales-stats';

export function MobileDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data: lowStockCount } = useQuery({
    queryKey: ['/api/inventory/low-stock/count'],
  });

  const { data: salesData } = useQuery({
    queryKey: ['/api/analytics/sales/daily'],
  });

  const { data: storeComparisonData } = useQuery({
    queryKey: ['/api/analytics/sales/stores'],
  });

  return (
    <div className="flex flex-col space-y-4">
      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1"
      >
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="overview">
            <BarChart className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sales">
            <LineChart className="h-4 w-4 mr-2" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <PieChart className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <MobileSalesStats />
          <MobileStockAlert />
          <MobilePerformanceChart storeData={storeComparisonData} />
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales</CardTitle>
              <CardDescription>View your daily sales trends</CardDescription>
            </CardHeader>
            <CardContent>
              <MobilePerformanceChart salesData={salesData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Tabs defaultValue="sales">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="sales">Recent Sales</TabsTrigger>
              <TabsTrigger value="returns">Recent Returns</TabsTrigger>
            </TabsList>
            <TabsContent value="sales">
              <MobileRecentTransactions />
            </TabsContent>
            <TabsContent value="returns">
              <MobileRecentReturns />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}