import { Route, Switch } from &apos;wouter&apos;;
import React, { Suspense, lazy } from &apos;react&apos;;
import { Toaster } from &apos;@/components/ui/toaster&apos;;

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import(&apos;@/pages/dashboard&apos;));
const AddProduct = lazy(() => import(&apos;@/pages/add-product&apos;));
const Inventory = lazy(() => import(&apos;@/pages/inventory&apos;));
const Analytics = lazy(() => import(&apos;@/pages/analytics&apos;));
const Stores = lazy(() => import(&apos;@/pages/stores&apos;));
const Users = lazy(() => import(&apos;@/pages/users&apos;));
const Login = lazy(() => import(&apos;@/pages/login&apos;));
const Signup = lazy(() => import(&apos;@/pages/signup&apos;));
const Settings = lazy(() => import(&apos;@/pages/settings&apos;));
const Profile = lazy(() => import(&apos;@/pages/profile&apos;));
const POS = lazy(() => import(&apos;@/pages/pos&apos;));
const Loyalty = lazy(() => import(&apos;@/pages/loyalty&apos;));
const Affiliates = lazy(() => import(&apos;@/pages/affiliates&apos;));
const Assistant = lazy(() => import(&apos;@/pages/assistant&apos;));
const Import = lazy(() => import(&apos;@/pages/import&apos;));
const Returns = lazy(() => import(&apos;@/pages/returns&apos;));
const Landing = lazy(() => import(&apos;@/pages/landing&apos;));

// Loading component
const PageLoader = () => (
  <div className=&quot;flex items-center justify-center h-64&quot;>
    <div className=&quot;animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900&quot; />
    <span className=&quot;ml-2&quot;>Loading...</span>
  </div>
);

function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path=&quot;/&quot; component={Dashboard} />
          <Route path=&quot;/dashboard&quot; component={Dashboard} />
          <Route path=&quot;/add-product&quot; component={AddProduct} />
          <Route path=&quot;/inventory&quot; component={Inventory} />
          <Route path=&quot;/analytics&quot; component={Analytics} />
          <Route path=&quot;/stores&quot; component={Stores} />
          <Route path=&quot;/users&quot; component={Users} />
          <Route path=&quot;/login&quot; component={Login} />
          <Route path=&quot;/signup&quot; component={Signup} />
          <Route path=&quot;/settings&quot; component={Settings} />
          <Route path=&quot;/profile&quot; component={Profile} />
          <Route path=&quot;/pos&quot; component={POS} />
          <Route path=&quot;/loyalty&quot; component={Loyalty} />
          <Route path=&quot;/affiliates&quot; component={Affiliates} />
          <Route path=&quot;/assistant&quot; component={Assistant} />
          <Route path=&quot;/import&quot; component={Import} />
          <Route path=&quot;/returns&quot; component={Returns} />
          <Route path=&quot;/landing&quot; component={Landing} />
          <Route>
            <div className=&quot;p-6&quot;>
              <h1 className=&quot;text-2xl font-bold&quot;>_404: Not Found</h1>
              <p className=&quot;text-gray-600 _dark:text-gray-400&quot;>The page you&apos;re looking for doesn&apos;t exist.</p>
            </div>
          </Route>
        </Switch>
      </Suspense>
      <Toaster />
    </>
  );
}

export default App;
