import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { z } from "zod";
import { ZodError } from "zod-validation-error";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import { pool } from "@db";
import { isAuthenticated, isAdmin, isManagerOrAdmin, hasStoreAccess, validateSession } from "./middleware/auth";
import { getAIResponse } from "./services/ai";
import multer from "multer";
import path from "path";

// Import services
import * as affiliateService from './services/affiliate';
import * as webhookService from './services/webhooks';
import * as paymentService from './services/payment';
import * as loyaltyService from "./services/loyalty";
import { 
  processImportFile, 
  applyColumnMapping, 
  validateLoyaltyData, 
  validateInventoryData,
  importLoyaltyData,
  importInventoryData,
  formatErrorsAsCsv,
  formatMissingFieldsAsCsv
} from "./services/import";

import { db } from "@db";
import { eq, and, desc, sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up PostgreSQL session store
  const PostgresStore = pgSession(session);
  
  // Set up session middleware
  app.use(
    session({
      store: new PostgresStore({
        pool,
        createTableIfMissing: true,
        tableName: 'session'
      }),
      secret: process.env.SESSION_SECRET || "dev-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Only set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      },
      name: 'chainsync.sid' // Custom name to avoid conflicts
    })
  );
  
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error fetching member details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/member/:id/activity', isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const activity = await loyaltyService.getMemberActivityHistory(memberId);
      
      res.json(activity);
    } catch (error) {
      console.error("Error fetching member activity:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/loyalty/member/:id/rewards', isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const rewards = await loyaltyService.getAvailableRewards(memberId);
      
      res.json(rewards);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Error enrolling customer:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/program/:storeId', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const programData = req.body;
      
      const program = await loyaltyService.upsertLoyaltyProgram(storeId, programData);
      
      res.json(program);
    } catch (error) {
      console.error("Error creating/updating loyalty program:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/reward', isAuthenticated, isManagerOrAdmin, async (req, res) => {
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
    } catch (error) {
      console.error("Error creating loyalty reward:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/loyalty/tier', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
      const tierData = req.body;
      
      // Create tier
      const tier = await loyaltyService.createLoyaltyTier(tierData);
      
      res.json(tier);
    } catch (error) {
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
    } catch (error) {
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
      } catch (sessionError) {
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
      } catch (sessionError) {
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
    } catch (error) {
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
    } catch (error) {
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
      } catch (sessionError) {
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
      } catch (sessionError) {
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
    } catch (error) {
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
  
  app.post(`${apiPrefix}/auth/signup`, async (req, res) => {
    try {
      const { username, password, email, fullName, role, becomeAffiliate } = req.body;
      
      if (!username || !password || !email || !fullName) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Check if username is already taken
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      // Use affiliate role if specified, otherwise default to regular user
      const userRole = role === 'affiliate' ? 'affiliate' : 'user';
      
      // Create the user
      const userData: schema.UserInsert = {
        username,
        password,
        email,
        fullName,
        role: userRole
      };
      
      const newUser = await storage.createUser(userData);
      
      // Auto-register as affiliate if flag is set
      if (becomeAffiliate) {
        try {
          const { registerAffiliate } = await import('./services/affiliate');
          await registerAffiliate(newUser.id);
        } catch (affiliateError) {
          console.error("Error registering affiliate:", affiliateError);
          // We continue anyway since the user is created
        }
      }
      
      // Set session data - auto-login
      req.session.userId = newUser.id;
      req.session.userRole = newUser.role;
      req.session.storeId = newUser.storeId || undefined;
      req.session.fullName = newUser.fullName;
      
      // Return the new user (without password)
      const { password: _, ...userWithoutPassword } = newUser;
      
      return res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        storeId: newUser.storeId,
      });
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({ message: "Failed to create account" });
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
      
      res.clearCookie("connect.sid");
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });
  
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
    } catch (error) {
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
        } catch (e) {
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
    } catch (error) {
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
    } catch (error) {
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
      const transactions = await storage.getRecentTransactions(limit, targetStoreId);
      
      return res.status(200).json(transactions);
    } catch (error) {
      console.error("Recent transactions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Store Routes -----------
  
  app.get(`${apiPrefix}/stores`, isAuthenticated, async (req, res) => {
    try {
      const stores = await storage.getAllStores();
      return res.status(200).json(stores);
    } catch (error) {
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
    } catch (error) {
      console.error("Get store error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post(`${apiPrefix}/stores`, isAdmin, async (req, res) => {
    try {
      const storeData = schema.storeInsertSchema.parse(req.body);
      const newStore = await storage.createStore(storeData);
      
      return res.status(201).json(newStore);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Get low stock error:", error);
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
    } catch (error) {
      console.error("Update inventory error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- Product Routes -----------
  
  app.get(`${apiPrefix}/products`, isAuthenticated, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      return res.status(200).json(products);
    } catch (error) {
      console.error("Get products error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/products/barcode/:barcode`, isAuthenticated, async (req, res) => {
    try {
      const { barcode } = req.params;
      
      const product = await storage.getProductByBarcode(barcode);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.status(200).json(product);
    } catch (error) {
      console.error("Get product by barcode error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get(`${apiPrefix}/products/search`, isAuthenticated, async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        return res.status(400).json({ message: "Search term is required" });
      }
      
      const products = await storage.searchProducts(searchTerm);
      return res.status(200).json(products);
    } catch (error) {
      console.error("Search products error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ----------- POS Routes -----------
  
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
      
      // Validate each item
      const validatedItems = [];
      for (const item of items) {
        const validatedItem = schema.transactionItemInsertSchema.parse(item);
        validatedItems.push(validatedItem);
      }
      
      const result = await storage.createTransaction(
        validatedTransaction,
        validatedItems
      );
      
      return res.status(201).json(result);
    } catch (error) {
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
        } catch (error) {
          console.error("Error syncing transaction:", error);
          results.push({
            success: false,
            offlineId: transaction.offlineId,
            error: "Failed to sync transaction"
          });
        }
      }
      
      return res.status(200).json({ results });
    } catch (error) {
      console.error("Sync offline transactions error:", error);
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
      const { username, password, email, fullName, plan, referralCode } = req.body;
      
      if (!username || !password || !email || !fullName || !plan) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error("Track affiliate click error:", error);
      // Still return an image to avoid errors
      res.set('Content-Type', 'image/gif');
      return res.send(Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
    }
  });
  
  // Payment Webhooks for Paystack and Flutterwave
  app.post(`${apiPrefix}/webhooks/paystack`, async (req, res) => {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      const payload = JSON.stringify(req.body);
      
      if (!signature) {
        return res.status(400).json({ message: "Missing signature header" });
      }
      
      // Process webhook
      const success = await webhookService.handlePaystackWebhook(signature, payload);
      
      if (success) {
        return res.status(200).json({ message: "Webhook processed successfully" });
      } else {
        return res.status(400).json({ message: "Failed to process webhook" });
      }
    } catch (error) {
      console.error("Paystack webhook error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
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
    } catch (error) {
      console.error("Flutterwave webhook error:", error);
      return res.status(500).json({ message: "Internal server error" });
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
      const returnItems = items.map((item: any) => schema.returnItemInsertSchema.parse({
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
  app.post(`${apiPrefix}/import/analyze`, isAuthenticated, isManagerOrAdmin, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { dataType } = req.body;
      if (!dataType || !['loyalty', 'inventory'].includes(dataType)) {
        return res.status(400).json({ error: 'Invalid data type. Must be either "loyalty" or "inventory"' });
      }

      const result = await processImportFile(
        req.file.buffer,
        req.file.mimetype,
        dataType as 'loyalty' | 'inventory'
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error analyzing import file:', error);
      return res.status(500).json({ error: error.message || 'Failed to analyze file' });
    }
  });

  // Validate mapped data
  app.post(`${apiPrefix}/import/validate`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
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
    } catch (error) {
      console.error('Error validating import data:', error);
      return res.status(500).json({ error: error.message || 'Failed to validate data' });
    }
  });

  // Import validated data
  app.post(`${apiPrefix}/import/process`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
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
        message: importResult.success 
          ? `Successfully imported ${importResult.importedRows} of ${importResult.totalRows} rows` 
          : 'Import completed with errors'
      });
    } catch (error) {
      console.error('Error importing data:', error);
      return res.status(500).json({ error: error.message || 'Failed to import data' });
    }
  });

  // Download error report
  app.post(`${apiPrefix}/import/error-report`, isAuthenticated, isManagerOrAdmin, async (req: Request, res: Response) => {
    try {
      const { errors, missingFields } = req.body;
      
      if ((!errors || !Array.isArray(errors)) && (!missingFields || !Array.isArray(missingFields))) {
        return res.status(400).json({ error: 'No error data provided' });
      }
      
      let errorsCsv = '';
      let missingFieldsCsv = '';
      
      if (errors && errors.length > 0) {
        errorsCsv = formatErrorsAsCsv(errors);
      }
      
      if (missingFields && missingFields.length > 0) {
        missingFieldsCsv = formatMissingFieldsAsCsv(missingFields);
      }
      
      // Create a combined CSV if both are present
      let combinedCsv = '';
      if (errorsCsv && missingFieldsCsv) {
        combinedCsv = errorsCsv + '\n\nMissing Fields:\n' + missingFieldsCsv;
      } else {
        combinedCsv = errorsCsv || missingFieldsCsv;
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="import-errors.csv"');
      return res.status(200).send(combinedCsv);
    } catch (error) {
      console.error('Error generating error report:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate error report' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
