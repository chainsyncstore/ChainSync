import React from 'react';
import { useAuth } from '@/providers/auth-provider';
import { LoginForm } from '@/components/auth/login-form';
import { useLocation } from 'wouter';

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
        <div className="flex items-center justify-center mb-4">
          <svg className="w-12 h-12 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/>
            <path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/>
            <path d="M5 16C4.44772 16 4 16.4477 4 17V19C4 19.5523 4.44772 20 5 20H19C19.5523 20 20 19.5523 20 19V17C20 16.4477 19.5523 16 19 16H5Z" fill="currentColor"/>
          </svg>
          <h1 className="text-3xl font-bold text-gray-900 ml-2">ChainSync</h1>
        </div>
        <p className="text-gray-600">Retail Management Platform</p>
      </div>
      
      <LoginForm />
      
      <div className="mt-8 text-center text-sm text-gray-500">
        <p className="mb-2">
          <a 
            href="/debug-login" 
            className="text-primary hover:underline"
            onClick={(e) => {
              e.preventDefault();
              setLocation('/debug-login');
            }}
          >
            Debug Login
          </a>
        </p>
        <p>© {new Date().getFullYear()} ChainSync. All rights reserved.</p>
      </div>
    </div>
  );
}
