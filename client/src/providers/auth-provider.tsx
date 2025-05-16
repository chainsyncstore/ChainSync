import React, { createContext, useContext, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { AuthResponse } from '@shared/schema';

// Define User interface for the auth context
// Updated for Replit Auth
export interface User {
  id: string; // Changed to string for Replit Auth user ID
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  profileImageUrl: string | null;
  role: 'admin' | 'manager' | 'cashier' | 'affiliate';
  storeId?: number;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// With Replit Auth, traditional login credentials are no longer needed
// The auth is handled by Replit's OpenID Connect provider
export interface LoginCredentials {
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
  refreshUser: () => Promise<void>;
  error: Error | null;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Query to check authentication status - updated for Replit Auth
  const { 
    data: authData,
    isLoading: authLoading,
    error: authError,
    refetch: refetchAuth,
  } = useQuery<AuthResponse>({
    queryKey: ['/api/auth/user'],
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: false,
    queryFn: async () => {
      try {
        const res = await fetch('/api/auth/user', {
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
        
        const userData = await res.json();
        return { authenticated: true, user: userData };
      } catch (error) {
        console.error("Error fetching auth status:", error);
        return { authenticated: false, user: null };
      }
    }
  });

  // Extract and convert user from auth data - Updated for Replit Auth
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
        email: authData.user.email,
        firstName: authData.user.firstName,
        lastName: authData.user.lastName,
        fullName: authData.user.fullName,
        profileImageUrl: authData.user.profileImageUrl,
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
  
  // Login function - updated for Replit Auth
  // With Replit Auth, we don't use a mutation, we simply redirect to Replit's auth endpoint
  const loginMutation = {
    isPending: false,
    mutateAsync: async (credentials: LoginCredentials): Promise<User> => {
      // Extract rememberMe if present
      const { rememberMe } = credentials;
      
      // For Replit Auth, redirect to the login endpoint
      // The rememberMe parameter can be handled server-side if needed
      const endpoint = rememberMe 
        ? `/api/login?remember=true` 
        : '/api/login';
      
      // Redirect to Replit's auth endpoint
      window.location.href = endpoint;
      
      // This promise never resolves as we redirect away
      return new Promise<User>((resolve) => {
        // This is just a placeholder since we redirect before resolution
        setTimeout(() => {
          resolve({} as User);
        }, 1000);
      });
    }
  };

  // Logout function - updated for Replit Auth
  // With Replit Auth, we don't use a mutation, we simply redirect to Replit's logout endpoint
  const logoutMutation = {
    isPending: false,
    mutateAsync: async (): Promise<void> => {
      // For Replit Auth, we simply redirect to the logout endpoint
      window.location.href = '/api/logout';
      
      // This promise never resolves as we redirect away
      return new Promise<void>((resolve) => {
        // This is just a placeholder since we redirect before resolution
        setTimeout(() => {
          resolve();
        }, 1000);
      });
    }
  };

  // Login function wrapper
  const login = async (credentials: LoginCredentials): Promise<User> => {
    return await loginMutation.mutateAsync(credentials);
  };

  // Logout function wrapper
  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  // Auth check function wrapper that returns the user (or null) - Updated for Replit Auth
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
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        fullName: data.user.fullName,
        profileImageUrl: data.user.profileImageUrl,
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

  // Refresh user function - Updated for Replit Auth
  const refreshUser = async (): Promise<void> => {
    await refetchAuth();
    // Force a revalidation of the auth query using the new endpoint
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
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
        refreshUser,
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
