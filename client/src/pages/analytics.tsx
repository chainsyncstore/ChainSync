import { Card, CardContent, CardDescription, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { ArrowLeft } from &apos;lucide-react&apos;;
import { Link } from &apos;wouter&apos;;
import SalesTrends from &apos;@/components/analytics/sales-trends&apos;;
import StoreComparison from &apos;@/components/analytics/store-comparison&apos;;

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === &apos;admin&apos;;

  return (
    <AppShell>
      <div className=&quot;flex items-center justify-between mb-6&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>Analytics Dashboard</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>View and analyze store performance metrics</p>
        </div>
        <Button variant=&quot;outline&quot; asChild>
          <Link href=&quot;/dashboard&quot;>
            <ArrowLeft className=&quot;mr-2 h-4 w-4&quot; />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Tabs defaultValue=&quot;sales&quot; className=&quot;mb-6&quot;>
        <TabsList>
          <TabsTrigger value=&quot;sales&quot;>Sales Trends</TabsTrigger>
          {isAdmin && <TabsTrigger value=&quot;stores&quot;>Store Comparison</TabsTrigger>}
          <TabsTrigger value=&quot;inventory&quot;>Inventory</TabsTrigger>
          <TabsTrigger value=&quot;customers&quot;>Customers</TabsTrigger>
        </TabsList>

        <TabsContent value=&quot;sales&quot; className=&quot;space-y-4&quot;>
          <SalesTrends />
        </TabsContent>

        {isAdmin && (
          <TabsContent value=&quot;stores&quot; className=&quot;space-y-4&quot;>
            <StoreComparison />
          </TabsContent>
        )}

        <TabsContent value=&quot;inventory&quot; className=&quot;space-y-4&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Inventory Analytics</CardTitle>
              <CardDescription>Inventory performance and turnover analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <p className=&quot;text-muted-foreground&quot;>
                Inventory analytics will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value=&quot;customers&quot; className=&quot;space-y-4&quot;>
          <Card>
            <CardHeader>
              <CardTitle>Customer Analytics</CardTitle>
              <CardDescription>Customer retention and purchase behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <p className=&quot;text-muted-foreground&quot;>
                Customer analytics will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
