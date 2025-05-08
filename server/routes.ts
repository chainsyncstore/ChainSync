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
