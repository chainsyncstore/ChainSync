import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';

// Pages
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Inventory from '@/pages/Inventory';
import Sales from '@/pages/Sales';
import Stores from '@/pages/Stores';
import Users from '@/pages/Users';

// Layout
import Layout from '@/components/Layout';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
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
      </Layout>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;