import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { Link } from 'wouter';

import SalesTrends from '@/components/analytics/sales-trends';
import StoreComparison from '@/components/analytics/store-comparison';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/providers/auth-provider';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Analytics Dashboard</h1>
          <p className="text-neutral-500 mt-1">View and analyze store performance metrics</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="sales" className="mb-6">
        <TabsList>
          <TabsTrigger value="sales">Sales Trends</TabsTrigger>
          {isAdmin && <TabsTrigger value="stores">Store Comparison</TabsTrigger>}
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <SalesTrends />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="stores" className="space-y-4">
            <StoreComparison />
          </TabsContent>
        )}

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Analytics</CardTitle>
              <CardDescription>Inventory performance and turnover analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Inventory analytics will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Analytics</CardTitle>
              <CardDescription>Customer retention and purchase behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Customer analytics will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
