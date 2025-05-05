import { Request, Response, NextFunction } from 'express';
import { db } from '@db';
import * as schema from '@shared/schema';
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
  if (req.session.userId) {
    try {
      // Verify user still exists and is valid
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, req.session.userId)
      });
      
      if (!user) {
        // User no longer exists, destroy session
        req.session.destroy((err) => {
          if (err) console.error('Error destroying session:', err);
        });
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }
    } catch (error) {
      console.error('Error validating session:', error);
    }
  }
  
  next();
};
