import React, { createContext, useContext, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { AuthResponse } from '@shared/schema';

// Define User interface for the auth context
// We remove password for security reasons
export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'affiliate';
  storeId?: number;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
    queryFn: async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: "include",
          headers: {
            "Accept": "application/json",
            "Cache-Control": "no-cache, no-store",
            "Pragma": "no-cache"
          },
          cache: "no-store"
        });
        
        // Return null when not authenticated (401)
        if (res.status === 401) {
          console.log("401 response in query, returning null as configured");
          return { authenticated: false, user: null };
        }
        
        if (!res.ok) {
          throw new Error(`${res.status}: ${res.statusText}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error("Error fetching auth status:", error);
        return { authenticated: false, user: null };
      }
    }
  });

  // Extract and convert user from auth data
  const user: User | null = (() => {
    if (authData?.authenticated && authData?.user) {
      // Get role and ensure it's one of our valid types
      const role = authData.user.role as string;
      const validRole = ['admin', 'manager', 'cashier', 'affiliate'].includes(role) 
          ? role as 'admin' | 'manager' | 'cashier' | 'affiliate'
          : 'cashier'; // Default role as fallback

      // Convert possibly null values to undefined
      const storeId = authData.user.storeId === null ? undefined : authData.user.storeId;
      const lastLogin = authData.user.lastLogin === null ? undefined : authData.user.lastLogin;
      
      return {
        id: authData.user.id,
        username: authData.user.username,
        fullName: authData.user.fullName,
        email: authData.user.email,
        role: validRole,
        storeId,
        lastLogin,
        createdAt: authData.user.createdAt,
        updatedAt: authData.user.updatedAt
      };
    }
    return null;
  })();
  
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
      
      // Transform the user data to match our User interface
      const user = data.user;
      
      // Get role and ensure it's one of our valid types
      const role = user.role as string;
      const validRole = ['admin', 'manager', 'cashier', 'affiliate'].includes(role) 
          ? role as 'admin' | 'manager' | 'cashier' | 'affiliate'
          : 'cashier'; // Default role as fallback

      // Convert possibly null values to undefined
      const storeId = user.storeId === null ? undefined : user.storeId;
      const lastLogin = user.lastLogin === null ? undefined : user.lastLogin;
      
      // Return properly typed user object
      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: validRole,
        storeId,
        lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
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
      const errorMessage = error.message?.includes('401:') ? 
        'Invalid Username or Password' : 
        (error.message || 'Invalid Username or Password');
        
      toast({
        title: 'Login failed',
        description: errorMessage,
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
    
    if (data?.authenticated && data?.user) {
      // Get role and ensure it's one of our valid types
      const role = data.user.role as string;
      const validRole = ['admin', 'manager', 'cashier', 'affiliate'].includes(role) 
          ? role as 'admin' | 'manager' | 'cashier' | 'affiliate'
          : 'cashier'; // Default role as fallback

      // Convert possibly null values to undefined
      const storeId = data.user.storeId === null ? undefined : data.user.storeId;
      const lastLogin = data.user.lastLogin === null ? undefined : data.user.lastLogin;
      
      // Type conversion to match our User interface
      const user: User = {
        id: data.user.id,
        username: data.user.username,
        fullName: data.user.fullName,
        email: data.user.email,
        role: validRole,
        storeId,
        lastLogin,
        createdAt: data.user.createdAt,
        updatedAt: data.user.updatedAt
      };
      return user;
    }
    
    return null;
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
