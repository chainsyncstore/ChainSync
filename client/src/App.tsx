import { Route, Switch } from 'wouter';
import React, { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('@/pages/dashboard'));
const AddProduct = lazy(() => import('@/pages/add-product'));
const Inventory = lazy(() => import('@/pages/inventory'));
const Analytics = lazy(() => import('@/pages/analytics'));
const Stores = lazy(() => import('@/pages/stores'));
const Users = lazy(() => import('@/pages/users'));
const Login = lazy(() => import('@/pages/login'));
const Signup = lazy(() => import('@/pages/signup'));
const Settings = lazy(() => import('@/pages/settings'));
const Profile = lazy(() => import('@/pages/profile'));
const POS = lazy(() => import('@/pages/pos'));
const Loyalty = lazy(() => import('@/pages/loyalty'));
const Affiliates = lazy(() => import('@/pages/affiliates'));
const Assistant = lazy(() => import('@/pages/assistant'));
const Import = lazy(() => import('@/pages/import'));
const Returns = lazy(() => import('@/pages/returns'));
const Landing = lazy(() => import('@/pages/landing'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    <span className="ml-2">Loading...</span>
  </div>
);

function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/add-product" component={AddProduct} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/stores" component={Stores} />
          <Route path="/users" component={Users} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile" component={Profile} />
          <Route path="/pos" component={POS} />
          <Route path="/loyalty" component={Loyalty} />
          <Route path="/affiliates" component={Affiliates} />
          <Route path="/assistant" component={Assistant} />
          <Route path="/import" component={Import} />
          <Route path="/returns" component={Returns} />
          <Route path="/landing" component={Landing} />
          <Route>
            <div className="p-6">
              <h1 className="text-2xl font-bold">404: Not Found</h1>
              <p className="text-gray-600 dark:text-gray-400">The page you're looking for doesn't exist.</p>
            </div>
          </Route>
        </Switch>
      </Suspense>
      <Toaster />
    </>
  );
}

export default App;