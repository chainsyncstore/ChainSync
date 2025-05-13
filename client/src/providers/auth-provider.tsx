import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

// Define User type
export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'affiliate';
  storeId?: number;
}

// Define context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup?: (userData: any) => Promise<void>; // Optional as we implement it later
  error: string | null;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include', // Important: this tells fetch to send cookies
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        console.log('Auth check response status:', res.status);
        console.log('Auth check response headers:', {
          'content-type': res.headers.get('content-type'),
          'set-cookie': res.headers.get('set-cookie')
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log('Auth check response data:', data);
          if (data.authenticated && data.user) {
            console.log('User is authenticated:', data.user);
            setUser(data.user);
          } else {
            console.log('Data format unexpected:', data);
            setUser(null);
          }
        } else {
          // Handle unauthenticated state explicitly
          const errorText = await res.text();
          console.log('Not authenticated, response:', errorText);
          setUser(null);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Login request for:', username);
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // Important: this allows the browser to store the cookie
        cache: 'no-store' // Avoid caching this request
      });
      
      console.log('Login response status:', res.status);
      console.log('Login response headers:', {
        'content-type': res.headers.get('content-type'),
        'set-cookie': res.headers.get('set-cookie')
      });
      
      // Try to get the response text first before parsing as JSON
      const responseText = await res.text();
      console.log('Raw login response:', responseText);
      
      if (!res.ok) {
        let errorMessage = 'Login failed';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || 'Invalid username or password';
          console.error('Login error data:', errorData);
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Login response data:', data);
        setUser(data);
      } catch (parseError) {
        console.error('Failed to parse login response as JSON:', parseError);
        throw new Error('Received invalid response from server');
      }
      
      // Redirect based on user role
      if (data.role === 'cashier') {
        setLocation('/pos');
      } else if (data.role === 'affiliate') {
        setLocation('/affiliates');
      } else {
        setLocation('/dashboard');
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid username or password');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Logout failed' }));
        throw new Error(errorData.message || 'Logout failed');
      }
      
      setUser(null);
      setLocation('/login');
    } catch (err: any) {
      console.error('Logout failed:', err);
      setError(err.message || 'Logout failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook for using auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
