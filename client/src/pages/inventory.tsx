import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from &apos;@/components/ui/card&apos;;
import { InventoryList } from &apos;@/components/inventory/inventory-list&apos;;
import { LowStockAlerts } from &apos;@/components/inventory/low-stock-alerts&apos;;
import { ExpiringItems } from &apos;@/components/inventory/expiring-items&apos;;
import { ExpiredItems } from &apos;@/components/inventory/expired-items&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { PlusIcon, AlertCircle } from &apos;lucide-react&apos;;
import { formatCurrency } from &apos;@/lib/utils&apos;;

export default function InventoryPage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <div className=&quot;mb-6 flex items-center justify-between&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>Inventory Management</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>Track, manage, and optimize your product inventory</p>
        </div>

        {user?.role !== &apos;cashier&apos; && (
          <div className=&quot;flex space-x-2&quot;>
            <Button asChild>
              <a href=&quot;/add-product&quot;>
                <PlusIcon className=&quot;w-4 h-4 mr-2&quot; />
                Add Product
              </a>
            </Button>
          </div>
        )}
      </div>

      <div className=&quot;grid grid-cols-1 _md:grid-cols-4 gap-6&quot;>
        <div className=&quot;_md:col-span-3&quot;>
          <Tabs defaultValue=&quot;all&quot; className=&quot;space-y-4&quot;>
            <TabsList>
              <TabsTrigger value=&quot;all&quot;>All Inventory</TabsTrigger>
              <TabsTrigger value=&quot;low-stock&quot;>Low Stock</TabsTrigger>
              <TabsTrigger value=&quot;expiring&quot;>Expiring Soon</TabsTrigger>
              <TabsTrigger value=&quot;expired&quot;>Expired Items</TabsTrigger>
              <TabsTrigger value=&quot;categories&quot;>By Category</TabsTrigger>
            </TabsList>

            <TabsContent value=&quot;all&quot; className=&quot;space-y-4&quot;>
              <InventoryList />
            </TabsContent>

            <TabsContent value=&quot;low-stock&quot; className=&quot;space-y-4&quot;>
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

            <TabsContent value=&quot;expiring&quot; className=&quot;space-y-4&quot;>
              <ExpiringItems />
            </TabsContent>

            <TabsContent value=&quot;expired&quot; className=&quot;space-y-4&quot;>
              <ExpiredItems />
            </TabsContent>

            <TabsContent value=&quot;categories&quot; className=&quot;space-y-4&quot;>
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

        <div className=&quot;_md:col-span-1&quot;>
          <div className=&quot;space-y-6&quot;>
            <LowStockAlerts />

            <Card className=&quot;border-orange-200 bg-orange-50&quot;>
              <CardHeader className=&quot;pb-3&quot;>
                <CardTitle className=&quot;flex items-center text-orange-800 text-sm&quot;>
                  <AlertCircle className=&quot;h-4 w-4 mr-2&quot; />
                  Expiry Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className=&quot;text-sm text-orange-700&quot;>
                  <p className=&quot;mb-2&quot;>Products with expiration dates are monitored automatically.</p>
                  <ul className=&quot;list-disc pl-5 space-y-1&quot;>
                    <li>Items expiring within 30 days are highlighted</li>
                    <li>Expired items are blocked at checkout</li>
                    <li>Set expiry dates when adding inventory</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {user?.role !== &apos;cashier&apos; && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className=&quot;space-y-2&quot;>
                  <Button variant=&quot;outline&quot; className=&quot;w-full justify-start&quot;>
                    <svg className=&quot;w-4 h-4 mr-2&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;>
                      <path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth=&quot;2&quot; d=&quot;M12 4v16m8-8H4&quot; />
                    </svg>
                    New Purchase Order
                  </Button>

                  <Button variant=&quot;outline&quot; className=&quot;w-full justify-start&quot;>
                    <svg className=&quot;w-4 h-4 mr-2&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;>
                      <path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth=&quot;2&quot; d=&quot;M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2&quot; />
                    </svg>
                    Stock Adjustment
                  </Button>

                  <Button variant=&quot;outline&quot; className=&quot;w-full justify-start&quot;>
                    <svg className=&quot;w-4 h-4 mr-2&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;>
                      <path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth=&quot;2&quot; d=&quot;M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z&quot; />
                    </svg>
                    Inventory Report
                  </Button>

                  <Button variant=&quot;outline&quot; className=&quot;w-full justify-start&quot;>
                    <svg className=&quot;w-4 h-4 mr-2&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;>
                      <path strokeLinecap=&quot;round&quot; strokeLinejoin=&quot;round&quot; strokeWidth=&quot;2&quot; d=&quot;M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z&quot; />
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
              <CardContent className=&quot;space-y-4&quot;>
                <div>
                  <p className=&quot;text-sm font-medium text-muted-foreground&quot;>Total Products</p>
                  <p className=&quot;text-2xl font-bold&quot;>578</p>
                </div>

                <div>
                  <p className=&quot;text-sm font-medium text-muted-foreground&quot;>Out of Stock</p>
                  <p className=&quot;text-2xl font-bold text-destructive&quot;>12</p>
                </div>

                <div>
                  <p className=&quot;text-sm font-medium text-muted-foreground&quot;>Low Stock</p>
                  <p className=&quot;text-2xl font-bold text-amber-500&quot;>24</p>
                </div>

                <div>
                  <p className=&quot;text-sm font-medium text-muted-foreground&quot;>Inventory Value</p>
                  <p className=&quot;text-2xl font-bold&quot;>{formatCurrency(124568.75)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
