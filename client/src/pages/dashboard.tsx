import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { QuickStats } from '@/components/dashboard/quick-stats';
import { StorePerformance } from '@/components/dashboard/store-performance';
import { AiAssistant } from '@/components/dashboard/ai-assistant';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { PlusIcon, PrinterIcon } from 'lucide-react';
import { Link } from 'wouter';

export default function DashboardPage() {
  const { user } = useAuth();
  
  return (
    <AppShell>
      {/* Page Title */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Chain Dashboard</h1>
          <p className="text-neutral-500 mt-1">Overview of your retail chain performance</p>
        </div>
        <div className="flex space-x-4">
          <Button variant="outline" className="hidden md:flex">
            <PrinterIcon className="w-4 h-4 mr-2" />
            Export Reports
          </Button>
          
          {user?.role === 'admin' && (
            <Button asChild>
              <Link href="/stores">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add New Store
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats storeId={user?.role !== 'admin' ? user?.storeId : undefined} />

      {/* Main Content Section */}
      <div className="grid grid-cols-12 gap-6">
        {/* Store Performance - hidden on mobile, visible on desktop */}
        <div className="hidden md:block col-span-12 lg:col-span-8">
          <StorePerformance />
        </div>

        {/* AI Assistant Panel - full width on mobile, partial on desktop */}
        <div className="col-span-12 lg:col-span-4 md:col-span-4">
          <AiAssistant />
        </div>

        {/* Recent Transactions */}
        <div className="col-span-12">
          <RecentTransactions />
        </div>
      </div>
    </AppShell>
  );
}
