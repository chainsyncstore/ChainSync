import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    userRole: string;
    storeId?: number;
    fullName: string;
  }
}

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized: Please log in' });
  }
  
  next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  
  next();
};

export const isManagerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId || (req.session.userRole !== 'manager' && req.session.userRole !== 'admin')) {
    return res.status(403).json({ message: 'Forbidden: Manager or admin access required' });
  }
  
  next();
};

export const hasStoreAccess = (storeIdParam = 'storeId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Unauthorized: Please log in' });
    }
    
    const storeId = parseInt(req.params[storeIdParam] || req.body[storeIdParam]);
    
    // Admins have access to all stores
    if (req.session.userRole === 'admin') {
      return next();
    }
    
    // Managers and cashiers can only access their assigned store
    if (req.session.storeId !== storeId) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this store' });
    }
    
    next();
  };
};

export const validateSession = async (req: Request, res: Response, next: NextFunction) => {
  console.log(`Validating session for ${req.path} with session ID:`, req.sessionID);
  console.log('Session data:', req.session);
  console.log('Cookies received:', req.headers.cookie);
  
  if (req.session.userId) {
    try {
      console.log(`User ID found in session: ${req.session.userId}, validating user exists...`);
      // Verify user still exists and is valid
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, req.session.userId)
      });
      
      if (!user) {
        console.log(`No user found for ID: ${req.session.userId}, destroying session`);
        // User no longer exists, destroy session
        req.session.destroy((err) => {
          if (err) console.error('Error destroying session:', err);
          else console.log('Session destroyed successfully');
        });
        
        if (req.path.startsWith('/api/auth/me')) {
          return next(); // Continue to auth/me handler for proper error response
        }
        
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }
      console.log(`User validated successfully: ${user.username} (${user.role})`);
    } catch (error) {
      console.error('Error validating session:', error);
    }
  } else {
    console.log('No userId in session, authentication will be required for protected routes');
  }
  
  next();
};
