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
import { rateLimitMiddleware, authRateLimiter, sensitiveOpRateLimiter } from './middleware/rate-limit'; // Corrected rate limiter imports
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
import * as loyaltyService from './services/loyalty';
import * as analyticsService from './services/analytics';
import { processImportFile, applyColumnMapping, validateLoyaltyData, validateInventoryData, importLoyaltyData, importInventoryData, generateErrorReport } from './services/import-enhanced';
import { validateProductImportCSV, importProducts } from './services/product-import';
import { Request, Response, NextFunction } from 'express';
import { SessionOptions } from 'express-session';
// import { NeonDatabase } from '@neondatabase/serverless'; // Unused import
import { App, Middleware, RouteHandler } from './types/app'; // Removed EnvConfig
import { Database } from './types/index';

// Re-export env for type safety
export const envConfig = env;

export async function registerRoutes(app: Application): Promise<Server> {
  // Import the setupSecureServer to return either HTTP or HTTPS server based on environment
  const { setupSecureServer } = await import('./config/https');
  const PostgresStore = pgSession(session);
  
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
  app.use(nonceGenerator); // Generate nonce for CSP
  app.use(securityHeaders); // Apply security headers including CSP
  
  // Standard middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session(sessionConfig));
  
  // Input sanitization middleware
  app.use(inputSanitization());

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
app.post('/upload', fileUploadInstance.uploadFile.bind(fileUploadInstance) as Middleware); // Corrected method name and usage
app.get('/upload/progress/:id', fileUploadInstance.getProgress.bind(fileUploadInstance) as Middleware);
app.post('/upload/subscribe/:id', fileUploadInstance.subscribeToProgress.bind(fileUploadInstance) as Middleware);

// Store routes
app.post('/stores', rateLimitMiddleware, (req: Request, res: Response, next: NextFunction) => { // Example: using rateLimitMiddleware (formerly standardLimiter)
  // Store creation logic
  next();
}) as RouteHandler;

// Product routes
app.post('/products', rateLimitMiddleware, (req: Request, res: Response, next: NextFunction) => { // Example: using rateLimitMiddleware (formerly standardLimiter)
  // Product creation logic
  next();
}) as RouteHandler;

// Inventory routes
app.post('/inventory', rateLimitMiddleware, (req: Request, res: Response, next: NextFunction) => { // Example: using rateLimitMiddleware (formerly standardLimiter)
  // Inventory management logic
  next();
}) as RouteHandler;

// Transaction routes
app.post('/transactions', sensitiveOpRateLimiter, (req: Request, res: Response, next: NextFunction) => { // Corrected to sensitiveOpRateLimiter
  // Transaction processing logic
  next();
}) as RouteHandler;

// Customer routes
app.post('/customers', rateLimitMiddleware, (req: Request, res: Response, next: NextFunction) => { // Example: using rateLimitMiddleware (formerly standardLimiter)
  // Customer management logic
  next();
}) as RouteHandler;
  
  // Apply session validation middleware
  app.use(validateSession);
  
  // Loyalty API Routes
  app.get('/api/loyalty/members', isAuthenticated, hasStoreAccess, async (req, res) => {
    try {
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : (req.session.storeId || 0);
      
      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }
      
      // Get all customers from the store with their loyalty info
      const customers = await db.query.customers.findMany({
        where: eq(schema.customers.storeId, storeId),
        with: {
          loyaltyMembers: {
            with: {
              tier: true
            }
          }
        }
      });
      
      // Format response
      const members = customers
        .filter(customer => customer.loyaltyMembers && customer.loyaltyMembers.length > 0)
        .map(customer => {
          const member = customer.loyaltyMembers[0];
          return {
            id: member.id,
            customerId: customer.id,
            loyaltyId: member.loyaltyId,
            currentPoints: member.currentPoints,
            totalPointsEarned: member.totalPointsEarned,
            totalPointsRedeemed: member.totalPointsRedeemed,
            enrollmentDate: member.enrollmentDate,
            lastActivity: member.lastActivity,
            customer: {
              id: customer.id,
              fullName: customer.fullName,
              email: customer.email,
              phone: customer.phone
            },
            tier: member.tier
          };
        });
      
      res.json(members);
    } catch (error: unknown) {
      console.error("Error fetching loyalty members:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/member/:id', isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const member = await loyaltyService.getLoyaltyMember(memberId);
      
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      res.json(member);
    } catch (error: unknown) {
      console.error("Error fetching member details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/member/:id/activity', isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const activity = await loyaltyService.getMemberActivityHistory(memberId);
      
      res.json(activity);
    } catch (error: unknown) {
      console.error("Error fetching member activity:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/member/:id/rewards', isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const rewards = await loyaltyService.getAvailableRewards(memberId);
      
      res.json(rewards);
    } catch (error: unknown) {
      console.error("Error fetching available rewards:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/program/:storeId', isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const program = await loyaltyService.getLoyaltyProgram(storeId);
      
      if (!program) {
        return res.status(404).json({ message: "Loyalty program not found" });
      }
      
      res.json(program);
    } catch (error: unknown) {
      console.error("Error fetching loyalty program:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/enroll', isAuthenticated, async (req, res) => {
    try {
      const { customerId } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      
      // Get customer to determine store
      const customer = await db.query.customers.findFirst({
        where: eq(schema.customers.id, customerId)
      });
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      if (!customer.storeId) {
        return res.status(400).json({ message: "Customer is not associated with a store" });
      }
      
      const member = await loyaltyService.enrollCustomer(customerId, customer.storeId, req.session.userId);
      
      res.json(member);
    } catch (error: unknown) {
      console.error("Error enrolling customer:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/program/:storeId', isAuthenticated, isManagerOrAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const programData = req.body;
      
      // Validate store access
      if (!hasStoreAccess(req.session, storeId)) {
        return res.status(403).json({ message: 'Access denied to this store' });
      }

      // Validate program data
      const validatedData = schema.loyaltyProgramSchema.parse(programData);
      
      // Create or update loyalty program
      const program = await loyaltyService.createOrUpdateProgram(storeId, validatedData);
      
      res.json(program);
    } catch (error: unknown) {
      console.error("Error creating/updating loyalty program:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/reward', isAuthenticated, isManagerOrAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const rewardData = req.body;
      
      // Create reward
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
  
  app.post('/api/loyalty/tier', isAuthenticated, isManagerOrAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const tierData = req.body;
      
      // Create tier
      const tier = await loyaltyService.createLoyaltyTier(tierData);
      
      res.json(tier);
    } catch (error: unknown) {
      console.error("Error creating loyalty tier:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/redeem', isAuthenticated, async (req, res) => {
    try {
      const { memberId, rewardId, transactionId } = req.body;
      
      if (!memberId || !rewardId || !transactionId) {
        return res.status(400).json({ message: "Member ID, reward ID, and transaction ID are required" });
      }
      
      const result = await loyaltyService.applyReward(
        memberId,
        rewardId,
        transactionId,
        req.session.userId
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
  
  // Debug endpoint to auto-login (REMOVE IN PRODUCTION)
  app.get(`${apiPrefix}/auth/debug-login`, async (req, res) => {
    // Set the response content type to application/json
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    try {
      const username = "admin"; // Default admin user from seed data
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "Debug user not found" });
      }
      
      // Regenerate session to prevent session fixation
      const regenerateSession = () => {
        return new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => {
            if (err) {
              console.error("Error regenerating session:", err);
              reject(err);
            } else {
              console.log("Session regenerated successfully for debug login");
              resolve();
            }
          });
        });
      };
      
      try {
        await regenerateSession();
      } catch (sessionError: unknown) {
        console.error("Failed to regenerate session:", sessionError);
        return res.status(500).json({ message: "Session error" });
      }
      
      // Set session data
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.storeId = user.storeId || undefined;
      req.session.fullName = user.fullName;
      
      console.log("DEBUG: Session data set for auto-login:", {
        userId: req.session.userId,
        userRole: req.session.userRole,
        storeId: req.session.storeId,
        fullName: req.session.fullName
      });
      
      // Save the session explicitly
      const saveSessionPromise = () => {
        return new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("Error saving session:", err);
              reject(err);
            } else {
              console.log("DEBUG: Session saved successfully");
              resolve(true);
            }
          });
        });
      };
      
      try {
        await saveSessionPromise();
      } catch (sessionError: unknown) {
        console.error("Failed to save session:", sessionError);
        return res.status(500).json({ message: "Session error" });
      }
      
      const userData = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        storeId: user.storeId
      };
      
      return res.status(200).json({
        message: "Debug login successful",
        user: userData
      });
    } catch (error: unknown) {
      console.error("Debug login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Authentication Routes -----------

  // Endpoint to check if user is authenticated
  app.get(`${apiPrefix}/auth/me`, async (req, res) => {
    // Set the response content type to application/json
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    console.log("Session in /auth/me:", req.session);
    console.log("Cookies:", req.headers.cookie);
    
    if (!req.session || typeof req.session.userId === 'undefined') {
      console.log("No active session or userId found");
      return res.status(401).json({
        authenticated: false,
        message: "Not authenticated"
      });
    }

    try {
      console.log("Fetching user data for ID:", req.session.userId);
      const user = await storage.getUserById(req.session.userId);
      
      if (!user) {
        console.log("User not found in database, destroying session");
        req.session.destroy((err) => {
          if (err) console.error("Error destroying invalid session:", err);
        });
        return res.status(401).json({
          authenticated: false,
          message: "User not found"
        });
      }
      
      console.log("User authenticated successfully:", user.username);
      return res.status(200).json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          storeId: user.storeId
        }
      });
    } catch (error: unknown) {
      console.error("Auth check error:", error);
      return res.status(500).json({
        authenticated: false,
        message: "Internal server error"
      });
    }
  });
  
  app.post(`${apiPrefix}/auth/login`, async (req, res) => {
    // Set the response content type to application/json
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    console.log("Login request headers:", {
      cookie: req.headers.cookie,
      "content-type": req.headers["content-type"]
    });
    
    try {
      console.log("Login attempt for:", req.body.username);
      const loginData = schema.loginSchema.parse(req.body);
      
      console.log("Validating user credentials for:", loginData.username);
      
      const user = await storage.validateUserCredentials(
        loginData.username,
        loginData.password
      );
      
      console.log("User validation result:", user ? "Success" : "Failed");
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Update last login timestamp
      await storage.updateUserLastLogin(user.id);
      
      // Regenerate session to prevent session fixation attack
      const regenerateSession = () => {
        return new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => {
            if (err) {
              console.error("Error regenerating session:", err);
              reject(err);
            } else {
              console.log("Session regenerated successfully");
              resolve();
            }
          });
        });
      };
      
      try {
        await regenerateSession();
      } catch (sessionError: unknown) {
        console.error("Failed to regenerate session:", sessionError);
        return res.status(500).json({ message: "Session error" });
      }
      
      // Set session data
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.storeId = user.storeId || undefined;
      req.session.fullName = user.fullName;
      
      console.log("Session data set:", {
        userId: req.session.userId,
        userRole: req.session.userRole,
        storeId: req.session.storeId,
        fullName: req.session.fullName
      });
      
      // Save the session explicitly
      const saveSessionPromise = () => {
        return new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("Error saving session:", err);
              reject(err);
            } else {
              console.log("Session saved successfully");
              resolve(true);
            }
          });
        });
      };
      
      try {
        await saveSessionPromise();
      } catch (sessionError: unknown) {
        console.error("Failed to save session:", sessionError);
        return res.status(500).json({ message: "Session error" });
      }
      
      // Set the cookie explicitly in the response
      const userData = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
      };
      
      console.log("Sending user data in response:", userData);
      return res.status(200).json(userData);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/auth/register`, async (req, res) => {
    // Set the response content type to application/json
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    try {
      // Validate the request body
      const userData = schema.userInsertSchema.parse(req.body);
      
      // Check if username is already taken
      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return res.status(409).json({ 
          authenticated: false,
          message: "Username already exists" 
        });
      }
      
      // Check if email is already taken
      if (userData.email) {
        const existingUserByEmail = await storage.getUserByEmail(userData.email);
        if (existingUserByEmail) {
          return res.status(409).json({ 
            authenticated: false,
            message: "Email already in use" 
          });
        }
      }
      
      // Create the user
      const newUser = await storage.createUser(userData);
      
      // Regenerate session to prevent session fixation attack
      const regenerateSession = () => {
        return new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => {
            if (err) {
              console.error("Error regenerating session:", err);
              reject(err);
            } else {
              console.log("Session regenerated successfully");
              resolve();
            }
          });
        });
      };
      
      try {
        await regenerateSession();
      } catch (sessionError: unknown) {
        console.error("Failed to regenerate session:", sessionError);
        return res.status(500).json({ 
          authenticated: false,
          message: "Session error" 
        });
      }
      
      // Set session data - auto-login
      req.session.userId = newUser.id;
      req.session.userRole = newUser.role;
      req.session.storeId = newUser.storeId || undefined;
      req.session.fullName = newUser.fullName;
      
      // Save the session explicitly
      const saveSessionPromise = () => {
        return new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("Error saving session:", err);
              reject(err);
            } else {
              console.log("Session saved successfully");
              resolve(true);
            }
          });
        });
      };
      
      try {
        await saveSessionPromise();
      } catch (sessionError: unknown) {
        console.error("Failed to save session:", sessionError);
        return res.status(500).json({ 
          authenticated: false,
          message: "Session error" 
        });
      }
      
      // Return the user in the same format as our auth responses
      return res.status(201).json({
        authenticated: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
          storeId: newUser.storeId,
          lastLogin: newUser.lastLogin,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt
        }
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          authenticated: false,
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      console.error("Registration error:", error);
      return res.status(500).json({ 
        authenticated: false,
        message: "Failed to create account" 
      });
    }
  });
  
  app.post(`${apiPrefix}/auth/logout`, (req, res) => {
    // Set the response content type to application/json
    res.setHeader('Content-Type', 'application/json');
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      
      res.clearCookie("chainsync.sid");
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });
  
  // Password reset request endpoint
  app.post(`${apiPrefix}/auth/forgot-password`, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false,
          message: "Email is required" 
        });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // We return success even if the email doesn't exist for security reasons
        return res.status(200).json({ 
          success: true,
          message: "If a user with that email exists, a password reset link has been sent" 
        });
      }
      
      // Create a password reset token
      const resetToken = await storage.createPasswordResetToken(user.id);
      
      // Import the email service
      const { sendPasswordResetEmail } = await import('./services/email');
      
      // Send the password reset email
      const emailSent = await sendPasswordResetEmail(
        user.email,
        resetToken.token,
        user.username
      );
      
      if (!emailSent) {
        console.error(`Failed to send password reset email to ${user.email}`);
        return res.status(500).json({ 
          success: false,
          message: "Failed to send password reset email. Please try again later." 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Password reset email sent successfully"
      });
    } catch (error: unknown) {
      console.error("Password reset request error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal server error"
      });
    }
  });
  
  // Validate reset token (used to check if token is valid before showing reset form)
  app.get(`${apiPrefix}/auth/validate-reset-token/:token`, async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ 
          valid: false,
          message: "Token is required" 
        });
      }
      
      const isValid = await storage.isPasswordResetTokenValid(token);
      
      return res.status(200).json({
        valid: isValid,
        message: isValid 
          ? "Token is valid" 
          : "Token is invalid or expired"
      });
    } catch (error: unknown) {
      console.error("Token validation error:", error);
      return res.status(500).json({ 
        valid: false,
        message: "Internal server error" 
      });
    }
  });
  
  // Reset password endpoint
  app.post(`${apiPrefix}/auth/reset-password`, async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ 
          success: false,
          message: "Token and password are required" 
        });
      }
      
      // Check if token is valid
      const isValid = await storage.isPasswordResetTokenValid(token);
      
      if (!isValid) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid or expired token" 
        });
      }
      
      // Get the token from database to find the associated user
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid token" 
        });
      }
      
      // Update the user's password
      await storage.updateUser(resetToken.userId, { password });
      
      // Mark the token as used
      await storage.markPasswordResetTokenAsUsed(token);
      
      return res.status(200).json({
        success: true,
        message: "Password reset successful. You can now login with your new password."
      });
    } catch (error: unknown) {
      console.error("Password reset error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Internal server error" 
      });
    }
  });
  
  // Test email endpoint (only available in development)
  if (process.env.NODE_ENV !== 'production') {
    app.get(`${apiPrefix}/test/email`, async (req, res) => {
      try {
        const { sendEmail, verifyEmailConnection } = await import('./services/email');
        
        // First verify the connection
        const isConnected = await verifyEmailConnection();
        
        if (!isConnected) {
          return res.status(500).json({ 
            success: false,
            message: "Email connection failed. Check your EMAIL_USER and EMAIL_PASSWORD environment variables." 
          });
        }
        
        // Then try to send a test email
        const result = await sendEmail({
          to: process.env.EMAIL_USER || '',
          subject: "ChainSync Test Email",
          text: "This is a test email from ChainSync to verify the email service is working correctly.",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(120deg, #4f46e5, #8b5cf6); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">ChainSync</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <p>Hello,</p>
                <p>This is a test email from ChainSync to verify the email service is working correctly.</p>
                <p>If you're seeing this, then your email service is properly configured!</p>
                <p>Regards,<br>ChainSync Team</p>
              </div>
            </div>
          `
        });
        
        if (result) {
          return res.status(200).json({ 
            success: true,
            message: `Test email sent successfully to ${process.env.EMAIL_USER}`
          });
        } else {
          return res.status(500).json({ 
            success: false,
            message: "Failed to send test email"
          });
        }
      } catch (error: unknown) {
        console.error("Test email error:", error);
        return res.status(500).json({ 
          success: false,
          message: `Error testing email service: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });
  }
  
  app.get(`${apiPrefix}/auth/me`, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ 
        authenticated: false,
        message: "Not authenticated" 
      });
    }
    
    try {
      const user = await storage.getUserById(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ 
          authenticated: false,
          message: "User not found" 
        });
      }
      
      return res.status(200).json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
        }
      });
    } catch (error: unknown) {
      console.error("Auth check error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Dashboard Routes -----------
  
  app.get(`${apiPrefix}/dashboard/quick-stats`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userRole } = req.session;
      
      // For non-admin users, ensure they can only see their own store's data
      const isAdminUser = userRole === 'admin';
      // For managers and cashiers, they must have a storeId assigned
      if (!isAdminUser && !storeId) {
        return res.status(403).json({ message: "Access forbidden - no store assigned" });
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Get today's sales data
      const todaySales = await storage.getDailySalesData(storeId, 1);
      const todaySalesTotal = todaySales.reduce((sum, data) => sum + Number(data.totalSales), 0);
      const todayTransactions = todaySales.reduce((sum, data) => sum + Number(data.transactionCount), 0);
      
      // Get yesterday's sales data for comparison
      const yesterdaySales = await storage.getDailySalesData(storeId, 2);
      // Safely filter the sales data based on date
      const yesterdaySalesFiltered = yesterdaySales.filter(data => {
        // First ensure data.date exists
        if (!data.date) return false;
        
        try {
          // Parse the date, whether it's a string or Date object
          const dateObj = typeof data.date === 'string' 
            ? new Date(data.date) 
            : (data.date instanceof Date ? data.date : null);
            
          // If we got a valid date, compare it
          if (dateObj && !isNaN(dateObj.getTime())) {
            return dateObj.getDate() === yesterday.getDate();
          }
        } catch (e: unknown) {
          console.error("Error parsing date:", e);
        }
        
        return false;
      });
      const yesterdaySalesTotal = yesterdaySalesFiltered.reduce((sum, data) => sum + Number(data.totalSales), 0);
      const yesterdayTransactions = yesterdaySalesFiltered.reduce((sum, data) => sum + Number(data.transactionCount), 0);
      
      // Calculate percentage changes
      const salesPercentChange = yesterdaySalesTotal > 0 
        ? ((todaySalesTotal - yesterdaySalesTotal) / yesterdaySalesTotal) * 100 
        : 0;
      
      const transactionsPercentChange = yesterdayTransactions > 0 
        ? ((todayTransactions - yesterdayTransactions) / yesterdayTransactions) * 100 
        : 0;
      
      // Get low stock count
      const lowStockCount = await storage.getLowStockCount(storeId);
      
      // Get yesterday's low stock count for comparison
      const lowStockDifference = 0; // This would require historical data, using 0 for now
      
      // Get active stores count (for admin)
      const stores = await storage.getAllStores();
      const activeStores = stores.filter(store => store.isActive);
      
      return res.status(200).json({
        salesTotal: todaySalesTotal.toFixed(2),
        salesChange: salesPercentChange.toFixed(1),
        transactionsCount: todayTransactions,
        transactionsChange: transactionsPercentChange.toFixed(1),
        lowStockCount,
        lowStockChange: lowStockDifference,
        activeStoresCount: activeStores.length,
        totalStoresCount: stores.length
      });
    } catch (error: unknown) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/dashboard/store-performance`, isAuthenticated, async (req, res) => {
    try {
      // Get time period from query params, default to 7 days
      const days = parseInt(req.query.days as string) || 7;
      
      const { userRole, storeId } = req.session;
      
      // For non-admin users, only show their specific store data
      if (userRole !== 'admin' && storeId) {
        // For managers and cashiers, show only their store data
        const storeData = await storage.getDailySalesData(storeId, days);
        const storeInfo = await storage.getStoreById(storeId);
        
        if (!storeInfo) {
          return res.status(404).json({ message: "Store not found" });
        }
        
        // Create a single-store performance object
        const singleStorePerformance = [{
          storeId: storeInfo.id,
          storeName: storeInfo.name,
          totalSales: storeData.reduce((sum, day) => sum + parseFloat(String(day.totalSales)), 0).toFixed(2),
          transactionCount: storeData.reduce((sum, day) => sum + (typeof day.transactionCount === 'number' ? day.transactionCount : 0), 0)
        }];
        
        // Format the data for the chart - only including this store
        const formattedData = {
          storeComparison: singleStorePerformance,
          dailySales: storeData
        };
        
        return res.status(200).json(formattedData);
      }
      
      // For admins, show all stores
      const storePerformance = await storage.getStoreSalesComparison(days);
      
      // Get daily sales data for each store
      const dailySales = await storage.getDailySalesData(undefined, days);
      
      // Format the data for the chart
      const formattedData = {
        storeComparison: storePerformance,
        dailySales
      };
      
      return res.status(200).json(formattedData);
    } catch (error: unknown) {
      console.error("Store performance error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/dashboard/recent-transactions`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userRole } = req.session;
      const limit = parseInt(req.query.limit as string) || 5;
      
      // For non-admin users, enforce using their assigned store
      const targetStoreId = userRole !== 'admin' ? storeId : undefined;
      
      // Get transactions - passing storeId will filter to just that store
      // For admin users with no storeId specified, it will return transactions across all stores
      const transactions = await storage.getRecentTransactions(targetStoreId, limit);
      
      return res.status(200).json(transactions);
    } catch (error: unknown) {
      console.error("Recent transactions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Store Performance Comparison API
  app.get(`${apiPrefix}/analytics/store-performance`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userRole } = req.session;
      
      // Parse dates from query parameters
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
        // Set end date to end of day for inclusive comparison
        endDate.setHours(23, 59, 59, 999);
      }
      
      // Get all stores
      const stores = await storage.getAllStores();
      
      // For non-admin users, filter to only show their store
      const filteredStores = userRole !== 'admin' && storeId 
        ? stores.filter(store => store.id === storeId)
        : stores;
      
      // Get store-level metrics with date filtering
      const storePerformanceData = await Promise.all(
        filteredStores.map(async (store) => {
          try {
            // Get transactions for this store within date range
            const transactions = await storage.getStoreTransactions(
              store.id,
              startDate,
              endDate,
              1, // page
              1000 // limit - using a high number to get all transactions in the date range
            );
            
            // Calculate total revenue and other metrics
            const totalRevenue = transactions.data.reduce(
              (sum, t) => sum + parseFloat(t.total.toString()), 
              0
            );
            
            const transactionCount = transactions.data.length;
            const averageTransaction = transactionCount > 0 
              ? totalRevenue / transactionCount 
              : 0;
            
            // Get top products for this store
            const topProducts = await storage.getSalesTrends(
              store.id,
              startDate,
              endDate
            );
            
            return {
              ...store,
              metrics: {
                totalRevenue,
                averageTransaction,
                transactionCount
              },
              topProducts: topProducts.slice(0, 5).map(p => ({
                productId: p.productId,
                productName: p.productName || 'Unknown Product',
                quantity: parseInt(p.quantity?.toString() || '0'),
                total: parseFloat(p.total?.toString() || '0')
              }))
            };
          } catch (error: unknown) {
            console.error(`Error processing store ${store.id}:`, error);
            return {
              ...store,
              metrics: {
                totalRevenue: 0,
                averageTransaction: 0,
                transactionCount: 0
              },
              topProducts: []
            };
          }
        })
      );
      
      // Calculate global metrics
      const globalMetrics = {
        totalRevenue: storePerformanceData.reduce(
          (sum, store) => sum + store.metrics.totalRevenue, 
          0
        ),
        transactionCount: storePerformanceData.reduce(
          (sum, store) => sum + store.metrics.transactionCount, 
          0
        ),
        averageTransaction: 0
      };
      
      // Calculate global average transaction
      if (globalMetrics.transactionCount > 0) {
        globalMetrics.averageTransaction = 
          globalMetrics.totalRevenue / globalMetrics.transactionCount;
      }
      
      // Generate date range description
      let dateRangeDescription = 'All time performance comparison';
      
      if (startDate && endDate) {
        dateRangeDescription = `Performance from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
      } else if (startDate) {
        dateRangeDescription = `Performance since ${startDate.toLocaleDateString()}`;
      } else if (endDate) {
        dateRangeDescription = `Performance until ${endDate.toLocaleDateString()}`;
      }
      
      return res.status(200).json({
        storePerformance: storePerformanceData,
        globalMetrics,
        dateRangeDescription
      });
    } catch (error: unknown) {
      console.error('Store performance comparison error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Sales Trend Analysis API
  app.get(`${apiPrefix}/analytics/sales-trends`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userRole } = req.session;
      const { 
        startDate, 
        endDate, 
        groupBy = 'day',
        store: queryStoreId
      } = req.query;
      
      // For non-admin users, enforce using their assigned store
      let targetStoreId = undefined;
      if (userRole !== 'admin') {
        // Non-admin users can only see their assigned store
        targetStoreId = storeId;
      } else if (queryStoreId) {
        // Admin users can specify a store ID
        targetStoreId = parseInt(queryStoreId as string);
      }
      
      // Parse dates
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;
      
      if (startDate) {
        parsedStartDate = new Date(startDate as string);
      }
      
      if (endDate) {
        parsedEndDate = new Date(endDate as string);
        // Set end date to end of day
        parsedEndDate.setHours(23, 59, 59, 999);
      }
      
      // Validate groupBy (must be 'day', 'week', or 'month')
      const validGroupBy = ['day', 'week', 'month'].includes(groupBy as string) 
        ? groupBy as 'day' | 'week' | 'month' 
        : 'day';
      
      const salesTrends = await analyticsService.getSalesTrendsAnalysis(
        targetStoreId,
        parsedStartDate,
        parsedEndDate,
        validGroupBy
      );
      
      // Add date range description
      const dateRangeDescription = analyticsService.getDateRangeDescription(parsedStartDate, parsedEndDate);
      
      return res.json({
        ...salesTrends,
        dateRangeDescription
      });
    } catch (error: unknown) {
      console.error('Sales trends analysis error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Store Performance Comparison API
  app.get(`${apiPrefix}/analytics/store-performance`, isAuthenticated, async (req: Request, res: Response) => {
    try {
      const session = req.session as any; // Access session
      
      // Only admin users can access store comparison data
      if (session.userRole !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized: Admin access required' });
      }
      
      const { startDate, endDate } = req.query;
      
      // Parse dates
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;
      
      if (startDate) {
        parsedStartDate = new Date(startDate as string);
      }
      
      if (endDate) {
        parsedEndDate = new Date(endDate as string);
        // Set end date to end of day
        parsedEndDate.setHours(23, 59, 59, 999);
      }
      
      const storePerformance = await analyticsService.getStorePerformanceComparison(
        parsedStartDate,
        parsedEndDate
      );
      
      // Add date range description
      const dateRangeDescription = analyticsService.getDateRangeDescription(parsedStartDate, parsedEndDate);
      
      return res.json({
        ...storePerformance,
        dateRangeDescription
      });
    } catch (error: unknown) {
      console.error('Store performance comparison error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ----------- Store Routes -----------
  
  app.get(`${apiPrefix}/stores`, isAuthenticated, async (req, res) => {
    try {
      const stores = await storage.getAllStores();
      return res.status(200).json(stores);
    } catch (error: unknown) {
      console.error("Get stores error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/stores/:storeId`, isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      
      const store = await storage.getStoreById(storeId);
      
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      return res.status(200).json(store);
    } catch (error: unknown) {
      console.error("Get store error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/stores`, isAdmin, async (req, res) => {
    try {
      const storeData = schema.storeInsertSchema.parse(req.body);
      const newStore = await storage.createStore(storeData);
      
      return res.status(201).json(newStore);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      console.error("Create store error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.put(`${apiPrefix}/stores/:storeId`, isAdmin, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      
      const storeData = schema.storeInsertSchema.parse(req.body);
      
      const updatedStore = await storage.updateStore(storeId, storeData);
      
      if (!updatedStore) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      return res.status(200).json(updatedStore);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      console.error("Update store error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- User Routes -----------
  
  app.get(`${apiPrefix}/users`, isManagerOrAdmin, async (req, res) => {
    try {
      const { userRole, storeId } = req.session;
      
      let users;
      if (userRole === 'admin') {
        users = await storage.getAllUsers();
      } else if (userRole === 'manager' && storeId) {
        users = await storage.getUsersByStoreId(storeId);
      } else {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Don't return password hashes
      const sanitizedUsers = users.map(user => ({
        ...user,
        password: undefined
      }));
      
      return res.status(200).json(sanitizedUsers);
    } catch (error: unknown) {
      console.error("Get users error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/users`, isManagerOrAdmin, async (req, res) => {
    try {
      const { userRole, storeId } = req.session;
      const userData = schema.userInsertSchema.parse(req.body);
      
      // Restrict managers to creating users for their own store
      if (userRole === 'manager') {
        if (userData.role === 'admin') {
          return res.status(403).json({ 
            message: "Managers cannot create admin users" 
          });
        }
        
        if (userData.storeId !== storeId) {
          return res.status(403).json({ 
            message: "Managers can only create users for their own store" 
          });
        }
      }
      
      const newUser = await storage.createUser(userData);
      
      return res.status(201).json({
        ...newUser,
        password: undefined
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      console.error("Create user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Inventory Routes -----------
  
  app.get(`${apiPrefix}/inventory`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userRole } = req.session;
      
      // If the request specifies a store and the user is an admin, use that
      const requestedStoreId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      
      // Determine which store's inventory to fetch
      const targetStoreId = userRole === 'admin' && requestedStoreId ? requestedStoreId : storeId;
      
      if (!targetStoreId) {
        return res.status(400).json({ message: "Store ID is required" });
      }
      
      const inventory = await storage.getInventoryByStoreId(targetStoreId);
      return res.status(200).json(inventory);
    } catch (error: unknown) {
      console.error("Get inventory error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/inventory/low-stock`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userRole } = req.session;
      
      // Admins can see low stock for all stores or a specific store
      const targetStoreId = userRole === 'admin' 
        ? (req.query.storeId ? parseInt(req.query.storeId as string) : undefined) 
        : storeId;
      
      const lowStockItems = await storage.getLowStockItems(targetStoreId);
      return res.status(200).json(lowStockItems);
    } catch (error: unknown) {
      console.error("Get low stock error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/inventory/expiring`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userRole } = req.session;
      
      // Admins can see expiring items for all stores or a specific store
      const targetStoreId = userRole === 'admin' 
        ? (req.query.storeId ? parseInt(req.query.storeId as string) : undefined) 
        : storeId;
      
      // Default to 30 days if not specified
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      
      const expiringItems = await storage.getExpiringItems(days, targetStoreId);
      return res.status(200).json(expiringItems);
    } catch (error: unknown) {
      console.error("Get expiring items error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/inventory/expired`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userRole } = req.session;
      
      // Admins can see expired items for all stores or a specific store
      const targetStoreId = userRole === 'admin' 
        ? (req.query.storeId ? parseInt(req.query.storeId as string) : undefined) 
        : storeId;
      
      const expiredItems = await storage.getExpiredItems(targetStoreId);
      return res.status(200).json(expiredItems);
    } catch (error: unknown) {
      console.error("Get expired items error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.put(`${apiPrefix}/inventory/:inventoryId`, isManagerOrAdmin, async (req, res) => {
    try {
      const inventoryId = parseInt(req.params.inventoryId);
      
      if (isNaN(inventoryId)) {
        return res.status(400).json({ message: "Invalid inventory ID" });
      }
      
      const { quantity, minimumLevel } = req.body;
      
      // Validate inventory data
      if (quantity === undefined && minimumLevel === undefined) {
        return res.status(400).json({ message: "No update data provided" });
      }
      
      const updateData: Partial<schema.InventoryInsert> = {};
      
      if (quantity !== undefined) {
        if (quantity < 0) {
          return res.status(400).json({ message: "Quantity cannot be negative" });
        }
        updateData.quantity = quantity;
      }
      
      if (minimumLevel !== undefined) {
        if (minimumLevel < 0) {
          return res.status(400).json({ message: "Minimum level cannot be negative" });
        }
        updateData.minimumLevel = minimumLevel;
      }
      
      const updatedInventory = await storage.updateInventory(inventoryId, updateData);
      
      if (!updatedInventory) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      return res.status(200).json(updatedInventory);
    } catch (error: unknown) {
      console.error("Update inventory error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint specifically for setting minimum stock levels
  app.post(`${apiPrefix}/inventory/minimum-level`, isManagerOrAdmin, async (req, res) => {
    try {
      const { inventoryId, minimumLevel } = req.body;
      
      if (!inventoryId || inventoryId <= 0) {
        return res.status(400).json({ message: "Invalid inventory ID" });
      }
      
      if (minimumLevel === undefined || minimumLevel < 0) {
        return res.status(400).json({ message: "Minimum level must be a non-negative number" });
      }
      
      // Update only the minimum level
      const updatedInventory = await storage.updateInventory(inventoryId, {
        minimumLevel: minimumLevel
      });
      
      if (!updatedInventory) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      return res.status(200).json(updatedInventory);
    } catch (error: unknown) {
      console.error("Update minimum level error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Category Management Routes -----------
  // Get all categories
  app.get('/api/products/categories', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const categories = await db.select().from(schema.categories).orderBy(schema.categories.name);
      res.json(categories);
    } catch (error: unknown) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  // Create new category
  app.post('/api/products/categories', isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const data = schema.categoryInsertSchema.parse(req.body);
      
      const [newCategory] = await db.insert(schema.categories)
        .values({
          name: data.name,
          description: data.description || null,
        })
        .returning();
      
      res.status(201).json(newCategory);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        console.error('Error creating category:', error);
        res.status(500).json({ message: 'Failed to create category' });
      }
    }
  });

  // Update category
  app.patch('/api/products/categories/:id', isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid category ID' });
      }

      const data = schema.categoryInsertSchema.parse(req.body);
      
      const [updatedCategory] = await db.update(schema.categories)
        .set({
          name: data.name,
          description: data.description || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.categories.id, id))
        .returning();
      
      if (!updatedCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      res.json(updatedCategory);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        console.error('Error updating category:', error);
        res.status(500).json({ message: 'Failed to update category' });
      }
    }
  });

  // Delete category
  app.delete('/api/products/categories/:id', isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid category ID' });
      }

      // Check if category is in use by any products
      const products = await db.select({ count: sql`count(*)` })
        .from(schema.products)
        .where(eq(schema.products.categoryId, id));
      
      if (products.length > 0 && parseInt(products[0].count.toString()) > 0) {
        return res.status(409).json({ 
          message: 'Cannot delete category that is being used by products',
          count: products[0].count 
        });
      }
      
      const [deletedCategory] = await db.delete(schema.categories)
        .where(eq(schema.categories.id, id))
        .returning();
      
      if (!deletedCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      res.json({ message: 'Category deleted successfully', category: deletedCategory });
    } catch (error: unknown) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });

  // ----------- Product Routes -----------
  
  // Category management endpoints are already defined above
  
  app.get(`${apiPrefix}/products`, isAuthenticated, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      return res.status(200).json(products);
    } catch (error: unknown) {
      console.error("Get products error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/products/barcode/:barcode`, isAuthenticated, async (req, res) => {
    try {
      const { barcode } = req.params;
      const { storeId } = req.session;
      
      if (!storeId) {
        return res.status(400).json({ error: "Store ID is required in session" });
      }
      
      const product = await storage.getProductByBarcode(barcode);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Check if the product has expired inventory in the current store
      const inventory = await storage.getStoreProductInventory(storeId, product.id);
      
      if (!inventory) {
        return res.status(404).json({ error: "Product not found in current store inventory" });
      }
      
      // Check if inventory has an expiry date and if it has expired
      const today = new Date();
      if (inventory.expiryDate && new Date(inventory.expiryDate) < today) {
        return res.status(400).json({ 
          error: "Product has expired and cannot be sold",
          product: product,
          isExpired: true,
          expiryDate: inventory.expiryDate
        });
      }
      
      // Include inventory information in the response
      return res.status(200).json({
        product: product,
        inventory: {
          quantity: inventory.quantity,
          expiryDate: inventory.expiryDate
        }
      });
    } catch (error: unknown) {
      console.error("Get product by barcode error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/products/search`, isAuthenticated, async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      const { storeId } = req.session;
      
      if (!searchTerm) {
        return res.status(400).json({ message: "Search term is required" });
      }
      
      if (!storeId) {
        return res.status(400).json({ error: "Store ID is required in session" });
      }
      
      const products = await storage.searchProducts(searchTerm);
      
      // Check for expired products and mark them
      const today = new Date();
      const productsWithInventory = await Promise.all(
        products.map(async (product) => {
          const inventory = await storage.getStoreProductInventory(storeId, product.id);
          
          if (!inventory) {
            return {
              ...product,
              inStock: false,
              isExpired: false
            };
          }
          
          const isExpired = inventory.expiryDate && new Date(inventory.expiryDate) < today;
          
          return {
            ...product,
            inStock: inventory.quantity > 0,
            quantity: inventory.quantity,
            expiryDate: inventory.expiryDate,
            isExpired: isExpired
          };
        })
      );
      
      return res.status(200).json(productsWithInventory);
    } catch (error: unknown) {
      console.error("Search products error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- POS Routes -----------
  
  // ----------- Cashier Session Management -----------
  
  // Start a cashier session
  app.post(`${apiPrefix}/pos/cashier-sessions/start`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { storeId, notes } = req.body;
      
      // Validate input
      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }
      
      // Check if user already has an active session
      const activeSession = await storage.getActiveCashierSession(userId);
      if (activeSession) {
        return res.status(400).json({ 
          message: "You already have an active session", 
          session: activeSession 
        });
      }
      
      // Create new session
      const session = await storage.createCashierSession({
        userId,
        storeId,
        notes: notes || null,
        status: "active",
        transactionCount: 0,
        totalSales: "0.00"
      });
      
      return res.status(201).json(session);
    } catch (error: unknown) {
      console.error("Error starting cashier session:", error);
      return res.status(500).json({ message: "Failed to start cashier session" });
    }
  });
  
  // End a cashier session
  app.post(`${apiPrefix}/pos/cashier-sessions/end`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { sessionId, notes } = req.body;
      
      // Validate input
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }
      
      // Get session
      const session = await storage.getCashierSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to end this session" });
      }
      
      // Check if already ended
      if (session.status === "closed") {
        return res.status(400).json({ message: "This session is already closed" });
      }
      
      // End session
      const updatedSession = await storage.updateCashierSession(sessionId, {
        endTime: new Date(),
        status: "closed",
        notes: notes ? (session.notes ? `${session.notes}\n${notes}` : notes) : session.notes
      });
      
      return res.status(200).json(updatedSession);
    } catch (error: unknown) {
      console.error("Error ending cashier session:", error);
      return res.status(500).json({ message: "Failed to end cashier session" });
    }
  });
  
  // Get active cashier session
  app.get(`${apiPrefix}/pos/cashier-sessions/active`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const session = await storage.getActiveCashierSession(userId);
      return res.status(200).json({ session });
    } catch (error: unknown) {
      console.error("Error getting active cashier session:", error);
      return res.status(500).json({ message: "Failed to get active cashier session" });
    }
  });
  
  // Get cashier session by ID
  app.get(`${apiPrefix}/pos/cashier-sessions/:id`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const sessionId = parseInt(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({ message: "Invalid session ID" });
      }
      
      const session = await storage.getCashierSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Check if user is authorized (either own session or manager/admin)
      const userRole = req.session.userRole;
      if (session.userId !== userId && userRole !== "admin" && userRole !== "manager") {
        return res.status(403).json({ message: "You don't have permission to view this session" });
      }
      
      return res.status(200).json(session);
    } catch (error: unknown) {
      console.error("Error getting cashier session:", error);
      return res.status(500).json({ message: "Failed to get cashier session" });
    }
  });
  
  // Get cashier session history
  app.get(`${apiPrefix}/pos/cashier-sessions`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userRole = req.session.userRole;
      let targetUserId = userId;
      
      // Managers and admins can view sessions for any user
      if (userRole === "admin" || userRole === "manager") {
        if (req.query.userId) {
          targetUserId = parseInt(req.query.userId as string);
          if (isNaN(targetUserId)) {
            return res.status(400).json({ message: "Invalid user ID" });
          }
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
  
  app.post(`${apiPrefix}/pos/transactions`, isAuthenticated, async (req, res) => {
    try {
      const { storeId, userId } = req.session;
      
      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }
      
      const { transactionData, items } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Transaction items are required" });
      }
      
      // Check for active cashier session
      const activeSession = await storage.getActiveCashierSession(userId);
      if (!activeSession && !transactionData.isOfflineTransaction) {
        return res.status(400).json({ 
          message: "No active cashier session found. Please start a session before processing transactions." 
        });
      }
      
      // Process loyalty ID if provided
      let loyaltyMemberId = null;
      if (transactionData.loyaltyId) {
        // Find loyalty member by loyalty ID
        const loyaltyMember = await storage.getLoyaltyMemberByLoyaltyId(transactionData.loyaltyId);
        if (loyaltyMember) {
          loyaltyMemberId = loyaltyMember.id;
        }
        // Remove the loyaltyId property as it's not in the database schema
        delete transactionData.loyaltyId;
      }
      
      // Validate transaction data
      const validatedTransaction = schema.transactionInsertSchema.parse({
        ...transactionData,
        storeId,
        cashierId: userId,
        loyaltyMemberId
      });
      
      // Validate products in inventory before completing transaction
      const validationErrors = [];
      const validatedItems = [];
      
      for (const item of items) {
        const validatedItem = schema.transactionItemInsertSchema.parse(item);
        
        // Check if product exists and has sufficient inventory
        const product = await storage.getProductById(item.productId);
        if (!product) {
          validationErrors.push(`Product with ID ${item.productId} not found`);
          continue;
        }
        
        // Check if product has a valid barcode
        if (!product.barcode) {
          validationErrors.push(`Product ${product.name} does not have a valid barcode`);
          continue;
        }
        
        // Check if product has a valid price
        if (parseFloat(product.price.toString()) <= 0) {
          validationErrors.push(`Product ${product.name} does not have a valid price`);
          continue;
        }
        
        // Check inventory levels
        const inventory = await storage.getStoreProductInventory(storeId, item.productId);
        if (!inventory) {
          validationErrors.push(`Product ${product.name} is not in this store's inventory`);
          continue;
        }
        
        // Check if there's enough stock
        if (inventory.quantity < item.quantity) {
          validationErrors.push(`Insufficient stock for ${product.name}. Available: ${inventory.quantity}, Requested: ${item.quantity}`);
          continue;
        }
        
        validatedItems.push(validatedItem);
      }
      
      // If there are validation errors, return them
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          message: "Product validation failed", 
          errors: validationErrors 
        });
      }
      
      // Create the transaction
      const result = await storage.createTransaction(
        validatedTransaction,
        validatedItems
      );
      
      // Update cashier session stats if not an offline transaction
      if (activeSession && !transactionData.isOfflineTransaction) {
        await storage.updateSessionStats(
          activeSession.id, 
          parseFloat(validatedTransaction.total.toString())
        );
      }
      
      return res.status(201).json(result);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      console.error("Create transaction error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/pos/sync-offline-transactions`, isAuthenticated, async (req, res) => {
    try {
      const { transactions } = req.body;
      
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ message: "No transactions to sync" });
      }
      
      const results = [];
      
      for (const transaction of transactions) {
        try {
          // Process loyalty ID if provided
          if (transaction.transactionData.loyaltyId) {
            // Find loyalty member by loyalty ID
            const loyaltyMember = await storage.getLoyaltyMemberByLoyaltyId(transaction.transactionData.loyaltyId);
            if (loyaltyMember) {
              transaction.transactionData.loyaltyMemberId = loyaltyMember.id;
            }
            // Remove the loyaltyId property as it's not in the database schema
            delete transaction.transactionData.loyaltyId;
          }
          
          const result = await storage.createTransaction(
            transaction.transactionData,
            transaction.items
          );
          
          results.push({
            success: true,
            offlineId: transaction.offlineId,
            onlineId: result.transaction.id
          });
        } catch (error: unknown) {
          console.error("Error syncing transaction:", error);
          results.push({
            success: false,
            offlineId: transaction.offlineId,
            error: "Failed to sync transaction"
          });
        }
      }
      
      return res.status(200).json({ results });
    } catch (error: unknown) {
      console.error("Sync offline transactions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Notifications Routes -----------
  
  app.get(`${apiPrefix}/notifications`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { limit = 20, offset = 0, includeRead = false } = req.query;
      
      const notifications = await storage.getUserNotifications(
        userId, 
        Number(limit), 
        Number(offset), 
        includeRead === 'true'
      );
      
      return res.status(200).json({ notifications });
    } catch (error: unknown) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/notifications/count`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const count = await storage.getUnreadNotificationCount(userId);
      
      return res.status(200).json({ count });
    } catch (error: unknown) {
      console.error("Error counting notifications:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.patch(`${apiPrefix}/notifications/:id/read`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const notificationId = Number(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      await storage.markNotificationAsRead(notificationId);
      
      return res.status(200).json({ success: true });
    } catch (error: unknown) {
      console.error("Error marking notification as read:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/notifications/mark-all-read`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      await storage.markAllNotificationsAsRead(userId);
      
      return res.status(200).json({ success: true });
    } catch (error: unknown) {
      console.error("Error marking all notifications as read:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // ----------- AI Assistant Routes -----------
  
  app.post(`${apiPrefix}/ai/chat`, isAuthenticated, async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const aiResponse = await getAIResponse(userId, message);
      
      return res.status(200).json({ response: aiResponse });
    } catch (error: unknown) {
      console.error("AI chat error:", error);
      return res.status(500).json({ message: "AI service encountered an error" });
    }
  });
  
  // ----------- Webhook Routes -----------

  app.post(`${apiPrefix}/webhooks/paystack`, async (req, res) => {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      const rawPayload = JSON.stringify(req.body);
      
      // Process the webhook
      const { handlePaystackWebhook } = await import('./services/webhooks');
      const success = await handlePaystackWebhook(signature, rawPayload);
      
      if (success) {
        return res.status(200).json({ message: "Webhook processed successfully" });
      } else {
        return res.status(400).json({ message: "Failed to process webhook" });
      }
    } catch (error: unknown) {
      console.error("Paystack webhook error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/webhooks/flutterwave`, async (req, res) => {
    try {
      const signature = req.headers['verif-hash'] as string;
      const rawPayload = JSON.stringify(req.body);
      
      // Process the webhook
      const { handleFlutterwaveWebhook } = await import('./services/webhooks');
      const success = await handleFlutterwaveWebhook(signature, rawPayload);
      
      if (success) {
        return res.status(200).json({ message: "Webhook processed successfully" });
      } else {
        return res.status(400).json({ message: "Failed to process webhook" });
      }
    } catch (error: unknown) {
      console.error("Flutterwave webhook error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // ----------- Affiliate Routes -----------
  
  app.post(`${apiPrefix}/affiliates/register`, isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.session;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Register the user as an affiliate
      const { registerAffiliate } = await import('./services/affiliate');
      const affiliate = await registerAffiliate(userId, req.body);
      
      return res.status(201).json(affiliate);
    } catch (error: unknown) {
      console.error("Affiliate registration error:", error);
      return res.status(500).json({ message: "Failed to register as affiliate" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/dashboard`, isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.session;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get affiliate dashboard stats
      const { getAffiliateDashboardStats } = await import('./services/affiliate');
      const stats = await getAffiliateDashboardStats(userId);
      
      return res.status(200).json(stats);
    } catch (error: unknown) {
      console.error("Affiliate dashboard error:", error);
      
      // Check if error is "User is not an affiliate"
      if (error instanceof Error && error.message === "User is not an affiliate") {
        return res.status(404).json({ message: "User is not an affiliate" });
      }
      
      return res.status(500).json({ message: "Failed to get affiliate dashboard" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/referrals`, isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.session;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get affiliate referrals
      const { getAffiliateReferrals } = await import('./services/affiliate');
      const referrals = await getAffiliateReferrals(userId);
      
      return res.status(200).json(referrals);
    } catch (error: unknown) {
      console.error("Affiliate referrals error:", error);
      return res.status(500).json({ message: "Failed to get affiliate referrals" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/payments`, isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.session;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get affiliate payments
      const { getAffiliatePayments } = await import('./services/affiliate');
      const payments = await getAffiliatePayments(userId);
      
      return res.status(200).json(payments);
    } catch (error: unknown) {
      console.error("Affiliate payments error:", error);
      return res.status(500).json({ message: "Failed to get affiliate payments" });
    }
  });
  
  app.post(`${apiPrefix}/affiliates/bank-details`, isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.session;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Update affiliate bank details
      const { updateAffiliateBankDetails } = await import('./services/affiliate');
      const affiliate = await updateAffiliateBankDetails(userId, req.body);
      
      if (!affiliate) {
        return res.status(404).json({ message: "User is not an affiliate" });
      }
      
      return res.status(200).json(affiliate);
    } catch (error: unknown) {
      console.error("Update affiliate bank details error:", error);
      return res.status(500).json({ message: "Failed to update bank details" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/track-click`, async (req, res) => {
    try {
      const { code, source } = req.query as { code: string, source?: string };
      
      if (!code) {
        return res.status(400).json({ message: "Referral code is required" });
      }
      
      // Track the click
      const { trackAffiliateClick } = await import('./services/affiliate');
      await trackAffiliateClick(code, source);
      
      // Return a transparent 1x1 GIF to avoid CORS issues
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.end(transparentGif);
    } catch (error: unknown) {
      console.error("Track affiliate click error:", error);
      
      // Still return a successful response with the transparent GIF
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.end(transparentGif);
    }
  });
  
  app.post(`${apiPrefix}/subscriptions/signup`, async (req, res) => {
    try {
      // Define Zod schema for subscription signup
      const subscriptionSignupSchema = z.object({
        username: z.string().min(3, "Username must be at least 3 characters long"),
        password: z.string().min(8, "Password must be at least 8 characters long"),
        email: z.string().email("Invalid email address"),
        fullName: z.string().min(1, "Full name is required"),
        plan: z.string().min(1, "Plan is required"), // Add more specific plan validation if needed
        referralCode: z.string().optional()
      });

      const validatedBody = subscriptionSignupSchema.parse(req.body);
      const { username, password, email, fullName, plan, referralCode } = validatedBody;
      
      // Check if username is already taken
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      // Create the user
      const userData: schema.UserInsert = {
        username,
        password,
        email,
        fullName,
        role: 'admin' // New users are admins of their own chain
      };
      
      const newUser = await storage.createUser(userData);
      
      // If there's a referral code, track the referral
      if (referralCode) {
        // Import the affiliate service
        const { trackReferral } = await import('./services/affiliate');
        await trackReferral(referralCode, newUser.id);
      }
      
      // Return the new user (without password)
      const { password: _, ...userWithoutPassword } = newUser;
      
      return res.status(201).json({
        user: userWithoutPassword,
        referralApplied: !!referralCode
      });
    } catch (error: unknown) {
      console.error("Subscription signup error:", error);
      return res.status(500).json({ message: "Failed to create subscription" });
    }
  });
  
  // ----------- Payment Routes -----------
  
  // Initialize subscription payment
  app.post(`${apiPrefix}/payments/initialize`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { email, amount, plan, referralCode, country } = req.body;
      
      if (!email || !amount || !plan) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Initialize payment with the appropriate provider
      const payment = await paymentService.initializeSubscription(
        userId,
        email,
        parseFloat(amount),
        plan,
        referralCode,
        country
      );
      
      return res.status(200).json(payment);
    } catch (error: unknown) {
      console.error("Payment initialization error:", error);
      const message = error instanceof Error ? error.message : "Failed to initialize payment";
      return res.status(500).json({ message });
    }
  });
  
  // Verify payment
  app.get(`${apiPrefix}/payments/verify/:reference/:provider`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { reference, provider } = req.params;
      
      if (!reference || !provider) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Special case for simulation
      if (provider === 'simulation') {
        const status = req.query.status as string || 'success';
        
        if (status === 'success') {
          // Create a mock subscription for successful payment
          const planId = req.query.plan as string || 'basic';
          const amount = parseFloat(req.query.amount as string || '20000');
          
          // Process the subscription
          const subscription = await paymentService.processSubscriptionPayment(
            userId,
            planId,
            amount,
            reference,
            'simulation'
          );
          
          return res.status(200).json({
            success: true,
            subscription,
            message: "Payment simulation successful"
          });
        } else {
          return res.status(200).json({
            success: false,
            status: 'failed',
            message: "Payment simulation failed"
          });
        }
      }
      
      // Normal path - verify payment with the appropriate provider
      const verification = await paymentService.verifyPayment(reference, provider);
      
      // Process subscription if payment was successful
      if (verification.status === 'success') {
        const planId = verification.metadata?.plan || 'basic';
        const amount = verification.amount;
        
        // Process the subscription
        const subscription = await paymentService.processSubscriptionPayment(
          userId,
          planId,
          amount,
          reference,
          provider
        );
        
        return res.status(200).json({
          success: true,
          subscription
        });
      }
      
      return res.status(200).json({
        success: false,
        status: verification.status,
        message: verification.status === 'pending' 
          ? "Payment is still being processed" 
          : "Payment failed"
      });
    } catch (error: unknown) {
      console.error("Payment verification error:", error);
      const message = error instanceof Error ? error.message : "Failed to verify payment";
      return res.status(500).json({ message });
    }
  });
  
  // Get user's subscription
  app.get(`${apiPrefix}/subscriptions/current`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get current subscription
      const subscription = await storage.getSubscriptionByUserId(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }
      
      return res.status(200).json(subscription);
    } catch (error: unknown) {
      console.error("Get subscription error:", error);
      return res.status(500).json({ message: "Failed to retrieve subscription" });
    }
  });
  
  app.post(`${apiPrefix}/subscriptions/process-payout`, isAdmin, async (req, res) => {
    try {
      const { affiliateId } = req.body;
      
      // Process the payout
      const { processAffiliatePayout } = await import('./services/affiliate');
      const payments = await processAffiliatePayout(affiliateId);
      
      return res.status(200).json(payments);
    } catch (error: unknown) {
      console.error("Process affiliate payout error:", error);
      return res.status(500).json({ message: "Failed to process affiliate payout" });
    }
  });
  
  // ----------- Affiliate Program Routes -----------

  app.post(`${apiPrefix}/affiliates/register`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Register user as an affiliate
      const affiliate = await affiliateService.registerAffiliate(userId);
      
      return res.status(201).json(affiliate);
    } catch (error: unknown) {
      console.error("Affiliate registration error:", error);
      return res.status(500).json({ message: "Failed to register as affiliate" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/dashboard`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get affiliate dashboard data
      const dashboardStats = await affiliateService.getAffiliateDashboardStats(userId);
      
      return res.status(200).json(dashboardStats);
    } catch (error: unknown) {
      console.error("Affiliate dashboard error:", error);
      return res.status(500).json({ message: "Failed to load affiliate dashboard" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/referrals`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get affiliate referrals
      const referrals = await affiliateService.getAffiliateReferrals(userId);
      
      return res.status(200).json(referrals);
    } catch (error: unknown) {
      console.error("Affiliate referrals error:", error);
      return res.status(500).json({ message: "Failed to load referrals" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/payments`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get affiliate payments
      const payments = await affiliateService.getAffiliatePayments(userId);
      
      return res.status(200).json(payments);
    } catch (error: unknown) {
      console.error("Affiliate payments error:", error);
      return res.status(500).json({ message: "Failed to load payments" });
    }
  });
  
  app.post(`${apiPrefix}/affiliates/bank-details`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { bankName, accountNumber, accountName, bankCode, paymentMethod } = req.body;
      
      // Update bank details
      const result = await affiliateService.updateAffiliateBankDetails(
        userId,
        { bankName, accountNumber, accountName, bankCode, paymentMethod }
      );
      
      return res.status(200).json(result);
    } catch (error: unknown) {
      console.error("Update bank details error:", error);
      return res.status(500).json({ message: "Failed to update bank details" });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/verify`, async (req, res) => {
    try {
      const referralCode = req.query.code as string;
      
      if (!referralCode) {
        return res.status(400).json({ 
          isValid: false,
          message: "No referral code provided" 
        });
      }
      
      // Verify the referral code
      const affiliate = await affiliateService.getAffiliateByCode(referralCode);
      
      if (!affiliate) {
        return res.status(200).json({ 
          isValid: false,
          message: "Invalid referral code" 
        });
      }
      
      // Get the affiliate's user details to show the name
      const user = await storage.getUserById(affiliate.userId);
      
      return res.status(200).json({
        isValid: true,
        affiliateName: user?.fullName || "Partner",
        discount: 10, // 10% discount
        duration: 12  // 12 months
      });
    } catch (error: unknown) {
      console.error("Verify referral error:", error);
      return res.status(500).json({ 
        isValid: false,
        message: "Failed to verify referral code" 
      });
    }
  });
  
  app.get(`${apiPrefix}/affiliates/track-click`, async (req, res) => {
    try {
      const referralCode = req.query.code as string;
      const source = req.query.source as string;
      
      if (!referralCode) {
        // Return a transparent 1x1 pixel GIF
        res.set('Content-Type', 'image/gif');
        return res.send(Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
      }
      
      // Track the click
      await affiliateService.trackAffiliateClick(referralCode, source);
      
      // Return a transparent 1x1 pixel GIF
      res.set('Content-Type', 'image/gif');
      return res.send(Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
    } catch (error: unknown) {
      console.error("Track affiliate click error:", error);
      // Still return an image to avoid errors
      res.set('Content-Type', 'image/gif');
      return res.send(Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
    }
  });
  
  // Payment Webhooks for Paystack and Flutterwave
  // These routes are public and do not require authentication
  app.post(`${apiPrefix}/webhooks/paystack`, express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      // Since we're using express.raw, req.body is a Buffer
      const payload = req.body.toString();
      
      if (!signature) {
        return res.status(400).json({ message: "Missing signature header" });
      }
      
      // Process webhook
      const result = await webhookService.handlePaystackWebhook(signature, payload);
      
      // Always return 200 OK to prevent payment gateway retries, even if we couldn't process it
      // This is a common practice with webhook handlers to avoid unnecessary retries
      return res.status(200).json({ 
        success: result.success, 
        message: result.message,
        reference: result.reference,
        orderId: result.orderId
      });
    } catch (error: unknown) {
      console.error("Paystack webhook error:", error);
      // Still return 200 OK to prevent retries
      return res.status(200).json({ 
        success: false, 
        message: "Error processing webhook" 
      });
    }
  });
  
  app.post(`${apiPrefix}/webhooks/flutterwave`, express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['verif-hash'] as string;
      // Since we're using express.raw, req.body is a Buffer
      const payload = req.body.toString();
      
      if (!signature) {
        return res.status(400).json({ message: "Missing signature header" });
      }
      
      // Process webhook
      const result = await webhookService.handleFlutterwaveWebhook(signature, payload);
      
      // Always return 200 OK to prevent payment gateway retries
      return res.status(200).json({ 
        success: result.success, 
        message: result.message,
        reference: result.reference,
        orderId: result.orderId
      });
    } catch (error: unknown) {
      console.error("Flutterwave webhook error:", error);
      // Still return 200 OK to prevent retries
      return res.status(200).json({ 
        success: false, 
        message: "Error processing webhook" 
      });
    }
  });
  
  // Payment simulation route for development without payment gateways
  app.get('/payment-simulation', (req, res) => {
    const { reference, amount, plan } = req.query;
    
    // Render a simple form to simulate payment success or failure
    res.send(`
      <html>
        <head>
          <title>Payment Simulation</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            h1 { color: #0066cc; }
            .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .btn { display: inline-block; padding: 10px 20px; margin-right: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; cursor: pointer; }
            .btn-success { background: #4CAF50; color: white; border: none; }
            .btn-failure { background: #f44336; color: white; border: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Payment Simulation</h1>
            <p>In a real environment, users would be redirected to the payment gateway. This is a simulation for development.</p>
            
            <div class="details">
              <h3>Payment Details</h3>
              <p><strong>Reference:</strong> ${reference || 'Not provided'}</p>
              <p><strong>Amount:</strong> ${amount || '0'}</p>
              <p><strong>Plan:</strong> ${plan || 'Not specified'}</p>
            </div>
            
            <h3>Select Payment Outcome</h3>
            <form action="/api/payments/verify/${reference}/simulation" method="get">
              <input type="hidden" name="status" value="success">
              <input type="hidden" name="plan" value="${plan || 'basic'}">
              <input type="hidden" name="amount" value="${amount || '20000'}">
              <button type="submit" class="btn btn-success">Success</button>
            </form>
            <form action="/api/payments/verify/${reference}/simulation" method="get" style="margin-top: 10px;">
              <input type="hidden" name="status" value="failed">
              <button type="submit" class="btn btn-failure">Failure</button>
            </form>
          </div>
        </body>
      </html>
    `);
  });
  
  // Route to handle simulated payment verification
  app.get(`${apiPrefix}/payments/simulate-verify/:reference`, (req, res) => {
    const { reference } = req.params;
    const { status } = req.query;
    const redirectUrl = '/api/payments/verify/' + reference + '/simulation';
    
    // Handle the simulation results by redirecting to the verification endpoint
    res.redirect(redirectUrl);
  });
  
  app.post(`${apiPrefix}/webhooks/flutterwave`, async (req, res) => {
    try {
      const signature = req.headers['verif-hash'] as string;
      const payload = JSON.stringify(req.body);
      
      if (!signature) {
        return res.status(400).json({ message: "Missing signature header" });
      }
      
      // Process webhook
      const success = await webhookService.handleFlutterwaveWebhook(signature, payload);
      
      if (success) {
        return res.status(200).json({ message: "Webhook processed successfully" });
      } else {
        return res.status(400).json({ message: "Failed to process webhook" });
      }
    } catch (error: unknown) {
      console.error("Flutterwave webhook error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${apiPrefix}/ai/conversation`, isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const conversation = await storage.getAiConversation(userId) as { 
        id?: number;
        userId: number;
        messages: Array<{ role: string; content: string }>
      };
      
      if (!conversation) {
        // If no conversation exists, create one with a welcome message
        const welcomeMessage = "Hello! Welcome to ChainSync AI Assistant powered by Google Dialogflow. I can help you analyze sales data, check inventory levels, and monitor store performance. How can I assist you today?";
        
        // Create a new conversation with the welcome message
        await storage.saveAiConversation(userId, [
          { role: "assistant", content: welcomeMessage }
        ]);
        
        // Return the welcome message
        return res.status(200).json({ 
          messages: [{ role: "assistant", content: welcomeMessage }] 
        });
      }
      
      // Filter out system messages
      const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
      const userMessages = messages.filter(
        (msg: { role: string; content: string }) => msg.role !== "system"
      );
      
      return res.status(200).json({ messages: userMessages });
    } catch (error: unknown) {
      console.error("AI conversation error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========= Returns and Refunds API Routes =========
  
  // Get all return reasons
  app.get(`${apiPrefix}/returns/reasons`, isAuthenticated, async (req, res) => {
    try {
      const reasons = await storage.getAllReturnReasons();
      return res.json(reasons);
    } catch (error: unknown) {
      console.error('Error fetching return reasons:', error);
      return res.status(500).json({ error: 'Failed to fetch return reasons' });
    }
  });

  // Create a new return reason (admin only)
  app.post(`${apiPrefix}/returns/reasons`, isAdmin, async (req, res) => {
    try {
      const { name, description } = req.body;
      
      const reasonData = schema.returnReasonInsertSchema.parse({
        name,
        description,
        active: true
      });
      
      const reason = await storage.createReturnReason(reasonData);
      return res.status(201).json(reason);
    } catch (error: unknown) {
      console.error('Error creating return reason:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create return reason' });
    }
  });

  // ========= Loyalty Program API Routes =========
  
  // Customer enrollment in loyalty program
  app.post(`${apiPrefix}/loyalty/enroll`, isAuthenticated, async (req, res) => {
    try {
      const { customerId } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }
      
      // Get the user's store ID (cashiers are assigned to stores)
      const userId = req.session.userId;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Find customer to verify they exist
      const customer = await storage.getCustomerById(customerId);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Use customer's store ID if available, otherwise use user's assigned store
      const storeId = customer.storeId || user.storeId;
      
      if (!storeId) {
        return res.status(400).json({ error: 'No store associated with this customer or user' });
      }
      
      // Check if customer is already enrolled
      const existingMember = await storage.getLoyaltyMemberByCustomerId(customerId);
      
      if (existingMember) {
        return res.json({ 
          success: true, 
          member: existingMember,
          message: 'Customer is already enrolled in the loyalty program'
        });
      }
      
      // Enroll customer
      const member = await loyaltyService.enrollCustomer(customerId, storeId, userId);
      
      res.json({ 
        success: true, 
        member,
        message: 'Customer successfully enrolled in loyalty program'
      });
    } catch (error: unknown) {
      console.error('Error enrolling customer in loyalty program:', error);
      res.status(500).json({ error: 'Failed to enroll customer in loyalty program' });
    }
  });
  
  // Get loyalty member details
  app.get(`${apiPrefix}/loyalty/member/:id`, isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      let member;
      
      // Check if ID is numeric (member ID) or string (loyalty ID)
      if (/^\d+$/.test(id)) {
        member = await storage.getLoyaltyMemberById(parseInt(id));
      } else {
        member = await storage.getLoyaltyMemberByLoyaltyId(id);
      }
      
      if (!member) {
        return res.status(404).json({ error: 'Loyalty member not found' });
      }
      
      res.json(member);
    } catch (error: unknown) {
      console.error('Error fetching loyalty member:', error);
      res.status(500).json({ error: 'Failed to fetch loyalty member' });
    }
  });
  
  // Get loyalty member by customer ID
  app.get(`${apiPrefix}/loyalty/customer/:customerId`, isAuthenticated, async (req, res) => {
    try {
      const { customerId } = req.params;
      
      const member = await storage.getLoyaltyMemberByCustomerId(parseInt(customerId));
      
      if (!member) {
        return res.status(404).json({ error: 'Customer is not enrolled in loyalty program' });
      }
      
      res.json(member);
    } catch (error: unknown) {
      console.error('Error fetching loyalty member by customer ID:', error);
      res.status(500).json({ error: 'Failed to fetch loyalty member' });
    }
  });
  
  // Get loyalty member activity history
  app.get(`${apiPrefix}/loyalty/member/:id/activity`, isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      let memberId: number;
      
      // Check if ID is numeric (member ID) or string (loyalty ID)
      if (/^\d+$/.test(id)) {
        memberId = parseInt(id);
      } else {
        const member = await storage.getLoyaltyMemberByLoyaltyId(id);
        if (!member) {
          return res.status(404).json({ error: 'Loyalty member not found' });
        }
        memberId = member.id;
      }
      
      const transactions = await storage.getLoyaltyTransactions(memberId, limit, offset);
      
      res.json(transactions);
    } catch (error: unknown) {
      console.error('Error fetching loyalty transactions:', error);
      res.status(500).json({ error: 'Failed to fetch loyalty transactions' });
    }
  });
  
  // Get available rewards for a loyalty member
  app.get(`${apiPrefix}/loyalty/member/:id/rewards`, isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      let memberId: number;
      
      // Check if ID is numeric (member ID) or string (loyalty ID)
      if (/^\d+$/.test(id)) {
        memberId = parseInt(id);
      } else {
        const member = await storage.getLoyaltyMemberByLoyaltyId(id);
        if (!member) {
          return res.status(404).json({ error: 'Loyalty member not found' });
        }
        memberId = member.id;
      }
      
      const rewards = await loyaltyService.getAvailableRewards(memberId);
      
      res.json(rewards);
    } catch (error: unknown) {
      console.error('Error fetching available rewards:', error);
      res.status(500).json({ error: 'Failed to fetch available rewards' });
    }
  });
  
  // Apply reward to transaction
  app.post(`${apiPrefix}/loyalty/apply-reward`, isAuthenticated, async (req, res) => {
    try {
      const { memberId, rewardId, transactionId } = req.body;
      
      if (!memberId || !rewardId || !transactionId) {
        return res.status(400).json({ error: 'Member ID, reward ID, and transaction ID are required' });
      }
      
      const userId = req.session.userId;
      
      const result = await loyaltyService.applyReward(
        parseInt(memberId),
        parseInt(rewardId),
        parseInt(transactionId),
        userId
      );
      
      if (!result.success) {
        return res.status(400).json({ error: result.message || 'Failed to apply reward' });
      }
      
      res.json(result);
    } catch (error: unknown) {
      console.error('Error applying reward:', error);
      res.status(500).json({ error: 'Failed to apply reward' });
    }
  });
  
  // Calculate points for a transaction
  app.post(`${apiPrefix}/loyalty/calculate-points`, isAuthenticated, async (req, res) => {
    try {
      const { subtotal, storeId, items } = req.body;
      
      if (!subtotal || !storeId) {
        return res.status(400).json({ error: 'Subtotal and store ID are required' });
      }
      
      const points = await loyaltyService.calculatePointsForTransaction(
        subtotal,
        parseInt(storeId),
        items || []
      );
      
      res.json({ points });
    } catch (error: unknown) {
      console.error('Error calculating points:', error);
      res.status(500).json({ error: 'Failed to calculate points' });
    }
  });
  
  // Record points earned for a transaction
  app.post(`${apiPrefix}/loyalty/record-points`, isAuthenticated, async (req, res) => {
    try {
      const { transactionId, memberId, points } = req.body;
      
      if (!transactionId || !memberId || points === undefined) {
        return res.status(400).json({ error: 'Transaction ID, member ID, and points are required' });
      }
      
      const userId = req.session.userId;
      
      const result = await loyaltyService.recordPointsEarned(
        parseInt(transactionId),
        parseInt(memberId),
        parseInt(points),
        userId
      );
      
      if (!result.success) {
        return res.status(400).json({ error: 'Failed to record points' });
      }
      
      res.json(result);
    } catch (error: unknown) {
      console.error('Error recording points:', error);
      res.status(500).json({ error: 'Failed to record points' });
    }
  });
  
  // Get loyalty program for store
  app.get(`${apiPrefix}/loyalty/program/:storeId`, isAuthenticated, async (req, res) => {
    try {
      const { storeId } = req.params;
      
      const program = await storage.getLoyaltyProgram(parseInt(storeId));
      
      if (!program) {
        return res.status(404).json({ error: 'No active loyalty program found for this store' });
      }
      
      res.json(program);
    } catch (error: unknown) {
      console.error('Error fetching loyalty program:', error);
      res.status(500).json({ error: 'Failed to fetch loyalty program' });
    }
  });
  
  // Create or update loyalty program
  app.post(`${apiPrefix}/loyalty/program`, isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { storeId, name, pointsPerAmount, expiryMonths, active } = req.body;
      
      if (!storeId) {
        return res.status(400).json({ error: 'Store ID is required' });
      }
      
      const program = await loyaltyService.upsertLoyaltyProgram(parseInt(storeId), {
        name,
        pointsPerAmount,
        expiryMonths: expiryMonths ? parseInt(expiryMonths) : undefined,
        active
      });
      
      res.json({ success: true, program });
    } catch (error: unknown) {
      console.error('Error creating/updating loyalty program:', error);
      res.status(500).json({ error: 'Failed to create/update loyalty program' });
    }
  });
  
  // Create loyalty tier
  app.post(`${apiPrefix}/loyalty/tier`, isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { programId, name, requiredPoints, pointMultiplier, active } = req.body;
      
      if (!programId || !name || !requiredPoints) {
        return res.status(400).json({ error: 'Program ID, name, and required points are required' });
      }
      
      const tier = await loyaltyService.createLoyaltyTier({
        programId: parseInt(programId),
        name,
        requiredPoints,
        pointMultiplier,
        active: active !== undefined ? active : true
      });
      
      res.json({ success: true, tier });
    } catch (error: unknown) {
      console.error('Error creating loyalty tier:', error);
      res.status(500).json({ error: 'Failed to create loyalty tier' });
    }
  });
  
  // Create loyalty reward
  app.post(`${apiPrefix}/loyalty/reward`, isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { 
        programId, name, description, pointsCost, 
        discountValue, discountType, productId, active,
        startDate, endDate
      } = req.body;
      
      if (!programId || !name || !pointsCost) {
        return res.status(400).json({ error: 'Program ID, name, and points cost are required' });
      }
      
      const reward = await loyaltyService.createLoyaltyReward({
        programId: parseInt(programId),
        name,
        description,
        pointsCost,
        discountValue,
        discountType,
        productId: productId ? parseInt(productId) : undefined,
        active: active !== undefined ? active : true,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });
      
      res.json({ success: true, reward });
    } catch (error: unknown) {
      console.error('Error creating loyalty reward:', error);
      res.status(500).json({ error: 'Failed to create loyalty reward' });
    }
  });
  
  // Get loyalty analytics
  app.get(`${apiPrefix}/loyalty/analytics/:storeId`, isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const { storeId } = req.params;
      
      const analytics = await loyaltyService.getLoyaltyAnalytics(parseInt(storeId));
      
      res.json(analytics);
    } catch (error: unknown) {
      console.error('Error fetching loyalty analytics:', error);
      res.status(500).json({ error: 'Failed to fetch loyalty analytics' });
    }
  });

  // Get returns analytics
  app.get(`${apiPrefix}/returns/analytics`, isManagerOrAdmin, async (req, res) => {
    try {
      const { storeId } = req.query;
      const startDateParam = req.query.startDate as string;
      const endDateParam = req.query.endDate as string;
      
      // Parse dates if provided
      const startDate = startDateParam ? new Date(startDateParam) : undefined;
      const endDate = endDateParam ? new Date(endDateParam) : undefined;
      
      // Check store access if storeId is provided
      if (storeId && req.session.userRole !== 'admin') {
        if (req.session.storeId !== parseInt(storeId as string)) {
          return res.status(403).json({ error: 'You do not have access to this store' });
        }
      }
      
      const storeIdNumber = storeId ? parseInt(storeId as string) : undefined;
      
      const analytics = await storage.getReturnAnalytics(
        storeIdNumber,
        startDate,
        endDate
      );
      
      return res.json(analytics);
    } catch (error: unknown) {
      console.error('Error fetching returns analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch returns analytics' });
    }
  });

  // Get recent returns
  app.get(`${apiPrefix}/returns/recent`, isAuthenticated, async (req, res) => {
    try {
      const { limit } = req.query;
      let { storeId } = req.query;
      
      // If user is not admin or manager, force their storeId
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'manager') {
        storeId = req.session.storeId?.toString();
      }
      
      // If manager, ensure they only access their store
      if (req.session.userRole === 'manager' && storeId && 
          req.session.storeId !== parseInt(storeId as string)) {
        return res.status(403).json({ error: 'You do not have access to this store' });
      }
      
      const limitNumber = limit ? parseInt(limit as string) : 5;
      const storeIdNumber = storeId ? parseInt(storeId as string) : undefined;
      
      const returns = await storage.getRecentReturns(limitNumber, storeIdNumber);
      return res.json(returns);
    } catch (error: unknown) {
      console.error('Error fetching recent returns:', error);
      return res.status(500).json({ error: 'Failed to fetch recent returns' });
    }
  });

  // Get returns for a store with pagination
  app.get(`${apiPrefix}/returns/store/:storeId`, isAuthenticated, hasStoreAccess(), async (req, res) => {
    try {
      const { storeId } = req.params;
      const { page, limit, startDate, endDate } = req.query;
      
      const pageNumber = page ? parseInt(page as string) : 1;
      const limitNumber = limit ? parseInt(limit as string) : 20;
      const startDateObj = startDate ? new Date(startDate as string) : undefined;
      const endDateObj = endDate ? new Date(endDate as string) : undefined;
      
      const returns = await storage.getReturnsByStoreId(
        parseInt(storeId),
        startDateObj,
        endDateObj,
        pageNumber,
        limitNumber
      );
      
      return res.json(returns);
    } catch (error: unknown) {
      console.error('Error fetching store returns:', error);
      return res.status(500).json({ error: 'Failed to fetch store returns' });
    }
  });

  // Get a specific return by ID
  app.get(`${apiPrefix}/returns/:returnId`, isAuthenticated, async (req, res) => {
    try {
      const { returnId } = req.params;
      
      // Try to get by numeric ID first
      let returnData;
      if (!isNaN(parseInt(returnId))) {
        returnData = await storage.getReturnById(parseInt(returnId));
      } else {
        // If not a number, try to get by return ID string
        returnData = await storage.getReturnByReturnId(returnId);
      }
      
      if (!returnData) {
        return res.status(404).json({ error: 'Return not found' });
      }
      
      // Check access
      if (req.session.userRole !== 'admin' && returnData.storeId !== req.session.storeId) {
        return res.status(403).json({ error: 'You do not have access to this return' });
      }
      
      return res.json(returnData);
    } catch (error: unknown) {
      console.error('Error fetching return:', error);
      return res.status(500).json({ error: 'Failed to fetch return' });
    }
  });

  // Process a return
  app.post(`${apiPrefix}/returns`, isAuthenticated, async (req, res) => {
    try {
      const { originalTransactionId, storeId, customerId, totalRefundAmount, items, notes } = req.body;
      
      // Validate access
      if (req.session.userRole !== 'admin' && req.session.storeId !== storeId) {
        return res.status(403).json({ error: 'You do not have access to this store' });
      }
      
      // Generate unique return ID
      const returnId = `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Prepare return data
      const returnData = schema.returnInsertSchema.parse({
        returnId,
        originalTransactionId,
        storeId,
        processedBy: req.session.userId,
        customerId,
        totalRefundAmount,
        status: 'completed',
        notes,
        returnDate: new Date(),
        updatedAt: new Date()
      });
      
      // Prepare return items
      const returnItems = items.map((item: unknown) => schema.returnItemInsertSchema.parse({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        refundAmount: item.refundAmount,
        isPerishable: item.isPerishable,
        returnReasonId: item.returnReasonId,
        restocked: !item.isPerishable, // Only restock non-perishable items
        notes: item.notes
      }));
      
      // Create the return with items
      const returnResult = await storage.createReturn(returnData, returnItems);
      
      return res.status(201).json(returnResult);
    } catch (error: unknown) {
      console.error('Error processing return:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to process return' });
    }
  });

  // Update return status
  app.patch(`${apiPrefix}/returns/:returnId/status`, isManagerOrAdmin, async (req, res) => {
    try {
      const { returnId } = req.params;
      const { status } = req.body;
      
      if (!['processing', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be processing, completed, or cancelled' });
      }
      
      // Get the return to check access
      let returnData;
      if (!isNaN(parseInt(returnId))) {
        returnData = await storage.getReturnById(parseInt(returnId));
      } else {
        returnData = await storage.getReturnByReturnId(returnId);
      }
      
      if (!returnData) {
        return res.status(404).json({ error: 'Return not found' });
      }
      
      // Check access for managers
      if (req.session.userRole === 'manager' && returnData.storeId !== req.session.storeId) {
        return res.status(403).json({ error: 'You do not have access to this return' });
      }
      
      // Update the status
      const updatedReturn = await storage.updateReturnStatus(returnData.id, status);
      
      return res.json(updatedReturn);
    } catch (error: unknown) {
      console.error('Error updating return status:', error);
      return res.status(500).json({ error: 'Failed to update return status' });
    }
  });

  // Customer lookup by email or phone
  app.get(`${apiPrefix}/customers/lookup`, isAuthenticated, async (req, res) => {
    try {
      const { email, phone } = req.query;
      
      if (!email && !phone) {
        return res.status(400).json({ error: 'Email or phone is required for customer lookup' });
      }
      
      let customer;
      if (email) {
        customer = await storage.getCustomerByEmail(email as string);
      } else if (phone) {
        customer = await storage.getCustomerByPhone(phone as string);
      }
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Validate store access for non-admins
      if (req.session.userRole !== 'admin' && customer.storeId !== req.session.storeId) {
        return res.status(403).json({ error: 'You do not have access to this customer' });
      }
      
      return res.json(customer);
    } catch (error: unknown) {
      console.error('Error looking up customer:', error);
      return res.status(500).json({ error: 'Failed to lookup customer' });
    }
  });

  // Create or update customer
  app.post(`${apiPrefix}/customers`, isAuthenticated, async (req, res) => {
    try {
      const { fullName, email, phone, storeId } = req.body;
      
      // Validate access
      if (req.session.userRole !== 'admin' && req.session.storeId !== storeId) {
        return res.status(403).json({ error: 'You do not have access to this store' });
      }
      
      // Check if customer already exists
      let customer;
      if (email) {
        customer = await storage.getCustomerByEmail(email);
      }
      
      if (!customer && phone) {
        customer = await storage.getCustomerByPhone(phone);
      }
      
      if (customer) {
        // Return existing customer
        return res.status(200).json(customer);
      }
      
      // Create new customer
      const customerData = schema.customerInsertSchema.parse({
        fullName,
        email,
        phone,
        storeId,
        updatedAt: new Date()
      });
      
      const newCustomer = await storage.createCustomer(customerData);
      return res.status(201).json(newCustomer);
    } catch (error: unknown) {
      console.error('Error creating customer:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create customer' });
    }
  });

  // Configure multer for file uploads
  const fileStorage = multer.memoryStorage();
  const upload = multer({
    storage: fileStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB file size limit
    },
    fileFilter: (_req, file, cb) => {
      // Accept only CSV and Excel files
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream'
      ];
      
      if (allowedTypes.includes(file.mimetype) || 
          file.originalname.endsWith('.csv') || 
          file.originalname.endsWith('.xlsx') || 
          file.originalname.endsWith('.xls')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV and Excel files are allowed'));
      }
    }
  });

  // Data Import Routes
  
  // Upload and analyze file for import
  app.post(`${apiPrefix}/import/analyze`, isAuthenticated, isManagerOrAdmin, upload.single('file'), async (req: express.Request, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { dataType } = req.body;
      if (!dataType || !['loyalty', 'inventory'].includes(dataType)) {
        return res.status(400).json({ error: 'Invalid data type. Must be either "loyalty" or "inventory"' });
      }

      // Ensure file buffer exists
      if (!req.file.buffer) {
        return res.status(400).json({ error: 'File buffer is missing' });
      }

      const result = await processImportFile(
        Buffer.from(req.file.buffer),
        req.file.mimetype,
        dataType as 'loyalty' | 'inventory'
      );

      return res.status(200).json(result);
    } catch (error: unknown) {
      console.error('Error analyzing import file:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to analyze file' });
    }
  });

  // Validate mapped data
  app.post(`${apiPrefix}/import/validate`, isAuthenticated, isManagerOrAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const { data, mapping, dataType } = req.body;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'No data provided' });
      }
      
      if (!mapping || typeof mapping !== 'object') {
        return res.status(400).json({ error: 'No column mapping provided' });
      }
      
      if (!dataType || !['loyalty', 'inventory'].includes(dataType)) {
        return res.status(400).json({ error: 'Invalid data type. Must be either "loyalty" or "inventory"' });
      }
      
      // Apply column mapping
      const mappedData = applyColumnMapping(data, mapping);
      
      // Validate data based on type (using AI-powered validation)
      const validationResult = await (dataType === 'loyalty' 
        ? validateLoyaltyData(mappedData)
        : validateInventoryData(mappedData));
      
      return res.status(200).json(validationResult);
    } catch (error: unknown) {
      console.error('Error validating import data:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to validate data' });
    }
  });

  // Import validated data
  app.post(`${apiPrefix}/import/process`, isAuthenticated, isManagerOrAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const { data, dataType, storeId } = req.body;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'No data provided' });
      }
      
      if (!dataType || !['loyalty', 'inventory'].includes(dataType)) {
        return res.status(400).json({ error: 'Invalid data type. Must be either "loyalty" or "inventory"' });
      }
      
      if (!storeId) {
        return res.status(400).json({ error: 'Store ID is required' });
      }
      
      // Validate store access for non-admins
      if (req.session.userRole !== 'admin' && req.session.storeId !== parseInt(storeId)) {
        return res.status(403).json({ error: 'You do not have access to this store' });
      }
      
      // Import data
      const importResult = dataType === 'loyalty'
        ? await importLoyaltyData(data, parseInt(storeId))
        : await importInventoryData(data, parseInt(storeId));
      
      return res.status(200).json({
        success: importResult.success,
        totalRows: importResult.totalRows,
        importedRows: importResult.importedRows,
        errors: importResult.errors,
        lastUpdated: importResult.lastUpdated || new Date(),
        message: importResult.success 
          ? `Successfully imported ${importResult.importedRows} of ${importResult.totalRows} rows` 
          : 'Import completed with errors'
      });
    } catch (error: unknown) {
      console.error('Error importing data:', error);
      return res.status(500).json({ error: error.message || 'Failed to import data' });
    }
  });

  // Download error report
  app.post(`${apiPrefix}/import/error-report`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const { validationResult, dataType } = req.body;
      
      if (!validationResult || (!validationResult.errors?.length && !validationResult.missingFields?.length)) {
        return res.status(400).json({ error: 'No error data provided' });
      }
      
      if (!dataType || !['loyalty', 'inventory'].includes(dataType)) {
        return res.status(400).json({ error: 'Invalid data type. Must be either "loyalty" or "inventory"' });
      }
      
      // Generate a comprehensive error report
      const errorReport = generateErrorReport(validationResult, dataType as 'loyalty' | 'inventory');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="import-errors.csv"');
      return res.status(200).send(errorReport);
    } catch (error: unknown) {
      console.error('Error generating error report:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate error report' });
    }
  });

  // Product Import Routes
  app.post(`${apiPrefix}/products/import/validate`, isAuthenticated, isManagerOrAdmin, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Read the uploaded file
      const fileContent = req.file.buffer.toString();
      
      // Use the user's store ID if they're not an admin
      const storeId = req.user?.role === 'admin' ? 1 : (req.user?.storeId || 1);
      
      // Validate the CSV
      const { validProducts, summary } = await validateProductImportCSV(fileContent, storeId);
      
      res.status(200).json({ 
        validProducts,
        summary,
        message: 'Validation completed'
      });
    } catch (error: unknown) {
      console.error('Error validating product import:', error);
      res.status(500).json({ 
        message: 'Error validating CSV file', 
        error: error.message 
      });
    }
  });
  
  // Process product import
  app.post(`${apiPrefix}/products/import/process`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const { products, storeId, createCategories } = req.body;
      
      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: 'No valid products to import' });
      }
      
      if (!storeId) {
        return res.status(400).json({ message: 'Store ID is required' });
      }
      
      // Import products
      const result = await importProducts(products, storeId);
      
      res.status(200).json(result);
    } catch (error: unknown) {
      console.error('Error importing products:', error);
      res.status(500).json({ 
        message: 'Error importing products', 
        error: error.message,
        success: false,
        importedCount: 0,
        failedProducts: []
      });
    }
  });
  
  // Generate error report for product import
  app.post(`${apiPrefix}/products/import/error-report`, isAuthenticated, isManagerOrAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const { errors } = req.body;
      
      if (!Array.isArray(errors)) {
        return res.status(400).json({ message: 'Invalid error data format' });
      }
      
      // Generate the CSV content
      const csvStringify = require('csv-stringify/sync').stringify;
      const csvContent = csvStringify(errors, {
        header: true,
        columns: ['row', 'field', 'value', 'message']
      });
      
      // Set the appropriate headers for a CSV file download
      res.setHeader('Content-Disposition', `attachment; filename=product-import-errors-${Date.now()}.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.send(csvContent);
    } catch (error: unknown) {
      console.error('Error generating product import error report:', error);
      res.status(500).json({ message: 'Failed to generate error report' });
    }
  });

  // Batch inventory management routes
  app.get(`${apiPrefix}/inventory/batches`, isAuthenticated, async (req: express.Request, res: express.Response) => {
    try {
      const storeId = parseInt(req.query.storeId as string);
      const productId = parseInt(req.query.productId as string);
      const includeExpired = req.query.includeExpired === 'true';
      
      if (isNaN(storeId) || isNaN(productId)) {
        return res.status(400).json({
          message: 'Invalid store ID or product ID'
        });
      }
      
      const batches = await storage.getInventoryBatchesByProduct(storeId, productId, includeExpired);
      return res.json(batches);
    } catch (error: unknown) {
      console.error('Error fetching batches:', error);
      return res.status(500).json({
        message: 'Failed to fetch batch inventory data'
      });
    }
  });
  
  app.post(`${apiPrefix}/inventory/batches`, isAuthenticated, isManagerOrAdmin, async (req: express.Request, res: express.Response) => {
    try {
      const { storeId, productId, batchNumber, quantity, expiryDate, manufacturingDate, costPerUnit } = req.body;
      
      // Validate required fields
      if (typeof storeId !== 'number' || typeof productId !== 'number' || !batchNumber || typeof quantity !== 'number') {
        return res.status(400).json({
          message: 'Missing required fields: storeId, productId, batchNumber, and quantity are required'
        });
      }
      
      if (quantity <= 0) {
        return res.status(400).json({
          message: 'Quantity must be a positive number'
        });
      }
      
      // Validate expiry date if provided
      if (expiryDate) {
        const expiryDateObj = new Date(expiryDate);
        const today = new Date();
        
        if (isNaN(expiryDateObj.getTime())) {
          return res.status(400).json({
            message: 'Invalid expiry date format'
          });
        }
        
        if (expiryDateObj < today) {
          return res.status(400).json({
            message: 'Expiry date cannot be in the past'
          });
        }
      }
      
      // Get product details for the audit log
      const product = await storage.getProductById(productId);
      if (!product) {
        return res.status(404).json({
          message: 'Product not found'
        });
      }
      
      // Get store details for the audit log
      const store = await storage.getStoreById(storeId);
      if (!store) {
        return res.status(404).json({
          message: 'Store not found'
        });
      }
      
      const batchService = await import('./services/inventory-batch');
      const newBatch = await batchService.addBatch({
        storeId,
        productId,
        batchNumber,
        quantity,
        expiryDate,
        manufacturingDate,
        costPerUnit
      });
      
      // Create audit log entry
      await storage.createBatchAuditLog({
        batchId: newBatch.id,
        userId: req.session.userId,
        action: 'create',
        details: {
          batchNumber,
          productName: product.name,
          storeName: store.name,
          expiryDate: expiryDate || 'Not specified'
        },
        quantityBefore: 0,
        quantityAfter: quantity
      });
      
      return res.status(201).json(newBatch);
    } catch (error: unknown) {
      console.error('Error adding batch:', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to add batch'
      });
    }
  });
  
  app.post(`${apiPrefix}/inventory/batches/import`, isAuthenticated, isManagerOrAdmin, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }
      
      const batchService = await import('./services/batch-inventory');
      const validationResult = await batchService.validateBatchImportFile(req.file.path);
      
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          message: 'File validation failed',
          errors: validationResult.errors.map(e => `Row ${e.row}: ${e.errors.join(', ')}`)
        });
      }
      
      const importResult = await batchService.importBatchInventory(validationResult.data);
      return res.json(importResult);
    } catch (error: unknown) {
      console.error('Error importing batch inventory:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import batch inventory data'
      });
    }
  });
  
  app.patch(`${apiPrefix}/inventory/batches/:batchId`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId);
      
      if (isNaN(batchId)) {
        return res.status(400).json({
          message: 'Invalid batch ID'
        });
      }
      
      // Get the current batch for audit logging and validation
      const currentBatch = await storage.getInventoryBatchById(batchId);
      if (!currentBatch) {
        return res.status(404).json({
          message: 'Batch not found'
        });
      }
      
      const { quantity, expiryDate, costPerUnit } = req.body;
      const updateData: Record<string, any> = {};
      
      if (quantity !== undefined) {
        if (isNaN(parseInt(quantity)) || parseInt(quantity) < 0) {
          return res.status(400).json({
            message: 'Quantity must be a non-negative number'
          });
        }
        updateData.quantity = parseInt(quantity);
      }
      
      if (expiryDate !== undefined) {
        // Validate expiry date if provided
        if (expiryDate) {
          const expiryDateObj = new Date(expiryDate);
          const today = new Date();
          
          if (isNaN(expiryDateObj.getTime())) {
            return res.status(400).json({
              message: 'Invalid expiry date format'
            });
          }
          
          if (expiryDateObj < today) {
            return res.status(400).json({
              message: 'Expiry date cannot be in the past'
            });
          }
        }
        updateData.expiryDate = expiryDate;
      }
      
      if (costPerUnit !== undefined) {
        updateData.costPerUnit = costPerUnit;
      }
      
      // Get inventory details for the audit log
      const inventory = await storage.getInventoryItemById(currentBatch.inventoryId);
      if (!inventory) {
        return res.status(404).json({
          message: 'Inventory record not found'
        });
      }
      
      // Get product details for the audit log
      const product = await storage.getProductById(inventory.productId);
      
      const batchService = await import('./services/inventory-batch');
      const updatedBatch = await batchService.updateBatch(batchId, updateData);
      
      // Create audit log entry
      await storage.createBatchAuditLog({
        batchId: updatedBatch.id,
        userId: req.session.userId,
        action: 'update',
        details: {
          batchNumber: updatedBatch.batchNumber,
          productName: product ? product.name : 'Unknown Product',
          changes: Object.keys(updateData).map(key => ({
            field: key,
            oldValue: currentBatch[key],
            newValue: updateData[key]
          }))
        },
        quantityBefore: quantity !== undefined ? currentBatch.quantity : undefined,
        quantityAfter: quantity !== undefined ? parseInt(quantity) : undefined
      });
      
      return res.json(updatedBatch);
    } catch (error: unknown) {
      console.error('Error updating batch:', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to update batch'
      });
    }
  });
  
  app.post(`${apiPrefix}/inventory/batches/:batchId/adjust`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId);
      const { quantity, reason } = req.body;
      
      if (isNaN(batchId)) {
        return res.status(400).json({
          message: 'Invalid batch ID'
        });
      }
      
      if (quantity === undefined || isNaN(parseInt(quantity))) {
        return res.status(400).json({
          message: 'Quantity must be a number'
        });
      }
      
      const batchService = await import('./services/inventory-batch');
      const updatedBatch = await batchService.adjustBatchStock({
        batchId,
        quantity: parseInt(quantity),
        reason: reason || 'Manual adjustment'
      });
      
      return res.json(updatedBatch);
    } catch (error: unknown) {
      console.error('Error adjusting batch stock:', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to adjust batch stock'
      });
    }
  });
  
  app.delete(`${apiPrefix}/inventory/batches/:batchId`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId);
      const forceDelete = req.query.force === 'true';
      
      if (isNaN(batchId)) {
        return res.status(400).json({
          message: 'Invalid batch ID'
        });
      }
      
      // Get the current batch to retrieve its inventory ID
      const currentBatch = await storage.getInventoryBatchById(batchId);
      if (!currentBatch) {
        return res.status(404).json({
          message: 'Batch not found'
        });
      }
      
      // Prevent deletion of batch with non-zero quantity
      if (currentBatch.quantity > 0 && !forceDelete) {
        return res.status(400).json({
          message: 'Cannot delete batch with non-zero quantity. Adjust quantity to zero first or use force=true parameter.',
          nonZeroQuantity: true,
          currentQuantity: currentBatch.quantity
        });
      }
      
      // Get inventory details for the audit log
      const inventory = await storage.getInventoryItemById(currentBatch.inventoryId);
      if (!inventory) {
        return res.status(404).json({
          message: 'Inventory record not found'
        });
      }
      
      // Get product details for the audit log
      const product = await storage.getProductById(inventory.productId);
      
      // Create audit log entry before deletion
      await storage.createBatchAuditLog({
        batchId: currentBatch.id,
        userId: req.session.userId,
        action: 'delete',
        details: {
          batchNumber: currentBatch.batchNumber,
          productName: product ? product.name : 'Unknown Product',
          wasForceDeleted: forceDelete,
          quantityLost: currentBatch.quantity > 0 ? currentBatch.quantity : 0
        },
        quantityBefore: currentBatch.quantity,
        quantityAfter: 0
      });
      
      // Delete the batch
      await storage.deleteInventoryBatch(batchId);
      
      // Update inventory total quantity
      await storage.updateInventoryTotalQuantity(currentBatch.inventoryId);
      
      return res.status(200).json({
        message: 'Batch deleted successfully'
      });
    } catch (error: unknown) {
      console.error('Error deleting batch:', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to delete batch'
      });
    }
  });
  
  // Get batch audit logs
  app.get(`${apiPrefix}/inventory/batches/:batchId/audit-logs`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId);
      
      if (isNaN(batchId)) {
        return res.status(400).json({
          message: 'Invalid batch ID'
        });
      }
      
      // Check if batch exists
      const batch = await storage.getInventoryBatchById(batchId);
      if (!batch) {
        return res.status(404).json({
          message: 'Batch not found'
        });
      }
      
      // Get audit logs for the batch
      // TODO: Ensure `storage.getBatchAuditLogs` is correctly defined and exported in `server/storage.ts`
      const auditLogs = await storage.getBatchAuditLogs(batchId);
      
      return res.json(auditLogs);
    } catch (error: unknown) {
      console.error('Error fetching batch audit logs:', error);
      return res.status(500).json({
        message: 'Failed to fetch batch audit logs'
      });
    }
  });

  // Create secure server based on environment
  const httpServer = setupSecureServer(app);

  // Error handling middleware should be the last middleware
  app.use(errorHandler);

  return httpServer;
}
