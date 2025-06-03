import express, { Application } from 'express';
import { env } from './config/env';
// SessionOptions is imported again later, remove one instance
// import { SessionOptions } from 'express-session'; 
// import { Pool } from 'pg'; // Removed duplicate
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { logger } from './services/logger';
import { FileUploadMiddleware } from './middleware/file-upload';
// AuthMiddleware import needs review based on actual exports from './middleware/auth'
// import { AuthMiddleware } from './middleware/auth';
const fileUploadInstance = FileUploadMiddleware.getInstance(); // Get instance
import { rateLimitMiddleware, authRateLimiter, sensitiveOpRateLimiter } from './middleware/rate-limiter'; // Updated import
import { securityHeaders, nonceGenerator } from './middleware/security';
import { inputSanitization } from './middleware/input-sanitization';
import { errorHandler } from './middleware/error-handler'; // Corrected import
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
// import { socketHandler } from './socket/socket-handler'; // Module not found, commented out
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { Pool } from 'pg'; // Keep one import of Pool
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ZodError } from 'zod-validation-error';
import { storage } from './storage';
import * as schema from '../shared/schema';
import { isAuthenticated, isAdmin, isManagerOrAdmin, hasStoreAccess, validateSession } from './middleware/auth';
import { getAIResponse } from './services/ai';
import multer from 'multer';
import path from 'path';
import * as affiliateService from './services/affiliate';
import * as webhookService from './services/webhook';
import * as paymentService from './services/payment';
// Changed import for loyaltyService to import the class
import { LoyaltyService as LoyaltyServiceClass } from './services/loyalty'; 
import * as analyticsService from './services/analytics';
import { processImportFile, applyColumnMapping, validateLoyaltyData, validateInventoryData, importLoyaltyData, importInventoryData, generateErrorReport, BatchImportRow } from './services/import-enhanced';
import { validateProductImportCSV, importProducts } from './services/product-import';
import { Request, Response, NextFunction } from 'express';
import { SessionOptions } from 'express-session';
// import { NeonDatabase } from '@neondatabase/serverless'; // Unused import
import { App, Middleware, RouteHandler } from './types/app'; // Removed EnvConfig
import { Database } from './types/index';
import { UserPayload } from './types/user'; // Assuming UserPayload is defined here

// Re-export env for type safety
export const envConfig = env;

export async function registerRoutes(app: Application): Promise<Server> {
  // Import the setupSecureServer to return either HTTP or HTTPS server based on environment
  const { setupSecureServer } = await import('./config/https');
  const PostgresStore = pgSession(session);

  // Instantiate LoyaltyService
  const loyaltyServiceInstance = new LoyaltyServiceClass((db as any).pool as Pool);
  
  // Set up session middleware
  const sessionConfig: SessionOptions = {
    store: new PostgresStore({
      pool: (db as unknown as { pool: Pool }).pool,
      createTableIfMissing: true,
      tableName: 'sessions'
    }),
    secret: env.SESSION_SECRET as string,
    name: env.SESSION_COOKIE_NAME,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 86400000,
      sameSite: 'lax'
    }
  } as const;

  // Add security middleware
  app.use(nonceGenerator as any); // Generate nonce for CSP
  app.use(securityHeaders as any); // Apply security headers including CSP
  
  // Standard middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session(sessionConfig));
  
  // Input sanitization middleware
  app.use(inputSanitization() as any);

  app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Welcome to ChainSync API' });
  }); 

  // Auth routes
  // These need to be updated based on actual exports from auth middleware
  // app.post('/auth/login', AuthMiddleware.login as Middleware);
  // app.post('/auth/register', AuthMiddleware.register as Middleware);
  // app.post('/auth/refresh', AuthMiddleware.refreshToken as Middleware);

// Protected routes
// app.use(AuthMiddleware.protect); // This needs to be reviewed

// File upload routes
app.post('/upload', fileUploadInstance.uploadFile.bind(fileUploadInstance) as express.RequestHandler); 
app.get('/upload/progress/:id', fileUploadInstance.getProgress.bind(fileUploadInstance) as express.RequestHandler);
app.post('/upload/subscribe/:id', fileUploadInstance.subscribeToProgress.bind(fileUploadInstance) as express.RequestHandler);

// Store routes
app.post('/stores', rateLimitMiddleware as any, (req: Request, res: Response, next: NextFunction) => { 
  // Store creation logic
  next();
}); 

// Product routes
app.post('/products', rateLimitMiddleware as any, (req: Request, res: Response, next: NextFunction) => { 
  // Product creation logic
  next();
}); 

// Inventory routes
app.post('/inventory', rateLimitMiddleware as any, (req: Request, res: Response, next: NextFunction) => { 
  // Inventory management logic
  next();
}); 

// Transaction routes
app.post('/transactions', sensitiveOpRateLimiter as any, (req: Request, res: Response, next: NextFunction) => { 
  // Transaction processing logic
  next();
}); 

