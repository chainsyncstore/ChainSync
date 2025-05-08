import React from 'react';
import { useAuth } from '@/providers/auth-provider';
import { LoginForm } from '@/components/auth/login-form';
import { useLocation } from 'wouter';
import { ChainSyncLogo } from '@/components/ui/chain-sync-logo';

export default function LoginPage() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      // Redirect based on user role
      if (user?.role === 'cashier') {
        setLocation('/pos');
      } else {
        setLocation('/dashboard');
      }
    }
  }, [isAuthenticated, user, setLocation]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <ChainSyncLogo
            className="w-12 h-12"
            textClassName="ml-2 text-3xl font-bold text-gray-900"
            iconColor="#0B4F82"
            textColor="#0B4F82"
          />
        </div>
        <p className="text-gray-600">Retail Management Platform</p>
      </div>
      
      <LoginForm />
      
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} ChainSync. All rights reserved.</p>
      </div>
    </div>
  );
}
