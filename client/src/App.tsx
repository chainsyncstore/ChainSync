import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';

// Layout
import Layout from '@/components/Layout';

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Products = lazy(() => import('@/pages/Products'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const Sales = lazy(() => import('@/pages/Sales'));
const Stores = lazy(() => import('@/pages/Stores'));
const Users = lazy(() => import('@/pages/Users'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    <span className="ml-2">Loading...</span>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/products" component={Products} />
            <Route path="/inventory" component={Inventory} />
            <Route path="/sales" component={Sales} />
            <Route path="/stores" component={Stores} />
            <Route path="/users" component={Users} />
            <Route>
              <div className="p-6">
                <h1 className="text-2xl font-bold">404: Not Found</h1>
                <p className="text-gray-600 dark:text-gray-400">The page you're looking for doesn't exist.</p>
              </div>
            </Route>
          </Switch>
        </Suspense>
      </Layout>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;