// Customer routes
app.post('/customers', rateLimitMiddleware as any, (req: Request, res: Response, next: NextFunction) => { 
  // Customer management logic
  next();
}); 
  
  // Apply session validation middleware
  app.use(validateSession as any);
  
  // Loyalty API Routes
  app.get('/api/loyalty/members', isAuthenticated as any, hasStoreAccess as any, async (req: Request, res: Response) => {
    try {
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : ((req.session as any).storeId || 0);
      
      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }
      
      const customers = await db.query.customers.findMany({
        where: eq((schema.customers as any).storeId, storeId),
        with: {
          loyaltyMembers: {
            with: {
              tier: true
            }
          }
        }
      });
      
      const members = customers
        .filter(customer => (customer as any).loyaltyMembers && (customer as any).loyaltyMembers.length > 0)
        .map(customer => {
          const member = (customer as any).loyaltyMembers[0];
          return {
            id: (member as any).id,
            customerId: (customer as any).id,
            loyaltyId: (member as any).loyaltyId,
            currentPoints: (member as any).currentPoints,
            totalPointsEarned: (member as any).totalPointsEarned,
            totalPointsRedeemed: (member as any).totalPointsRedeemed,
            enrollmentDate: (member as any).enrollmentDate,
            lastActivity: (member as any).lastActivity,
            customer: {
              id: (customer as any).id,
              fullName: (customer as any).fullName,
              email: (customer as any).email,
              phone: (customer as any).phone
            },
            tier: (member as any).tier
          };
        });
      
      res.json(members);
    } catch (error: unknown) {
      console.error("Error fetching loyalty members:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/member/:id', isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.id);
      const member = await loyaltyServiceInstance.getLoyaltyMember(memberId);
      
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      res.json(member);
    } catch (error: unknown) {
      console.error("Error fetching member details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/member/:id/activity', isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.id);
      const activity = await loyaltyServiceInstance.getMemberActivityHistory(memberId);
      
      res.json(activity);
    } catch (error: unknown) {
      console.error("Error fetching member activity:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/member/:id/rewards', isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.id);
      const rewards = await loyaltyServiceInstance.getAvailableRewards(memberId);
      
      res.json(rewards);
    } catch (error: unknown) {
      console.error("Error fetching available rewards:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/program/:storeId', isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const program = await loyaltyServiceInstance.getLoyaltyProgram(storeId);
      
      if (!program) {
        return res.status(404).json({ message: "Loyalty program not found" });
      }
      
      res.json(program);
    } catch (error: unknown) {
      console.error("Error fetching loyalty program:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/enroll', isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { customerId } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      
      const customer = await db.query.customers.findFirst({
        where: eq(schema.customers.id, customerId)
      });
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      if (!(customer as any).storeId) {
        return res.status(400).json({ message: "Customer is not associated with a store" });
      }
      
      const member = await loyaltyServiceInstance.createLoyaltyMember({customerId, storeId: (customer as any).storeId, userId: (req.session as any).userId as number});
      
      res.json(member);
    } catch (error: unknown) {
      console.error("Error enrolling customer:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/program/:storeId', isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const programData = req.body;
      
      if (!hasStoreAccess((req.session as any), storeId)) {
        return res.status(403).json({ message: 'Access denied to this store' });
      }

      const validatedData = (schema as any).loyaltyProgramsInsertSchema.parse(programData);
      
      const program = await loyaltyServiceInstance.createOrUpdateProgram(storeId, validatedData);
      
      res.json(program);
    } catch (error: unknown) {
      console.error("Error creating/updating loyalty program:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/reward', isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const rewardData = req.body;
      
      const reward = await db.insert(schema.loyaltyRewards)
        .values({
          ...rewardData,
          active: rewardData.active !== undefined ? rewardData.active : true
        })
        .returning();
      
      res.json(reward[0]);
    } catch (error: unknown) {
      console.error("Error creating loyalty reward:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/tier', isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const tierData = req.body;
      
      const tier = await loyaltyServiceInstance.createLoyaltyTier(tierData);
      
      res.json(tier);
    } catch (error: unknown) {
      console.error("Error creating loyalty tier:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/redeem', isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { memberId, rewardId, transactionId } = req.body;
      
      if (!memberId || !rewardId || !transactionId) {
        return res.status(400).json({ message: "Member ID, reward ID, and transaction ID are required" });
      }
      
      const result = await loyaltyServiceInstance.applyReward(
        memberId,
        rewardId,
        transactionId,
        (req.session as any).userId as number
      );
      
      if (!result.success) {
        return res.status(400).json({ message: result.message || "Failed to apply reward" });
      }
      
      res.json(result);
    } catch (error: unknown) {
      console.error("Error redeeming reward:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Define API routes
  const apiPrefix = "/api";
  
  // Authentication endpoints
  
  app.get(`${apiPrefix}/auth/debug-login`, async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    try {
      const username = "admin";
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "Debug user not found" });
      }
      
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err); else resolve();
        });
      });
      
      (req.session as any).userId = user.id;
      (req.session as any).userRole = (user as any).role;
      (req.session as any).storeId = (user as any).storeId || undefined;
      (req.session as any).fullName = (user as any).fullName || '';
      
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err); else resolve();
        });
      });
      
      const userData = {
        id: user.id,
        username: user.username,
        fullName: (user as any).fullName,
        email: user.email,
        role: (user as any).role,
        storeId: (user as any).storeId
      };
      
      return res.status(200).json({ message: "Debug login successful", user: userData });
    } catch (error: unknown) {
      console.error("Debug login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${apiPrefix}/auth/me`, async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    if (!(req.session as any) || typeof (req.session as any).userId === 'undefined') {
      return res.status(401).json({ authenticated: false, message: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById((req.session as any).userId as number);
      
      if (!user) {
        req.session.destroy((err) => { if (err) console.error("Error destroying invalid session:", err); });
        return res.status(401).json({ authenticated: false, message: "User not found" });
      }
      
      return res.status(200).json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: (user as any).fullName,
          email: user.email,
          role: (user as any).role,
          storeId: (user as any).storeId
        }
      });
    } catch (error: unknown) {
      console.error("Auth check error:", error);
      return res.status(500).json({ authenticated: false, message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/auth/login`, async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    try {
      const loginData = (schema as any).loginSchema.parse(req.body);
      const user = await storage.validateUserCredentials(loginData.username, loginData.password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      await storage.updateUserLastLogin(user.id);
      
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => { if (err) reject(err); else resolve(); });
      });
      
      (req.session as any).userId = user.id;
      (req.session as any).userRole = (user as any).role;
      (req.session as any).storeId = (user as any).storeId || undefined;
      (req.session as any).fullName = (user as any).fullName || '';
      
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => { if (err) reject(err); else resolve(); });
      });
      
      const userData = {
        id: user.id,
        username: user.username,
        fullName: (user as any).fullName,
        email: user.email,
        role: (user as any).role,
        storeId: (user as any).storeId,
      };
      
      return res.status(200).json(userData);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/auth/register`, async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    try {
      const userData = schema.usersInsertSchema.parse(req.body); // Use usersInsertSchema
      
      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return res.status(409).json({ authenticated: false, message: "Username already exists" });
      }
      
      if (userData.email) {
        const existingUserByEmail = await storage.getUserByEmail(userData.email);
        if (existingUserByEmail) {
          return res.status(409).json({ authenticated: false, message: "Email already in use" });
        }
      }
      
      const newUser = await storage.createUser(userData);
      
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => { if (err) reject(err); else resolve(); });
      });
      
      (req.session as any).userId = newUser.id;
      (req.session as any).userRole = (newUser as any).role;
      (req.session as any).storeId = (newUser as any).storeId || undefined;
      (req.session as any).fullName = (newUser as any).fullName || '';
      
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => { if (err) reject(err); else resolve(); });
      });
      
      return res.status(201).json({
        authenticated: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: (newUser as any).fullName,
          email: newUser.email,
          role: (newUser as any).role,
          storeId: (newUser as any).storeId,
          lastLogin: (newUser as any).lastLogin,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt
        }
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ authenticated: false, message: "Validation error", errors: error.errors });
      }
      console.error("Registration error:", error);
      return res.status(500).json({ authenticated: false, message: "Failed to create account" });
    }
  });
  
  app.post(`${apiPrefix}/auth/logout`, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie(env.SESSION_COOKIE_NAME); // Use env variable
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });
  
  app.post(`${apiPrefix}/auth/forgot-password`, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: "Email is required" });
      
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(200).json({ success: true, message: "If a user with that email exists, a password reset link has been sent" });
      
      const resetToken = await storage.createPasswordResetToken(user.id);
      const { sendPasswordResetEmail } = await import('./services/email');
      const emailSent = await sendPasswordResetEmail(user.email, resetToken.token, user.username);
      
      if (!emailSent) {
        console.error(`Failed to send password reset email to ${user.email}`);
        return res.status(500).json({ success: false, message: "Failed to send password reset email. Please try again later." });
      }
      return res.status(200).json({ success: true, message: "Password reset email sent successfully" });
    } catch (error: unknown) {
      console.error("Password reset request error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/auth/validate-reset-token/:token`, async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      if (!token) return res.status(400).json({ valid: false, message: "Token is required" });
      const isValid = await storage.isPasswordResetTokenValid(token);
      return res.status(200).json({ valid: isValid, message: isValid ? "Token is valid" : "Token is invalid or expired" });
    } catch (error: unknown) {
      console.error("Token validation error:", error);
      return res.status(500).json({ valid: false, message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/auth/reset-password`, async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ success: false, message: "Token and password are required" });
      
      const isValid = await storage.isPasswordResetTokenValid(token);
      if (!isValid) return res.status(400).json({ success: false, message: "Invalid or expired token" });
      
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) return res.status(400).json({ success: false, message: "Invalid token" });
      
      await storage.updateUser(resetToken.userId, { password });
      await storage.markPasswordResetTokenAsUsed(token);
      
      return res.status(200).json({ success: true, message: "Password reset successful. You can now login with your new password." });
    } catch (error: unknown) {
      console.error("Password reset error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
  
  if (process.env.NODE_ENV !== 'production') {
    app.get(`${apiPrefix}/test/email`, async (req: Request, res: Response) => {
      try {
        const { sendEmail, verifyEmailConnection } = await import('./services/email');
        const isConnected = await verifyEmailConnection();
        if (!isConnected) return res.status(500).json({ success: false, message: "Email connection failed." });
        
        const result = await sendEmail({
          to: process.env.EMAIL_USER || '',
          subject: "ChainSync Test Email",
          text: "This is a test email from ChainSync.",
          html: `<p>This is a test email from ChainSync.</p>`
        });
        if (result) return res.status(200).json({ success: true, message: `Test email sent to ${process.env.EMAIL_USER}` });
        return res.status(500).json({ success: false, message: "Failed to send test email" });
      } catch (error: unknown) {
        console.error("Test email error:", error);
        return res.status(500).json({ success: false, message: `Error: ${(error as Error).message}` });
      }
    });
  }

  // ----------- Dashboard Routes -----------
  
  app.get(`${apiPrefix}/dashboard/quick-stats`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId, userRole } = (req.session as any);
      const isAdminUser = userRole === 'admin';
      if (!isAdminUser && !storeId) return res.status(403).json({ message: "Access forbidden - no store assigned" });
      
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      
      const todaySalesData = await storage.getDailySalesData(storeId, 1);
      const todaySalesTotal = todaySalesData.reduce((sum, data) => sum + Number(data.totalSales), 0);
      const todayTransactions = todaySalesData.reduce((sum, data) => sum + Number(data.transactionCount), 0);
      
      const yesterdaySalesData = await storage.getDailySalesData(storeId, 2);
      const yesterdaySalesFiltered = yesterdaySalesData.filter(data => data.date && new Date(data.date).getDate() === yesterday.getDate());
      const yesterdaySalesTotal = yesterdaySalesFiltered.reduce((sum, data) => sum + Number(data.totalSales), 0);
      const yesterdayTransactions = yesterdaySalesFiltered.reduce((sum, data) => sum + Number(data.transactionCount), 0);
      
      const salesPercentChange = yesterdaySalesTotal > 0 ? ((todaySalesTotal - yesterdaySalesTotal) / yesterdaySalesTotal) * 100 : (todaySalesTotal > 0 ? 100 : 0);
      const transactionsPercentChange = yesterdayTransactions > 0 ? ((todayTransactions - yesterdayTransactions) / yesterdayTransactions) * 100 : (todayTransactions > 0 ? 100 : 0);
      
      const lowStockCount = await storage.getLowStockCount(storeId);
      const stores = await storage.getAllStores();
      const activeStores = stores.filter(store => (store as any).isActive);
      
      return res.status(200).json({
        salesTotal: todaySalesTotal.toFixed(2),
        salesChange: salesPercentChange.toFixed(1),
        transactionsCount: todayTransactions,
        transactionsChange: transactionsPercentChange.toFixed(1),
        lowStockCount,
        lowStockChange: 0, // Placeholder
        activeStoresCount: activeStores.length,
        totalStoresCount: stores.length
      });
    } catch (error: unknown) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/dashboard/store-performance`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const { userRole, storeId } = (req.session as any);
      
      if (userRole !== 'admin' && storeId) {
        const storeData = await storage.getDailySalesData(storeId, days);
        const storeInfo = await storage.getStoreById(storeId);
        if (!storeInfo) return res.status(404).json({ message: "Store not found" });
        const singleStorePerformance = [{
          storeId: storeInfo.id,
          storeName: storeInfo.name,
          totalSales: storeData.reduce((sum, day) => sum + parseFloat(String(day.totalSales)), 0).toFixed(2),
          transactionCount: storeData.reduce((sum, day) => sum + (Number(day.transactionCount) || 0), 0)
        }];
        return res.status(200).json({ storeComparison: singleStorePerformance, dailySales: storeData });
      }
      
      const storePerformance = await storage.getStoreSalesComparison(days);
      const dailySales = await storage.getDailySalesData(undefined, days);
      return res.status(200).json({ storeComparison: storePerformance, dailySales });
    } catch (error: unknown) {
      console.error("Store performance error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/dashboard/recent-transactions`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId, userRole } = (req.session as any);
      const limit = parseInt(req.query.limit as string) || 5;
      const targetStoreId = userRole !== 'admin' ? storeId : undefined;
      const transactions = await (storage as any).getRecentTransactions(targetStoreId, limit);
      return res.status(200).json(transactions);
    } catch (error: unknown) {
      console.error("Recent transactions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/analytics/store-performance`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId: sessionStoreId, userRole } = (req.session as any);
      let startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      let endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      if (endDate) endDate.setHours(23, 59, 59, 999);

      const stores = await storage.getAllStores();
      const filteredStores = userRole !== 'admin' && sessionStoreId 
        ? stores.filter(store => store.id === sessionStoreId)
        : stores;
      
      const storePerformanceData = await Promise.all(
        filteredStores.map(async (store) => {
          const transactionsResult = await storage.getStoreTransactions(store.id, startDate, endDate, 1, 10000); // High limit
          const transactions = (transactionsResult as any).data || [];
          const totalRevenue = transactions.reduce((sum: number, t: any) => sum + parseFloat(t.total.toString()), 0);
          const transactionCount = transactions.length;
          const averageTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0;
          const topProductsRaw = await (storage as any).getSalesTrends(store.id, startDate, endDate);
          const topProducts = (topProductsRaw as any[] || []).slice(0, 5).map((p: any) => ({
            productId: p.productId,
            productName: p.productName || 'Unknown Product',
            quantity: parseInt(p.quantity?.toString() || '0'),
            total: parseFloat(p.total?.toString() || '0')
          }));
          return { ...store, metrics: { totalRevenue, averageTransaction, transactionCount }, topProducts };
        })
      );
      
      const globalMetrics = storePerformanceData.reduce((acc, store) => {
        acc.totalRevenue += store.metrics.totalRevenue;
        acc.transactionCount += store.metrics.transactionCount;
        return acc;
      }, { totalRevenue: 0, transactionCount: 0, averageTransaction: 0 });
      if (globalMetrics.transactionCount > 0) globalMetrics.averageTransaction = globalMetrics.totalRevenue / globalMetrics.transactionCount;
      
      const dateRangeDescription = analyticsService.getDateRangeDescription(startDate, endDate);
      return res.status(200).json({ storePerformance: storePerformanceData, globalMetrics, dateRangeDescription });
    } catch (error: unknown) {
      console.error('Store performance comparison error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get(`${apiPrefix}/analytics/sales-trends`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId: sessionStoreId, userRole } = (req.session as any);
      const { startDate: startDateStr, endDate: endDateStr, groupBy = 'day', store: queryStoreId } = req.query;
      
      let targetStoreId = userRole !== 'admin' ? sessionStoreId : (queryStoreId ? parseInt(queryStoreId as string) : undefined);
      let parsedStartDate = startDateStr ? new Date(startDateStr as string) : undefined;
      let parsedEndDate = endDateStr ? new Date(endDateStr as string) : undefined;
      if (parsedEndDate) parsedEndDate.setHours(23, 59, 59, 999);
      
      const validGroupBy = ['day', 'week', 'month'].includes(groupBy as string) ? groupBy as 'day' | 'week' | 'month' : 'day';
      const salesTrends = await analyticsService.getSalesTrendsAnalysis(targetStoreId, parsedStartDate, parsedEndDate, validGroupBy);
      const dateRangeDescription = analyticsService.getDateRangeDescription(parsedStartDate, parsedEndDate);
      
      return res.json({ ...salesTrends, dateRangeDescription });
    } catch (error: unknown) {
      console.error('Sales trends analysis error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ----------- Store Routes -----------
  app.get(`${apiPrefix}/stores`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const stores = await storage.getAllStores();
      return res.status(200).json(stores);
    } catch (error: unknown) {
      console.error("Get stores error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/stores/:storeId`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      if (isNaN(storeId)) return res.status(400).json({ message: "Invalid store ID" });
      const store = await storage.getStoreById(storeId);
      if (!store) return res.status(404).json({ message: "Store not found" });
      return res.status(200).json(store);
    } catch (error: unknown) {
      console.error("Get store error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/stores`, isAdmin as any, async (req: Request, res: Response) => {
    try {
      const storeData = schema.storeInsertSchema.parse(req.body);
      const newStore = await storage.createStore(storeData);
      return res.status(201).json(newStore);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("Create store error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.put(`${apiPrefix}/stores/:storeId`, isAdmin as any, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      if (isNaN(storeId)) return res.status(400).json({ message: "Invalid store ID" });
      const storeData = schema.storeInsertSchema.parse(req.body);
      const updatedStore = await storage.updateStore(storeId, storeData);
      if (!updatedStore) return res.status(404).json({ message: "Store not found" });
      return res.status(200).json(updatedStore);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("Update store error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- User Routes -----------
  app.get(`${apiPrefix}/users`, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const { userRole, storeId: sessionStoreId } = (req.session as any);
      let users;
      if (userRole === 'admin') users = await storage.getAllUsers();
      else if (userRole === 'manager' && sessionStoreId) users = await storage.getUsersByStoreId(sessionStoreId);
      else return res.status(403).json({ message: "Forbidden" });
      
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      return res.status(200).json(sanitizedUsers);
    } catch (error: unknown) {
      console.error("Get users error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/users`, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const { userRole: sessionUserRole, storeId: sessionStoreId } = (req.session as any);
      const userData = schema.usersInsertSchema.parse(req.body); // Use usersInsertSchema
      
      if (sessionUserRole === 'manager') {
        if (userData.role === 'admin') return res.status(403).json({ message: "Managers cannot create admin users" });
        if (userData.storeId !== sessionStoreId) return res.status(403).json({ message: "Managers can only create users for their own store" });
      }
      
      const newUser = await storage.createUser(userData);
      const { password, ...sanitizedUser } = newUser as any; // Cast newUser
      return res.status(201).json(sanitizedUser);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("Create user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Inventory Routes -----------
  app.get(`${apiPrefix}/inventory`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId: sessionStoreId, userRole } = (req.session as any);
      const requestedStoreId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      const targetStoreId = userRole === 'admin' && requestedStoreId ? requestedStoreId : sessionStoreId;
      if (!targetStoreId) return res.status(400).json({ message: "Store ID is required" });
      const inventory = await storage.getInventoryByStoreId(targetStoreId);
      return res.status(200).json(inventory);
    } catch (error: unknown) {
      console.error("Get inventory error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/inventory/low-stock`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId: sessionStoreId, userRole } = (req.session as any);
      const targetStoreId = userRole === 'admin' ? (req.query.storeId ? parseInt(req.query.storeId as string) : undefined) : sessionStoreId;
      const lowStockItems = await storage.getLowStockItems(targetStoreId);
      return res.status(200).json(lowStockItems);
    } catch (error: unknown) {
      console.error("Get low stock error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/inventory/expiring`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId: sessionStoreId, userRole } = (req.session as any);
      const targetStoreId = userRole === 'admin' ? (req.query.storeId ? parseInt(req.query.storeId as string) : undefined) : sessionStoreId;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const expiringItems = await storage.getExpiringItems(days, targetStoreId);
      return res.status(200).json(expiringItems);
    } catch (error: unknown) {
      console.error("Get expiring items error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/inventory/expired`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId: sessionStoreId, userRole } = (req.session as any);
      const targetStoreId = userRole === 'admin' ? (req.query.storeId ? parseInt(req.query.storeId as string) : undefined) : sessionStoreId;
      const expiredItems = await storage.getExpiredItems(targetStoreId);
      return res.status(200).json(expiredItems);
    } catch (error: unknown) {
      console.error("Get expired items error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.put(`${apiPrefix}/inventory/:inventoryId`, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const inventoryId = parseInt(req.params.inventoryId);
      if (isNaN(inventoryId)) return res.status(400).json({ message: "Invalid inventory ID" });
      const { quantity, minimumLevel } = req.body;
      if (quantity === undefined && minimumLevel === undefined) return res.status(400).json({ message: "No update data provided" });
      
      const updateData: Partial<schema.InventoryInsert> = {};
      if (quantity !== undefined) {
        if (quantity < 0) return res.status(400).json({ message: "Quantity cannot be negative" });
        updateData.quantity = quantity;
      }
      if (minimumLevel !== undefined) {
        if (minimumLevel < 0) return res.status(400).json({ message: "Minimum level cannot be negative" });
        updateData.minimumLevel = minimumLevel;
      }
      
      const updatedInventory = await storage.updateInventory(inventoryId, updateData);
      if (!updatedInventory) return res.status(404).json({ message: "Inventory item not found" });
      return res.status(200).json(updatedInventory);
    } catch (error: unknown) {
      console.error("Update inventory error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`${apiPrefix}/inventory/minimum-level`, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const { inventoryId, minimumLevel } = req.body;
      if (!inventoryId || inventoryId <= 0) return res.status(400).json({ message: "Invalid inventory ID" });
      if (minimumLevel === undefined || minimumLevel < 0) return res.status(400).json({ message: "Minimum level must be a non-negative number" });
      
      const updatedInventory = await storage.updateInventory(inventoryId, { minimumLevel });
      if (!updatedInventory) return res.status(404).json({ message: "Inventory item not found" });
      return res.status(200).json(updatedInventory);
    } catch (error: unknown) {
      console.error("Update minimum level error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Category Management Routes -----------
  app.get('/api/products/categories', isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const categories = await db.select().from(schema.categories).orderBy(schema.categories.name);
      res.json(categories);
    } catch (error: unknown) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  app.post('/api/products/categories', isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const data = schema.categoryInsertSchema.parse(req.body);
      const [newCategory] = await db.insert(schema.categories).values({ name: data.name, description: data.description || null }).returning();
      res.status(201).json(newCategory);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) res.status(400).json({ message: 'Validation error', errors: error.errors });
      else { console.error('Error creating category:', error); res.status(500).json({ message: 'Failed to create category' }); }
    }
  });

  app.patch('/api/products/categories/:id', isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid category ID' });
      const data = schema.categoryInsertSchema.parse(req.body);
      const [updatedCategory] = await db.update(schema.categories).set({ name: data.name, description: data.description || null, updatedAt: new Date() }).where(eq(schema.categories.id, id)).returning();
      if (!updatedCategory) return res.status(404).json({ message: 'Category not found' });
      res.json(updatedCategory);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) res.status(400).json({ message: 'Validation error', errors: error.errors });
      else { console.error('Error updating category:', error); res.status(500).json({ message: 'Failed to update category' }); }
    }
  });

  app.delete('/api/products/categories/:id', isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid category ID' });
      const products = await db.select({ count: sql`count(*)` }).from(schema.products).where(eq(schema.products.categoryId, id));
      if (products.length > 0 && parseInt(products[0].count.toString()) > 0) return res.status(409).json({ message: 'Cannot delete category used by products', count: products[0].count });
      const [deletedCategory] = await db.delete(schema.categories).where(eq(schema.categories.id, id)).returning();
      if (!deletedCategory) return res.status(404).json({ message: 'Category not found' });
      res.json({ message: 'Category deleted successfully', category: deletedCategory });
    } catch (error: unknown) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });

  // ----------- Product Routes -----------
  app.get(`${apiPrefix}/products`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const products = await storage.getAllProducts();
      return res.status(200).json(products);
    } catch (error: unknown) {
      console.error("Get products error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/products/barcode/:barcode`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { barcode } = req.params;
      const { storeId } = (req.session as any);
      if (!storeId) return res.status(400).json({ error: "Store ID is required in session" });
      const product = await storage.getProductByBarcode(barcode);
      if (!product) return res.status(404).json({ error: "Product not found" });
      const inventory = await storage.getStoreProductInventory(storeId, product.id);
      if (!inventory) return res.status(404).json({ error: "Product not found in current store inventory" });
      const today = new Date();
      if ((inventory as any).expiryDate && new Date((inventory as any).expiryDate) < today) return res.status(400).json({ error: "Product has expired", product, isExpired: true, expiryDate: (inventory as any).expiryDate });
      return res.status(200).json({ product, inventory: { quantity: (inventory as any).quantity, expiryDate: (inventory as any).expiryDate } });
    } catch (error: unknown) {
      console.error("Get product by barcode error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/products/search`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const searchTerm = req.query.q as string;
      const { storeId } = (req.session as any);
      if (!searchTerm) return res.status(400).json({ message: "Search term is required" });
      if (!storeId) return res.status(400).json({ error: "Store ID is required in session" });
      const products = await storage.searchProducts(searchTerm);
      const today = new Date();
      const productsWithInventory = await Promise.all(
        products.map(async (product) => {
          const inventory = await storage.getStoreProductInventory(storeId, product.id);
          if (!inventory) return { ...product, inStock: false, isExpired: false };
          const isExpired = (inventory as any).expiryDate && new Date((inventory as any).expiryDate) < today;
          return { ...product, inStock: (inventory as any).quantity > 0, quantity: (inventory as any).quantity, expiryDate: (inventory as any).expiryDate, isExpired };
        })
      );
      return res.status(200).json(productsWithInventory);
    } catch (error: unknown) {
      console.error("Search products error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- POS Routes -----------
  app.post(`${apiPrefix}/pos/cashier-sessions/start`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { storeId, notes } = req.body;
      if (!storeId) return res.status(400).json({ message: "Store ID is required" });
      const activeSession = await storage.getActiveCashierSession(userId);
      if (activeSession) return res.status(400).json({ message: "You already have an active session", session: activeSession });
      const session = await storage.createCashierSession({ userId, storeId, notes: notes || null, status: "active", transactionCount: 0, totalSales: "0.00" });
      return res.status(201).json(session);
    } catch (error: unknown) {
      console.error("Error starting cashier session:", error);
      return res.status(500).json({ message: "Failed to start cashier session" });
    }
  });
  
  app.post(`${apiPrefix}/pos/cashier-sessions/end`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { sessionId, notes } = req.body;
      if (!sessionId) return res.status(400).json({ message: "Session ID is required" });
      const session = await storage.getCashierSessionById(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.userId !== userId) return res.status(403).json({ message: "You don't have permission to end this session" });
      if (session.status === "closed") return res.status(400).json({ message: "This session is already closed" });
      const updatedSession = await storage.updateCashierSession(sessionId, { endTime: new Date(), status: "closed", notes: notes ? (session.notes ? `${session.notes}\n${notes}` : notes) : session.notes });
      return res.status(200).json(updatedSession);
    } catch (error: unknown) {
      console.error("Error ending cashier session:", error);
      return res.status(500).json({ message: "Failed to end cashier session" });
    }
  });
  
  app.get(`${apiPrefix}/pos/cashier-sessions/active`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const session = await storage.getActiveCashierSession(userId);
      return res.status(200).json({ session });
    } catch (error: unknown) {
      console.error("Error getting active cashier session:", error);
      return res.status(500).json({ message: "Failed to get active cashier session" });
    }
  });
  
  app.get(`${apiPrefix}/pos/cashier-sessions/:id`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const sessionId = parseInt(req.params.id);
      if (isNaN(sessionId)) return res.status(400).json({ message: "Invalid session ID" });
      const session = await storage.getCashierSessionById(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const userRole = (req.session as any).userRole;
      if (session.userId !== userId && userRole !== "admin" && userRole !== "manager") return res.status(403).json({ message: "You don't have permission to view this session" });
      return res.status(200).json(session);
    } catch (error: unknown) {
      console.error("Error getting cashier session:", error);
      return res.status(500).json({ message: "Failed to get cashier session" });
    }
  });
  
  app.get(`${apiPrefix}/pos/cashier-sessions`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const userRole = (req.session as any).userRole;
      let targetUserId = userId;
      if (userRole === "admin" || userRole === "manager") {
        if (req.query.userId) {
          targetUserId = parseInt(req.query.userId as string);
          if (isNaN(targetUserId)) return res.status(400).json({ message: "Invalid user ID" });
        }
      }
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sessions = await storage.getCashierSessionHistory(targetUserId, page, limit);
      return res.status(200).json(sessions);
    } catch (error: unknown) {
      console.error("Error getting cashier session history:", error);
      return res.status(500).json({ message: "Failed to get cashier session history" });
    }
  });
  
  app.post(`${apiPrefix}/pos/transactions`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { storeId, userId } = (req.session as any);
      if (!storeId) return res.status(400).json({ message: "Store ID is required" });
      const { transactionData, items } = req.body;
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Transaction items are required" });
      
      const activeSession = await storage.getActiveCashierSession(userId as number);
      if (!activeSession && !transactionData.isOfflineTransaction) return res.status(400).json({ message: "No active cashier session found." });
      
      let loyaltyMemberId = null;
      if (transactionData.loyaltyId) {
        const loyaltyMember = await storage.getLoyaltyMemberByLoyaltyId(transactionData.loyaltyId);
        if (loyaltyMember) loyaltyMemberId = loyaltyMember.id;
        delete transactionData.loyaltyId;
      }
      
      const validatedTransaction = schema.transactionInsertSchema.parse({ ...transactionData, storeId, cashierId: userId, loyaltyMemberId, total: transactionData.totalAmount.toString() }); // Added total
      const validationErrors = [];
      const validatedItems = [];
      
      for (const item of items as any[]) { // Cast items
        const validatedItem = schema.transactionItemInsertSchema.parse(item);
        const product = await storage.getProductById(item.productId);
        if (!product) { validationErrors.push(`Product ID ${item.productId} not found`); continue; }
        if (!product.barcode) { validationErrors.push(`Product ${product.name} no barcode`); continue; }
        if (parseFloat(product.price.toString()) <= 0) { validationErrors.push(`Product ${product.name} no price`); continue; }
        const inventory = await storage.getStoreProductInventory(storeId, item.productId);
        if (!inventory) { validationErrors.push(`Product ${product.name} not in inventory`); continue; }
        if ((inventory as any).quantity < item.quantity) { validationErrors.push(`Insufficient stock for ${product.name}`); continue; } // Cast inventory
        validatedItems.push(validatedItem);
      }
      
      if (validationErrors.length > 0) return res.status(400).json({ message: "Product validation failed", errors: validationErrors });
      
      const result = await storage.createTransaction(validatedTransaction, validatedItems);
      if (activeSession && !transactionData.isOfflineTransaction) await storage.updateSessionStats(activeSession.id, parseFloat(validatedTransaction.total.toString()));
      
      return res.status(201).json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("Create transaction error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/pos/sync-offline-transactions`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { transactions } = req.body;
      if (!Array.isArray(transactions) || transactions.length === 0) return res.status(400).json({ message: "No transactions to sync" });
      const results = [];
      for (const transaction of transactions as any[]) { // Cast transaction
        try {
          if (transaction.transactionData.loyaltyId) {
            const loyaltyMember = await storage.getLoyaltyMemberByLoyaltyId(transaction.transactionData.loyaltyId);
            if (loyaltyMember) transaction.transactionData.loyaltyMemberId = loyaltyMember.id;
            delete transaction.transactionData.loyaltyId;
          }
          const result = await storage.createTransaction(transaction.transactionData, transaction.items);
          results.push({ success: true, offlineId: transaction.offlineId, onlineId: result.transaction.id });
        } catch (error: unknown) {
          console.error("Error syncing transaction:", error);
          results.push({ success: false, offlineId: transaction.offlineId, error: "Failed to sync transaction" });
        }
      }
      return res.status(200).json({ results });
    } catch (error: unknown) {
      console.error("Sync offline transactions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Notifications Routes -----------
  app.get(`${apiPrefix}/notifications`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { limit = 20, offset = 0, includeRead = false } = req.query;
      const notifications = await storage.getUserNotifications(userId, Number(limit), Number(offset), includeRead === 'true');
      return res.status(200).json({ notifications });
    } catch (error: unknown) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/notifications/count`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const count = await storage.getUnreadNotificationCount(userId);
      return res.status(200).json({ count });
    } catch (error: unknown) {
      console.error("Error counting notifications:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.patch(`${apiPrefix}/notifications/:id/read`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      const notificationId = Number(req.params.id);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      await storage.markNotificationAsRead(notificationId);
      return res.status(200).json({ success: true });
    } catch (error: unknown) {
      console.error("Error marking notification as read:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/notifications/mark-all-read`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      await storage.markAllNotificationsAsRead(userId);
      return res.status(200).json({ success: true });
    } catch (error: unknown) {
      console.error("Error marking all notifications as read:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // ----------- AI Assistant Routes -----------
  app.post(`${apiPrefix}/ai/chat`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Message is required" });
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const aiResponse = await getAIResponse(userId, message);
      return res.status(200).json({ response: aiResponse });
    } catch (error: unknown) {
      console.error("AI chat error:", error);
      return res.status(500).json({ message: "AI service encountered an error" });
    }
  });
  
  // ----------- Webhook Routes -----------
  app.post(`${apiPrefix}/webhooks/paystack`, async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      const rawPayload = JSON.stringify(req.body);
      const success = await webhookService.handlePaystackWebhook(signature, rawPayload);
      if (success) return res.status(200).json({ message: "Webhook processed successfully" });
      return res.status(400).json({ message: "Failed to process webhook" });
    } catch (error: unknown) {
      console.error("Paystack webhook error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/webhooks/flutterwave`, async (req: Request, res: Response) => {
    try {
      const signature = req.headers['verif-hash'] as string;
      const rawPayload = JSON.stringify(req.body);
      const success = await webhookService.handleFlutterwaveWebhook(signature, rawPayload);
      if (success) return res.status(200).json({ message: "Webhook processed successfully" });
      return res.status(400).json({ message: "Failed to process webhook" });
    } catch (error: unknown) {
      console.error("Flutterwave webhook error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // ----------- Affiliate Routes -----------
  app.post(`${apiPrefix}/affiliates/register`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const affiliate = await affiliateService.registerAffiliate(userId, req.body);
      return res.status(201).json(affiliate);
    } catch (error: unknown) {
      console.error("Affiliate registration error:", error);
      return res.status(500).json({ message: "Failed to register as affiliate" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/dashboard`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const stats = await affiliateService.getAffiliateDashboardStats(userId);
      return res.status(200).json(stats);
    } catch (error: unknown) {
      console.error("Affiliate dashboard error:", error);
      if (error instanceof Error && error.message === "User is not an affiliate") return res.status(404).json({ message: "User is not an affiliate" });
      return res.status(500).json({ message: "Failed to get affiliate dashboard" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/referrals`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const referrals = await affiliateService.getAffiliateReferrals(userId);
      return res.status(200).json(referrals);
    } catch (error: unknown) {
      console.error("Affiliate referrals error:", error);
      return res.status(500).json({ message: "Failed to get affiliate referrals" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/payments`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const payments = await affiliateService.getAffiliatePayments(userId);
      return res.status(200).json(payments);
    } catch (error: unknown) {
      console.error("Affiliate payments error:", error);
      return res.status(500).json({ message: "Failed to get affiliate payments" });
    }
  });
  
  app.post(`${apiPrefix}/affiliates/bank-details`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const affiliate = await affiliateService.updateAffiliateBankDetails(userId, req.body);
      if (!affiliate) return res.status(404).json({ message: "User is not an affiliate" });
      return res.status(200).json(affiliate);
    } catch (error: unknown) {
      console.error("Update affiliate bank details error:", error);
      return res.status(500).json({ message: "Failed to update bank details" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/track-click`, async (req: Request, res: Response) => {
    try {
      const { code, source } = req.query as { code: string, source?: string };
      if (!code) return res.status(400).json({ message: "Referral code is required" });
      await affiliateService.trackAffiliateClick(code, source);
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.end(transparentGif);
    } catch (error: unknown) {
      console.error("Track affiliate click error:", error);
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.end(transparentGif);
    }
  });
  
  app.post(`${apiPrefix}/subscriptions/signup`, async (req: Request, res: Response) => {
    try {
      const subscriptionSignupSchema = z.object({
        username: z.string().min(3), email: z.string().email(), password: z.string().min(8),
        fullName: z.string().min(1), plan: z.string().min(1), referralCode: z.string().optional()
      });
      const validatedBody = subscriptionSignupSchema.parse(req.body);
      const { username, password, email, fullName, plan, referralCode } = validatedBody;
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) return res.status(409).json({ message: "Username already exists" });
      
      const userData: schema.UserInsert = { username, password, email, fullName, role: 'admin' };
      const newUser = await storage.createUser(userData);
      
      if (referralCode) await affiliateService.trackReferral(referralCode, newUser.id);
      
      const { password: _, ...userWithoutPassword } = newUser as any;
      return res.status(201).json({ user: userWithoutPassword, referralApplied: !!referralCode });
    } catch (error: unknown) {
      console.error("Subscription signup error:", error);
      return res.status(500).json({ message: "Failed to create subscription" });
    }
  });
  
  // ----------- Payment Routes -----------
  app.post(`${apiPrefix}/payments/initialize`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { email, amount, plan, referralCode, country } = req.body;
      if (!email || !amount || !plan) return res.status(400).json({ message: "Missing required fields" });
      const payment = await paymentService.initializeSubscription(userId, email, parseFloat(amount), (plan as any), referralCode, country);
      return res.status(200).json(payment);
    } catch (error: unknown) {
      console.error("Payment initialization error:", error);
      return res.status(500).json({ message: (error as Error).message || "Failed to initialize payment" });
    }
  });
  
  app.get(`${apiPrefix}/payments/verify/:reference/:provider`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { reference, provider } = req.params;
      if (!reference || !provider) return res.status(400).json({ message: "Missing required parameters" });
      
      if (provider === 'simulation') {
        const status = req.query.status as string || 'success';
        if (status === 'success') {
          const planId = req.query.plan as string || 'basic';
          const amount = parseFloat(req.query.amount as string || '20000');
          const subscription = await paymentService.processSubscriptionPayment(userId, planId, amount, reference, 'simulation');
          return res.status(200).json({ success: true, subscription, message: "Payment simulation successful" });
        }
        return res.status(200).json({ success: false, status: 'failed', message: "Payment simulation failed" });
      }
      
      const verification = await paymentService.verifyPayment(reference, provider);
      if (verification.status === 'success') {
        const planId = verification.metadata?.plan || 'basic';
        const amount = verification.amount;
        const subscription = await paymentService.processSubscriptionPayment(userId, planId, amount, reference, provider);
        return res.status(200).json({ success: true, subscription });
      }
      return res.status(200).json({ success: false, status: verification.status, message: verification.status === 'pending' ? "Payment processing" : "Payment failed" });
    } catch (error: unknown) {
      console.error("Payment verification error:", error);
      return res.status(500).json({ message: (error as Error).message || "Failed to verify payment" });
    }
  });
  
  app.get(`${apiPrefix}/subscriptions/current`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const subscription = await storage.getSubscriptionByUserId(userId);
      if (!subscription) return res.status(404).json({ message: "No active subscription found" });
      return res.status(200).json(subscription);
    } catch (error: unknown) {
      console.error("Get subscription error:", error);
      return res.status(500).json({ message: "Failed to retrieve subscription" });
    }
  });
  
  app.post(`${apiPrefix}/subscriptions/process-payout`, isAdmin as any, async (req: Request, res: Response) => {
    try {
      const { affiliateId } = req.body;
      const payments = await affiliateService.processAffiliatePayout(affiliateId);
      return res.status(200).json(payments);
    } catch (error: unknown) {
      console.error("Process affiliate payout error:", error);
      return res.status(500).json({ message: "Failed to process affiliate payout" });
    }
  });

  app.get(`${apiPrefix}/ai/conversation`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId as number;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const conversation = await (storage as any).getAiConversation(userId) as { messages: Array<{ role: string; content: string }> };
      if (!conversation) {
        const welcomeMessage = "Hello! Welcome to ChainSync AI Assistant. How can I assist you today?";
        await (storage as any).saveAiConversation(userId, [{ role: "assistant", content: welcomeMessage }]);
        return res.status(200).json({ messages: [{ role: "assistant", content: welcomeMessage }] });
      }
      const userMessages = (conversation.messages || []).filter((msg: any) => msg.role !== "system");
      return res.status(200).json({ messages: userMessages });
    } catch (error: unknown) {
      console.error("AI conversation error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${apiPrefix}/returns/reasons`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const reasons = await (storage as any).getAllReturnReasons();
      return res.json(reasons);
    } catch (error: unknown) {
      console.error('Error fetching return reasons:', error);
      return res.status(500).json({ error: 'Failed to fetch return reasons' });
    }
  });

  app.post(`${apiPrefix}/returns/reasons`, isAdmin as any, async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      const reasonData = (schema as any).returnReasonInsertSchema.parse({ name, description, active: true });
      const reason = await (storage as any).createReturnReason(reasonData);
      return res.status(201).json(reason);
    } catch (error: unknown) {
      console.error('Error creating return reason:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Failed to create return reason' });
    }
  });
  
  app.get(`${apiPrefix}/returns/recent`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { limit } = req.query;
      let { storeId } = req.query;
      if ((req.session as any).userRole !== 'admin' && (req.session as any).userRole !== 'manager') storeId = (req.session as any).storeId?.toString();
      if ((req.session as any).userRole === 'manager' && storeId && (req.session as any).storeId !== parseInt(storeId as string)) return res.status(403).json({ error: 'You do not have access to this store' });
      const limitNumber = limit ? parseInt(limit as string) : 5;
      const storeIdNumber = storeId ? parseInt(storeId as string) : undefined;
      const returns = await (storage as any).getRecentReturns(limitNumber, storeIdNumber);
      return res.json(returns);
    } catch (error: unknown) {
      console.error('Error fetching recent returns:', error);
      return res.status(500).json({ error: 'Failed to fetch recent returns' });
    }
  });

  app.get(`${apiPrefix}/returns/:returnId`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { returnId } = req.params;
      let returnData;
      if (!isNaN(parseInt(returnId))) returnData = await (storage as any).getReturnById(parseInt(returnId));
      else returnData = await (storage as any).getReturnByReturnId(returnId);
      if (!returnData) return res.status(404).json({ error: 'Return not found' });
      if ((req.session as any).userRole !== 'admin' && (returnData as any).storeId !== (req.session as any).storeId) return res.status(403).json({ error: 'You do not have access to this return' });
      return res.json(returnData);
    } catch (error: unknown) {
      console.error('Error fetching return:', error);
      return res.status(500).json({ error: 'Failed to fetch return' });
    }
  });

  app.post(`${apiPrefix}/returns`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { originalTransactionId, storeId, customerId, totalRefundAmount, items, notes } = req.body;
      if ((req.session as any).userRole !== 'admin' && (req.session as any).storeId !== storeId) return res.status(403).json({ error: 'You do not have access to this store' });
      const returnId = `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const returnData = (schema as any).returnsInsertSchema.parse({ returnId, originalTransactionId, storeId, processedBy: (req.session as any).userId, customerId, totalRefundAmount, status: 'completed', notes, returnDate: new Date(), updatedAt: new Date() });
      const returnItems = (items as any[]).map((item: any) => (schema as any).returnItemsInsertSchema.parse({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, refundAmount: item.refundAmount, isPerishable: item.isPerishable, returnReasonId: item.returnReasonId, restocked: !item.isPerishable, notes: item.notes }));
      const returnResult = await (storage as any).createReturn(returnData, returnItems);
      return res.status(201).json(returnResult);
    } catch (error: unknown) {
      console.error('Error processing return:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Failed to process return' });
    }
  });

  app.patch(`${apiPrefix}/returns/:returnId/status`, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const { returnId } = req.params;
      const { status } = req.body;
      if (!['processing', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
      let returnData;
      if (!isNaN(parseInt(returnId))) returnData = await (storage as any).getReturnById(parseInt(returnId));
      else returnData = await (storage as any).getReturnByReturnId(returnId);
      if (!returnData) return res.status(404).json({ error: 'Return not found' });
      if ((req.session as any).userRole === 'manager' && (returnData as any).storeId !== (req.session as any).storeId) return res.status(403).json({ error: 'You do not have access to this return' });
      const updatedReturn = await (storage as any).updateReturnStatus((returnData as any).id, status);
      return res.json(updatedReturn);
    } catch (error: unknown) {
      console.error('Error updating return status:', error);
      return res.status(500).json({ error: 'Failed to update return status' });
    }
  });

  app.get(`${apiPrefix}/customers/lookup`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { email, phone } = req.query;
      if (!email && !phone) return res.status(400).json({ error: 'Email or phone is required' });
      let customer;
      if (email) customer = await (storage as any).getCustomerByEmail(email as string);
      else if (phone) customer = await (storage as any).getCustomerByPhone(phone as string);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      if ((req.session as any).userRole !== 'admin' && (customer as any).storeId !== (req.session as any).storeId) return res.status(403).json({ error: 'Access denied' });
      return res.json(customer);
    } catch (error: unknown) {
      console.error('Error looking up customer:', error);
      return res.status(500).json({ error: 'Failed to lookup customer' });
    }
  });

  app.post(`${apiPrefix}/customers`, isAuthenticated as any, async (req: Request, res: Response) => {
    try {
      const { fullName, email, phone, storeId } = req.body;
      if ((req.session as any).userRole !== 'admin' && (req.session as any).storeId !== storeId) return res.status(403).json({ error: 'Access denied' });
      let customer;
      if (email) customer = await (storage as any).getCustomerByEmail(email);
      if (!customer && phone) customer = await (storage as any).getCustomerByPhone(phone);
      if (customer) return res.status(200).json(customer);
      const customerData = (schema as any).customersInsertSchema.parse({ fullName, email, phone, storeId, updatedAt: new Date() });
      const newCustomer = await (storage as any).createCustomer(customerData);
      return res.status(201).json(newCustomer);
    } catch (error: unknown) {
      console.error('Error creating customer:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Failed to create customer' });
    }
  });
  
  app.post(`${apiPrefix}/inventory/batches/:batchId/adjust`, isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId);
      const { quantity, reason } = req.body;
      if (isNaN(batchId)) return res.status(400).json({ message: 'Invalid batch ID' });
      if (quantity === undefined || isNaN(parseInt(quantity))) return res.status(400).json({ message: 'Quantity must be a number' });
      const batchService = await import('./services/inventory-batch');
      const updatedBatch = await batchService.adjustBatchStock({ batchId, quantity: parseInt(quantity), reason: reason || 'Manual adjustment' });
      return res.json(updatedBatch);
    } catch (error: unknown) {
      console.error('Error adjusting batch stock:', error);
      return res.status(500).json({ message: (error as Error).message || 'Failed to adjust batch stock' });
    }
  });
  
  app.delete(`${apiPrefix}/inventory/batches/:batchId`, isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId);
      const forceDelete = req.query.force === 'true';
      if (isNaN(batchId)) return res.status(400).json({ message: 'Invalid batch ID' });
      const currentBatch = await storage.getInventoryBatchById(batchId);
      if (!currentBatch) return res.status(404).json({ message: 'Batch not found' });
      if (currentBatch.quantity > 0 && !forceDelete) return res.status(400).json({ message: 'Cannot delete batch with non-zero quantity.', nonZeroQuantity: true, currentQuantity: currentBatch.quantity });
      const inventory = await storage.getInventoryItemById(currentBatch.inventoryId);
      if (!inventory) return res.status(404).json({ message: 'Inventory record not found' });
      const product = await storage.getProductById(inventory.productId);
      await storage.createBatchAuditLog({ batchId: currentBatch.id, userId: (req.session as any).userId as number, action: 'delete', details: { batchNumber: currentBatch.batchNumber, productName: product ? product.name : 'Unknown Product', wasForceDeleted: forceDelete, quantityLost: currentBatch.quantity > 0 ? currentBatch.quantity : 0 }, quantityBefore: currentBatch.quantity, quantityAfter: 0 });
      await storage.deleteInventoryBatch(batchId);
      await storage.updateInventoryTotalQuantity(currentBatch.inventoryId);
      return res.status(200).json({ message: 'Batch deleted successfully' });
    } catch (error: unknown) {
      console.error('Error deleting batch:', error);
      return res.status(500).json({ message: (error as Error).message || 'Failed to delete batch' });
    }
  });
  
  app.get(`${apiPrefix}/inventory/batches/:batchId/audit-logs`, isAuthenticated as any, isManagerOrAdmin as any, async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId);
      if (isNaN(batchId)) return res.status(400).json({ message: 'Invalid batch ID' });
      const batch = await storage.getInventoryBatchById(batchId);
      if (!batch) return res.status(404).json({ message: 'Batch not found' });
      const auditLogs = await (storage as any).getBatchAuditLogs(batchId);
      return res.json(auditLogs);
    } catch (error: unknown) {
      console.error('Error fetching batch audit logs:', error);
      return res.status(500).json({ message: 'Failed to fetch batch audit logs' });
    }
  });

  const httpServer = setupSecureServer(app as any); // Cast app to any for setupSecureServer

  app.use(errorHandler as any); // Cast errorHandler

  return httpServer;
}
