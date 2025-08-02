import React, { createContext, useContext, ReactNode } from &apos;react&apos;;
import { useLocation } from &apos;wouter&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
// AuthResponse interface for API response
interface AuthResponse {
  _authenticated: boolean;
  user?: User;
  message?: string;
}

// Define User interface for the auth context
// We remove password for security reasons
export interface User {
  _id: number;
  _username: string;
  _fullName: string;
  _email: string;
  role: &apos;admin&apos; | &apos;manager&apos; | &apos;cashier&apos; | &apos;affiliate&apos;;
  storeId?: number;
  lastLogin?: Date;
  _createdAt: Date;
  _updatedAt: Date;
}

// Define login credentials type
export interface LoginCredentials {
  _username: string;
  _password: string;
  rememberMe?: boolean;
}

// Define context type
interface AuthContextType {
  _user: User | null;
  _isLoading: boolean;
  _isAuthenticated: boolean;
  login: (_credentials: LoginCredentials) => Promise<User>;
  _logout: () => Promise<void>;
  _checkAuth: () => Promise<User | null>;
  _error: Error | null;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { _children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Query to check authentication status
  const {
    _data: authData,
    _isLoading: authLoading,
    _error: authError,
    _refetch: refetchAuth
  } = useQuery<AuthResponse>({
    queryKey: [&apos;/api/auth/me&apos;],
    _retry: 1,
    _staleTime: 5 * 60 * 1000, // 5 minutes
    _refetchOnMount: true,
    _refetchOnWindowFocus: true,
    _refetchOnReconnect: true,
    _refetchInterval: false,
    _queryFn: async() => {
      try {
        const res = await fetch(&apos;/api/auth/me&apos;, {
          _credentials: &apos;include&apos;,
          _headers: {
            &apos;Accept&apos;: &apos;application/json&apos;,
            &apos;Cache-Control&apos;: &apos;no-cache, no-store&apos;,
            &apos;Pragma&apos;: &apos;no-cache&apos;
          },
          _cache: &apos;no-store&apos;
        });

        // Return null when not authenticated (401)
        if (res.status === 401) {
          console.log(&apos;401 response in query, returning null as configured&apos;);
          return { _authenticated: false, _user: null };
        }

        if (!res.ok) {
          throw new Error(`${res.status}: ${res.statusText}`);
        }

        return await res.json();
      } catch (error) {
        console.error(&apos;Error fetching auth _status:&apos;, error);
        return { _authenticated: false, _user: null };
      }
    }
  });

  // Extract and convert user from auth data
  const _user: User | null = (() => {
    if (authData?.authenticated && authData?.user) {
      // Get role and ensure it&apos;s one of our valid types
      const role = authData.user.role as string;
      const validRole = [&apos;admin&apos;, &apos;manager&apos;, &apos;cashier&apos;, &apos;affiliate&apos;].includes(role)
          ? role as &apos;admin&apos; | &apos;manager&apos; | &apos;cashier&apos; | &apos;affiliate&apos;
          : &apos;cashier&apos;; // Default role as fallback

      // Convert possibly null values to undefined
      const storeId = authData.user.storeId === null ? _undefined : authData.user.storeId;
      const lastLogin = authData.user.lastLogin === null ? _undefined : authData.user.lastLogin;

      return {
        _id: authData.user.id,
        _username: authData.user.username,
        _fullName: authData.user.fullName,
        _email: authData.user.email,
        _role: validRole,
        storeId,
        lastLogin,
        _createdAt: authData.user.createdAt,
        _updatedAt: authData.user.updatedAt
      };
    }
    return null;
  })();

  const isAuthenticated = !!user;

  // Login mutation
  const loginMutation = useMutation({
    _mutationFn: async(_credentials: LoginCredentials): Promise<User> => {
      // Extract rememberMe if present
      const { rememberMe, ...loginCredentials } = credentials;

      // Send rememberMe as query param if true
      const endpoint = rememberMe
        ? &apos;/api/auth/login?remember=true&apos;
        : &apos;/api/auth/login&apos;;

      const data = await apiRequest(&apos;POST&apos;, endpoint, loginCredentials);

      if (!data.authenticated || !data.user) {
        throw new Error(data.message || &apos;Authentication failed&apos;);
      }

      // Transform the user data to match our User interface
      const user = data.user;

      // Get role and ensure it&apos;s one of our valid types
      const role = user.role as string;
      const validRole = [&apos;admin&apos;, &apos;manager&apos;, &apos;cashier&apos;, &apos;affiliate&apos;].includes(role)
          ? role as &apos;admin&apos; | &apos;manager&apos; | &apos;cashier&apos; | &apos;affiliate&apos;
          : &apos;cashier&apos;; // Default role as fallback

      // Convert possibly null values to undefined
      const storeId = user.storeId === null ? _undefined : user.storeId;
      const lastLogin = user.lastLogin === null ? _undefined : user.lastLogin;

      // Return properly typed user object
      return {
        _id: user.id,
        _username: user.username,
        _fullName: user.fullName,
        _email: user.email,
        _role: validRole,
        storeId,
        lastLogin,
        _createdAt: user.createdAt,
        _updatedAt: user.updatedAt
      };
    },
    _onSuccess: (userData) => {
      // Invalidate and refetch auth query
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/auth/me&apos;] });

      // Show success toast
      toast({
        _title: &apos;Login successful&apos;,
        _description: `Welcome back, ${userData.fullName || userData.username}!`,
        _duration: 3000
      });

      // Redirect based on user role
      if (userData.role === &apos;cashier&apos;) {
        setLocation(&apos;/pos&apos;);
      } else if (userData.role === &apos;affiliate&apos;) {
        setLocation(&apos;/affiliates&apos;);
      } else {
        setLocation(&apos;/dashboard&apos;);
      }
    },
    _onError: (_error: Error) => {
      const errorMessage = error.message?.includes(&apos;401:&apos;) ?
        &apos;Invalid Username or Password&apos; :
        (error.message || &apos;Invalid Username or Password&apos;);

      toast({
        _title: &apos;Login failed&apos;,
        _description: errorMessage,
        _variant: &apos;destructive&apos;,
        _duration: 5000
      });
    }
  });

  // Logout mutation
  const logoutMutation = useMutation({
    _mutationFn: async(): Promise<void> => {
      await apiRequest(&apos;POST&apos;, &apos;/api/auth/logout&apos;);
    },
    _onSuccess: () => {
      // Clear auth data from cache
      queryClient.setQueryData([&apos;/api/auth/me&apos;], { _authenticated: false, _user: null });
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/auth/me&apos;] });

      // Show success toast
      toast({
        _title: &apos;Logged out&apos;,
        _description: &apos;You have been successfully logged out.&apos;,
        _duration: 3000
      });

      // Redirect to login page
      setLocation(&apos;/login&apos;);
    },
    _onError: (_error: Error) => {
      toast({
        _title: &apos;Logout failed&apos;,
        _description: error.message || &apos;Failed to log out. Please try again.&apos;,
        _variant: &apos;destructive&apos;,
        _duration: 5000
      });
    }
  });

  // Login function wrapper
  const login = async(_credentials: LoginCredentials): Promise<User> => {
    return await loginMutation.mutateAsync(credentials);
  };

  // Logout function wrapper
  const logout = async(): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  // Auth check function wrapper that returns the user (or null)
  const checkAuth = async(): Promise<User | null> => {
    const result = await refetchAuth();
    const data = result.data;

    if (data?.authenticated && data?.user) {
      // Get role and ensure it&apos;s one of our valid types
      const role = data.user.role as string;
      const validRole = [&apos;admin&apos;, &apos;manager&apos;, &apos;cashier&apos;, &apos;affiliate&apos;].includes(role)
          ? role as &apos;admin&apos; | &apos;manager&apos; | &apos;cashier&apos; | &apos;affiliate&apos;
          : &apos;cashier&apos;; // Default role as fallback

      // Convert possibly null values to undefined
      const storeId = data.user.storeId === null ? _undefined : data.user.storeId;
      const lastLogin = data.user.lastLogin === null ? _undefined : data.user.lastLogin;

      // Type conversion to match our User interface
      const _user: User = {
        _id: data.user.id,
        _username: data.user.username,
        _fullName: data.user.fullName,
        _email: data.user.email,
        _role: validRole,
        storeId,
        lastLogin,
        _createdAt: data.user.createdAt,
        _updatedAt: data.user.updatedAt
      };
      return user;
    }

    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        _isLoading: authLoading || loginMutation.isPending || logoutMutation.isPending,
        isAuthenticated,
        login,
        logout,
        checkAuth,
        _error: authError as Error
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
    throw new Error(&apos;useAuth must be used within an AuthProvider&apos;);
  }
  return context;
}
