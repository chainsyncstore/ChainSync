import React, { useEffect, Suspense } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { CurrencyProvider } from "@/providers/currency-provider";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import StoresPage from "@/pages/stores";
import AnalyticsPage from "@/pages/analytics";
import InventoryPage from "@/pages/inventory";
import UsersPage from "@/pages/users";
import SettingsPage from "@/pages/settings";
import PosPage from "@/pages/pos";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import LandingPage from "@/pages/landing";
import NotFound from "@/pages/not-found";
import PaymentTestingPage from "@/pages/payment-testing";
import LoyaltyPage from "@/pages/loyalty";
import ImportPage from "@/pages/import";
import ProductImportPage from "@/pages/product-import";
import AddProductPage from "@/pages/add-product";
import AssistantPage from "@/pages/assistant";
import ProfilePage from "@/pages/profile";

// Protected route component
function ProtectedRoute({ component: Component, adminOnly = false, isManagerOrAdmin = false, ...rest }: any) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  // Use effect for navigation after component mounts
  useEffect(() => {
    // Redirect to landing page if not authenticated
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
      return;
    }

    // Check for admin access if required
    if (!isLoading && isAuthenticated && adminOnly && user?.role !== "admin") {
      setLocation("/dashboard");
      return;
    }
    
    // Check for manager or admin access if required
    if (!isLoading && isAuthenticated && isManagerOrAdmin && 
        user?.role !== "admin" && user?.role !== "manager") {
      setLocation("/dashboard");
      return;
    }
  }, [isAuthenticated, isLoading, user, adminOnly, isManagerOrAdmin, setLocation]);

  // Handle loading state
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Don't render during redirects
  if (!isAuthenticated || (adminOnly && user?.role !== "admin")) {
    return <div className="flex items-center justify-center h-screen">Redirecting...</div>;
  }

  // Render component if authorized
  return <Component {...rest} />;
}

function DefaultRoute() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  // Use effect hook to handle navigation after render
  useEffect(() => {
    // If user is authenticated, redirect based on role
    if (isAuthenticated && user) {
      if (user.role === "cashier") {
        setLocation("/pos");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, isAuthenticated, setLocation]);
  
  // If not authenticated, show the landing page
  if (!isAuthenticated) {
    return <LandingPage />;
  }
  
  // Return a loading indicator while redirecting
  return <div className="flex items-center justify-center h-screen">Redirecting...</div>;
}

function DashboardRoute() {
  return <ProtectedRoute component={DashboardPage} />;
}

function StoresRoute() {
  return <ProtectedRoute component={StoresPage} />;
}

function AnalyticsRoute() {
  return <ProtectedRoute component={AnalyticsPage} />;
}

function InventoryRoute() {
  return <ProtectedRoute component={InventoryPage} />;
}

function UsersRoute() {
  return <ProtectedRoute component={UsersPage} adminOnly={true} />;
}

function SettingsRoute() {
  return <ProtectedRoute component={SettingsPage} />;
}

function PosRoute() {
  return <ProtectedRoute component={PosPage} />;
}

function AffiliatesRoute() {
  const AffiliatePage = React.lazy(() => import('./pages/affiliates'));
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <AffiliatePage />
    </Suspense>
  );
}

function SignupRoute() {
  const SignupPage = React.lazy(() => import('./pages/signup'));
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <SignupPage />
    </Suspense>
  );
}

function PaymentTestingRoute() {
  return <ProtectedRoute component={PaymentTestingPage} adminOnly={true} />;
}

function ReturnsRoute() {
  const ReturnsPage = React.lazy(() => import('./pages/returns'));
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ProtectedRoute component={ReturnsPage} />
    </Suspense>
  );
}

function LoyaltyRoute() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ProtectedRoute component={LoyaltyPage} />
    </Suspense>
  );
}

function ImportRoute() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ProtectedRoute component={ImportPage} isManagerOrAdmin={true} />
    </Suspense>
  );
}

function ProductImportRoute() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ProtectedRoute component={ProductImportPage} isManagerOrAdmin={true} />
    </Suspense>
  );
}

function AddProductRoute() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ProtectedRoute component={AddProductPage} isManagerOrAdmin={true} />
    </Suspense>
  );
}

function AssistantRoute() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ProtectedRoute component={AssistantPage} />
    </Suspense>
  );
}

function ProfileRoute() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ProtectedRoute component={ProfilePage} />
    </Suspense>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupRoute} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/dashboard" component={DashboardRoute} />
      <Route path="/stores" component={StoresRoute} />
      <Route path="/analytics" component={AnalyticsRoute} />
      <Route path="/inventory" component={InventoryRoute} />
      <Route path="/users" component={UsersRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/pos" component={PosRoute} />
      <Route path="/affiliates" component={AffiliatesRoute} />
      <Route path="/returns" component={ReturnsRoute} />
      <Route path="/loyalty" component={LoyaltyRoute} />
      <Route path="/import" component={ImportRoute} />
      <Route path="/product-import" component={ProductImportRoute} />
      <Route path="/add-product" component={AddProductRoute} />
      <Route path="/assistant" component={AssistantRoute} />
      <Route path="/profile" component={ProfileRoute} />
      <Route path="/payment-testing" component={PaymentTestingRoute} />
      <Route path="/" component={DefaultRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CurrencyProvider>
          <AppRoutes />
          <Toaster />
        </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
