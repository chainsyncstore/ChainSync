import React, { createContext, useContext, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Define User type
export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'affiliate';
  storeId?: number;
}

// Define login request type
export interface LoginCredentials {
  username: string;
  password: string;
}

// Define authentication response type
interface AuthResponse {
  authenticated: boolean;
  user: User;
  message?: string;
}

// Define context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<User | null>;
  error: Error | null;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Query to check authentication status
  const { 
    data: authData,
    isLoading,
    error,
    refetch: checkAuth
  } = useQuery<AuthResponse>({
    queryKey: ['auth'],
    queryFn: async () => {
      console.log('Checking authentication status...');
      try {
        const response = await apiRequest('GET', '/api/auth/me');
        if (!response.ok) {
          const errorText = await response.text();
          console.log('Not authenticated, response:', errorText);
          return { authenticated: false, user: null };
        }
        
        const data = await response.json();
        console.log('Auth check response data:', data);
        return data;
      } catch (err) {
        console.error('Auth check failed:', err);
        throw new Error('Failed to check authentication status');
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Extract user from auth data
  const user = authData?.authenticated ? authData.user : null;
  
  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<User> => {
      console.log('Login request for:', credentials.username);
      
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || 'Invalid username or password');
      }
      
      return await response.json();
    },
    onSuccess: (userData) => {
      // Invalidate and refetch auth query
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      
      // Show success toast
      toast({
        title: 'Login successful',
        description: `Welcome back, ${userData.fullName || userData.username}!`,
        duration: 3000,
      });
      
      // Redirect based on user role
      if (userData.role === 'cashier') {
        setLocation('/pos');
      } else if (userData.role === 'affiliate') {
        setLocation('/affiliates');
      } else {
        setLocation('/dashboard');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid username or password',
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const response = await apiRequest('POST', '/api/auth/logout');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Logout failed' }));
        throw new Error(errorData.message || 'Logout failed');
      }
    },
    onSuccess: () => {
      // Clear auth data from cache
      queryClient.setQueryData(['auth'], { authenticated: false, user: null });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      
      // Show success toast
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
        duration: 3000,
      });
      
      // Redirect to login page
      setLocation('/login');
    },
    onError: (error: Error) => {
      toast({
        title: 'Logout failed',
        description: error.message || 'Failed to log out. Please try again.',
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  // Login function wrapper
  const login = async (credentials: LoginCredentials): Promise<User> => {
    return await loginMutation.mutateAsync(credentials);
  };

  // Logout function wrapper
  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  // Auth check function wrapper that returns the user (or null)
  const performAuthCheck = async (): Promise<User | null> => {
    const result = await checkAuth();
    return result.data?.authenticated ? result.data.user : null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading || loginMutation.isPending || logoutMutation.isPending,
        isAuthenticated: !!user,
        login,
        logout,
        checkAuth: performAuthCheck,
        error: error as Error,
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
