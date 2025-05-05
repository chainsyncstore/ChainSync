import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/providers/auth-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InventoryList } from '@/components/inventory/inventory-list';
import { LowStockAlerts } from '@/components/inventory/low-stock-alerts';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';

export default function InventoryPage() {
  const { user } = useAuth();
  
  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Inventory Management</h1>
          <p className="text-neutral-500 mt-1">Track, manage, and optimize your product inventory</p>
        </div>
        
        {user?.role !== 'cashier' && (
          <div className="flex space-x-2">
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3">
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Inventory</TabsTrigger>
              <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
              <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
              <TabsTrigger value="categories">By Category</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <InventoryList />
            </TabsContent>
            
            <TabsContent value="low-stock" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Low Stock Items</CardTitle>
                  <CardDescription>
                    Products that have fallen below their minimum stock level
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InventoryList />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="expiring" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Expiring Soon</CardTitle>
                  <CardDescription>
                    Perishable products that will expire within the next 7 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InventoryList />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="categories" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory by Category</CardTitle>
                  <CardDescription>
                    View and manage inventory by product category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InventoryList />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="md:col-span-1">
          <div className="space-y-6">
            <LowStockAlerts />
            
            {user?.role !== 'cashier' && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    New Purchase Order
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    Stock Adjustment
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Inventory Report
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                    </svg>
                    Manage Suppliers
                  </Button>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>Inventory Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">578</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-destructive">12</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-amber-500">24</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inventory Value</p>
                  <p className="text-2xl font-bold">$124,568.75</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
