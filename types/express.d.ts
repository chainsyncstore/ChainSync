import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        storeId?: number;
        name: string;
        email?: string;
        sessionId?: string;
        permissions?: string[];
        [key: string]: any; // Allow additional properties
      };
      // Add CSRF token property
      csrfToken?: () => string;
    }
  }
}
