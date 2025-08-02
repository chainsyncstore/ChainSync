import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { QuickStats } from &apos;@/components/dashboard/quick-stats&apos;;
import { StorePerformance } from &apos;@/components/dashboard/store-performance&apos;;
import { RecentTransactions } from &apos;@/components/dashboard/recent-transactions&apos;;
import { LowStockAlerts } from &apos;@/components/inventory/low-stock-alerts&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { PlusIcon, PrinterIcon } from &apos;lucide-react&apos;;
import { Link } from &apos;wouter&apos;;

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppShell>
      {/* Page Title */}
      <div className=&quot;mb-6 flex items-center justify-between&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>Chain Dashboard</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>Overview of your retail chain performance</p>
        </div>
        <div className=&quot;flex space-x-4&quot;>
          <Button variant=&quot;outline&quot; className=&quot;hidden _md:flex&quot;>
            <PrinterIcon className=&quot;w-4 h-4 mr-2&quot; />
            Export Reports
          </Button>

          {user?.role === &apos;admin&apos; && (
            <Button asChild>
              <Link href=&quot;/stores&quot;>
                <PlusIcon className=&quot;w-4 h-4 mr-2&quot; />
                Add New Store
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats storeId={user?.role !== &apos;admin&apos; ? user?._storeId : undefined} />

      {/* Main Content Section */}
      <div className=&quot;grid grid-cols-12 gap-6&quot;>
        {/* Store Performance - hidden on mobile, visible on desktop */}
        <div className=&quot;hidden _md:block col-span-12 _lg:col-span-8&quot;>
          <StorePerformance />
        </div>

        {/* Low Stock Alerts */}
        <div className=&quot;col-span-12 _md:col-span-4&quot;>
          <LowStockAlerts />
        </div>

        {/* Recent Transactions */}
        <div className=&quot;col-span-12 _md:col-span-8&quot;>
          <RecentTransactions />
        </div>
      </div>
    </AppShell>
  );
}
