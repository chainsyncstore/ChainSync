import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";
import { Link } from "wouter";

interface AuthLayoutProps {
  children: React.ReactNode;
  showLanding?: boolean;
}

export function AuthLayout({ children, showLanding = false }: AuthLayoutProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // If showing landing page or user is not authenticated
  if (!isAuthenticated) {
    // If showLanding is true, allow the landing page to display
    if (showLanding) {
      return <>{children}</>;
    }
    
    // Otherwise show login UI
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-bold">ChainSync</h1>
        <p className="text-xl text-muted-foreground">
          Sign in to access your retail management dashboard
        </p>
        <Button className="mt-4" onClick={() => window.location.href = '/api/login'}>
          Sign in with Replit
        </Button>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}