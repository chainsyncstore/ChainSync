import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import { z } from "zod";
import { ZodError } from "zod-validation-error";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import { isAuthenticated, isAdmin, isManagerOrAdmin, hasStoreAccess, validateSession } from "./middleware/auth";
import { getAIResponse } from "./services/ai";

// Import affiliate services
import * as affiliateService from './services/affiliate';
import * as webhookService from './services/webhooks';

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );
  
  // Apply session validation middleware
  app.use(validateSession);

  // Define API routes
  const apiPrefix = "/api";

  // ----------- Authentication Routes -----------
  
  app.post(`${apiPrefix}/auth/login`, async (req, res) => {
    try {
      const loginData = schema.loginSchema.parse(req.body);
      
      const user = await storage.validateUserCredentials(
        loginData.username,
        loginData.password
      );
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Update last login timestamp
      await storage.updateUserLastLogin(user.id);
      
      // Set session data
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.storeId = user.storeId || undefined;
      req.session.fullName = user.fullName;
      
      return res.status(200).json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
      });
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
        role: userRole,
        status: 'active'
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
      
      // Validate transaction data
      const validatedTransaction = schema.transactionInsertSchema.parse({
        ...transactionData,
        storeId,
        cashierId: userId
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
        role: 'admin', // New users are admins of their own chain
        status: 'active'
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

  const httpServer = createServer(app);

  return httpServer;
}
