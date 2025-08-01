import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userRole?: string;
    storeId?: number;
    fullName?: string;
    email?: string;
    isAuthenticated?: boolean;
  }
} 