import React, { createContext, useContext, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AuthResponse, User } from '@shared/schema';

// Define login credentials type
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
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
    isLoading: authLoading,
    error: authError,
    refetch: refetchAuth,
  } = useQuery<AuthResponse>({
    queryKey: ['/api/auth/me'],
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: false,
  });

  // Extract user from auth data
  const user = authData?.authenticated && authData?.user ? authData.user : null;
  const isAuthenticated = !!user;
  
  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<User> => {
      // Extract rememberMe if present
      const { rememberMe, ...loginCredentials } = credentials;
      
      // Send rememberMe as query param if true
      const endpoint = rememberMe 
        ? `/api/auth/login?remember=true` 
        : '/api/auth/login';
      
      const response = await apiRequest('POST', endpoint, loginCredentials);
      const data = await response.json();
      
      if (!data.authenticated || !data.user) {
        throw new Error(data.message || 'Authentication failed');
      }
      
      return data.user;
    },
    onSuccess: (userData) => {
      // Invalidate and refetch auth query
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
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
      await apiRequest('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      // Clear auth data from cache
      queryClient.setQueryData(['/api/auth/me'], { authenticated: false, user: null });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
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
  const checkAuth = async (): Promise<User | null> => {
    const result = await refetchAuth();
    const data = result.data;
    return data?.authenticated && data?.user ? data.user : null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: authLoading || loginMutation.isPending || logoutMutation.isPending,
        isAuthenticated,
        login,
        logout,
        checkAuth,
        error: authError as Error,
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
