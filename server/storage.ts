import { db } from "@db";
import * as schema from "@shared/schema";
import { eq, and, or, desc, lte, gte, sql, like, count, isNull, not } from "drizzle-orm";
import * as bcrypt from "bcrypt";

export const storage = {
  // ----------- Affiliate Methods -----------
  
  async getAffiliateByUserId(userId: number) {
    try {
      const [affiliate] = await db.select()
        .from(schema.affiliates)
        .where(eq(schema.affiliates.userId, userId))
        .limit(1);
      
      return affiliate || null;
    } catch (error) {
      console.error("Error getting affiliate by user ID:", error);
      throw error;
    }
  },
  
  async getAffiliateByCode(code: string) {
    try {
      const [affiliate] = await db.select()
        .from(schema.affiliates)
        .where(eq(schema.affiliates.code, code))
        .limit(1);
      
      return affiliate || null;
    } catch (error) {
      console.error("Error getting affiliate by code:", error);
      throw error;
    }
  },
  
  async createAffiliate(data: schema.AffiliateInsert) {
    try {
      const [affiliate] = await db.insert(schema.affiliates)
        .values(data)
        .returning();
      
      return affiliate;
    } catch (error) {
      console.error("Error creating affiliate:", error);
      throw error;
    }
  },
  
  async updateAffiliate(affiliateId: number, data: Partial<schema.AffiliateInsert>) {
    try {
      const [updatedAffiliate] = await db.update(schema.affiliates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.affiliates.id, affiliateId))
        .returning();
      
      return updatedAffiliate;
    } catch (error) {
      console.error("Error updating affiliate:", error);
      throw error;
    }
  },
  
  async getReferralsByAffiliateId(affiliateId: number) {
    try {
      const referrals = await db.select({
        id: schema.referrals.id,
        status: schema.referrals.status,
        signupDate: schema.referrals.signupDate,
        activationDate: schema.referrals.activationDate,
        expiryDate: schema.referrals.expiryDate,
        username: schema.users.username,
        fullName: schema.users.fullName
      })
      .from(schema.referrals)
      .leftJoin(schema.users, eq(schema.referrals.referredUserId, schema.users.id))
      .where(eq(schema.referrals.affiliateId, affiliateId))
      .orderBy(desc(schema.referrals.signupDate));
      
      return referrals;
    } catch (error) {
      console.error("Error getting referrals by affiliate ID:", error);
      throw error;
    }
  },
  
  async createReferral(data: schema.ReferralInsert) {
    try {
      const [referral] = await db.insert(schema.referrals)
        .values(data)
        .returning();
      
      return referral;
    } catch (error) {
      console.error("Error creating referral:", error);
      throw error;
    }
  },
  
  async updateReferral(referralId: number, data: Partial<schema.ReferralInsert>) {
    try {
      const [updatedReferral] = await db.update(schema.referrals)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.referrals.id, referralId))
        .returning();
      
      return updatedReferral;
    } catch (error) {
      console.error("Error updating referral:", error);
      throw error;
    }
  },
  
  async getSubscriptionByUserId(userId: number) {
    try {
      const [subscription] = await db.select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, userId))
        .orderBy(desc(schema.subscriptions.createdAt))
        .limit(1);
      
      return subscription || null;
    } catch (error) {
      console.error("Error getting subscription by user ID:", error);
      throw error;
    }
  },
  
  async createSubscription(data: schema.SubscriptionInsert) {
    try {
      const [subscription] = await db.insert(schema.subscriptions)
        .values(data)
        .returning();
      
      return subscription;
    } catch (error) {
      console.error("Error creating subscription:", error);
      throw error;
    }
  },
  
  async updateSubscription(subscriptionId: number, data: Partial<schema.SubscriptionInsert>) {
    try {
      const [updatedSubscription] = await db.update(schema.subscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.subscriptions.id, subscriptionId))
        .returning();
      
      return updatedSubscription;
    } catch (error) {
      console.error("Error updating subscription:", error);
      throw error;
    }
  },
  
  async getReferralPaymentsByAffiliateId(affiliateId: number) {
    try {
      const payments = await db.select()
        .from(schema.referralPayments)
        .where(eq(schema.referralPayments.affiliateId, affiliateId))
        .orderBy(desc(schema.referralPayments.createdAt));
      
      return payments;
    } catch (error) {
      console.error("Error getting referral payments by affiliate ID:", error);
      throw error;
    }
  },
  
  async createReferralPayment(data: schema.ReferralPaymentInsert) {
    try {
      const [payment] = await db.insert(schema.referralPayments)
        .values(data)
        .returning();
      
      return payment;
    } catch (error) {
      console.error("Error creating referral payment:", error);
      throw error;
    }
  },
  
  async updateReferralPayment(paymentId: number, data: Partial<schema.ReferralPaymentInsert>) {
    try {
      const [updatedPayment] = await db.update(schema.referralPayments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.referralPayments.id, paymentId))
        .returning();
      
      return updatedPayment;
    } catch (error) {
      console.error("Error updating referral payment:", error);
      throw error;
    }
  },
  // --------- Users ---------
  async getUserById(userId: number) {
    return await db.query.users.findFirst({
      where: eq(schema.users.id, userId)
    });
  },

  async getUserByUsername(username: string) {
    return await db.query.users.findFirst({
      where: eq(schema.users.username, username)
    });
  },

  async validateUserCredentials(username: string, password: string) {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) return null;
    
    return user;
  },

  async updateUserLastLogin(userId: number) {
    await db.update(schema.users)
      .set({ lastLogin: new Date() })
      .where(eq(schema.users.id, userId));
  },

  async getAllUsers() {
    return await db.query.users.findMany({
      with: {
        store: true
      }
    });
  },

  async getUsersByStoreId(storeId: number) {
    return await db.query.users.findMany({
      where: eq(schema.users.storeId, storeId),
      with: {
        store: true
      }
    });
  },

  async createUser(userData: schema.UserInsert) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const [user] = await db.insert(schema.users)
      .values({
        ...userData,
        password: hashedPassword
      })
      .returning();
      
    return user;
  },

  async updateUser(userId: number, userData: Partial<schema.UserInsert>) {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    
    const [updatedUser] = await db.update(schema.users)
      .set({
        ...userData,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId))
      .returning();
      
    return updatedUser;
  },

  // --------- Stores ---------
  async getAllStores() {
    return await db.query.stores.findMany({
      orderBy: [schema.stores.name]
    });
  },

  async getStoreById(storeId: number) {
    return await db.query.stores.findFirst({
      where: eq(schema.stores.id, storeId)
    });
  },

  async createStore(storeData: schema.StoreInsert) {
    const [store] = await db.insert(schema.stores)
      .values(storeData)
      .returning();
      
    return store;
  },

  async updateStore(storeId: number, storeData: Partial<schema.StoreInsert>) {
    const [updatedStore] = await db.update(schema.stores)
      .set({
        ...storeData,
        updatedAt: new Date()
      })
      .where(eq(schema.stores.id, storeId))
      .returning();
      
    return updatedStore;
  },

  // --------- Products ---------
  async getAllProducts() {
    return await db.query.products.findMany({
      with: {
        category: true
      },
      orderBy: [schema.products.name]
    });
  },

  async getProductById(productId: number) {
    return await db.query.products.findFirst({
      where: eq(schema.products.id, productId),
      with: {
        category: true
      }
    });
  },

  async getProductByBarcode(barcode: string) {
    return await db.query.products.findFirst({
      where: eq(schema.products.barcode, barcode),
      with: {
        category: true
      }
    });
  },

  async searchProducts(searchTerm: string) {
    return await db.query.products.findMany({
      where: or(
        like(schema.products.name, `%${searchTerm}%`),
        like(schema.products.barcode, `%${searchTerm}%`),
        like(schema.products.description, `%${searchTerm}%`)
      ),
      with: {
        category: true
      },
      orderBy: [schema.products.name]
    });
  },

  async createProduct(productData: schema.ProductInsert) {
    const [product] = await db.insert(schema.products)
      .values(productData)
      .returning();
      
    return product;
  },

  async updateProduct(productId: number, productData: Partial<schema.ProductInsert>) {
    const [updatedProduct] = await db.update(schema.products)
      .set({
        ...productData,
        updatedAt: new Date()
      })
      .where(eq(schema.products.id, productId))
      .returning();
      
    return updatedProduct;
  },

  // --------- Categories ---------
  async getAllCategories() {
    return await db.query.categories.findMany({
      orderBy: [schema.categories.name]
    });
  },

  // --------- Inventory ---------
  async getInventoryByStoreId(storeId: number) {
    return await db.query.inventory.findMany({
      where: eq(schema.inventory.storeId, storeId),
      with: {
        product: {
          with: {
            category: true
          }
        }
      },
      orderBy: [schema.inventory.lastStockUpdate]
    });
  },

  async getLowStockItems(storeId?: number) {
    const query = storeId 
      ? and(
          lte(schema.inventory.quantity, schema.inventory.minimumLevel),
          eq(schema.inventory.storeId, storeId)
        )
      : lte(schema.inventory.quantity, schema.inventory.minimumLevel);
    
    return await db.query.inventory.findMany({
      where: query,
      with: {
        product: {
          with: {
            category: true
          }
        },
        store: true
      },
      orderBy: [
        schema.inventory.quantity
      ]
    });
  },

  async getLowStockCount(storeId?: number) {
    const query = storeId 
      ? and(
          lte(schema.inventory.quantity, schema.inventory.minimumLevel),
          eq(schema.inventory.storeId, storeId)
        )
      : lte(schema.inventory.quantity, schema.inventory.minimumLevel);
    
    const result = await db
      .select({ count: count() })
      .from(schema.inventory)
      .where(query);
    
    return result[0]?.count || 0;
  },

  async getStoreProductInventory(storeId: number, productId: number) {
    return await db.query.inventory.findFirst({
      where: and(
        eq(schema.inventory.storeId, storeId),
        eq(schema.inventory.productId, productId)
      ),
      with: {
        product: true
      }
    });
  },

  async updateInventory(inventoryId: number, data: Partial<schema.InventoryInsert>) {
    const [updatedInventory] = await db.update(schema.inventory)
      .set({
        ...data,
        lastStockUpdate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.inventory.id, inventoryId))
      .returning();
      
    return updatedInventory;
  },

  async updateProductInventory(storeId: number, productId: number, quantity: number) {
    const inventory = await this.getStoreProductInventory(storeId, productId);
    
    if (inventory) {
      return await this.updateInventory(inventory.id, { 
        quantity: Math.max(0, inventory.quantity + quantity) 
      });
    }
    
    return null;
  },

  // --------- Transactions ---------
  async createTransaction(transactionData: schema.TransactionInsert, items: schema.TransactionItemInsert[]) {
    // Create transaction
    const [transaction] = await db.insert(schema.transactions)
      .values(transactionData)
      .returning();
    
    // Create transaction items
    const transactionItems = await Promise.all(
      items.map(async (item) => {
        const [transactionItem] = await db.insert(schema.transactionItems)
          .values({
            ...item,
            transactionId: transaction.id
          })
          .returning();
        
        return transactionItem;
      })
    );
    
    // Update inventory for each item
    await Promise.all(
      items.map(async (item) => {
        await this.updateProductInventory(
          transaction.storeId,
          item.productId,
          -item.quantity
        );
      })
    );
    
    return { transaction, items: transactionItems };
  },

  async getTransactionById(id: number) {
    return await db.query.transactions.findFirst({
      where: eq(schema.transactions.id, id),
      with: {
        store: true,
        cashier: true,
        items: {
          with: {
            product: true
          }
        }
      }
    });
  },

  async getRecentTransactions(limit = 5, storeId?: number) {
    const query = storeId 
      ? eq(schema.transactions.storeId, storeId)
      : undefined;
    
    return await db.query.transactions.findMany({
      where: query,
      with: {
        store: true,
        cashier: true,
        items: {
          with: {
            product: true
          }
        }
      },
      orderBy: [desc(schema.transactions.createdAt)],
      limit
    });
  },

  async getStoreTransactions(storeId: number, startDate?: Date, endDate?: Date, page = 1, limit = 20) {
    let query = eq(schema.transactions.storeId, storeId);
    
    // Add date filters if provided
    if (startDate) {
      const startFilter = gte(schema.transactions.createdAt, startDate);
      query = and(query, startFilter);
    }
    
    if (endDate) {
      const endFilter = lte(schema.transactions.createdAt, endDate);
      query = and(query, endFilter);
    }
    
    return await db.query.transactions.findMany({
      where: query,
      with: {
        cashier: true,
        items: {
          with: {
            product: true
          }
        }
      },
      orderBy: [desc(schema.transactions.createdAt)],
      offset: (page - 1) * limit,
      limit
    });
  },

  async getTransactionCount(storeId?: number, startDate?: Date, endDate?: Date) {
    let query = undefined;
    
    if (storeId) {
      query = eq(schema.transactions.storeId, storeId);
    }
    
    // Add date filters if provided
    if (startDate) {
      const startFilter = gte(schema.transactions.createdAt, startDate);
      query = query ? and(query, startFilter) : startFilter;
    }
    
    if (endDate) {
      const endFilter = lte(schema.transactions.createdAt, endDate);
      query = query ? and(query, endFilter) : endFilter;
    }
    
    const result = await db
      .select({ count: count() })
      .from(schema.transactions)
      .where(query);
    
    return result[0]?.count || 0;
  },

  async getOfflineTransactions() {
    return await db.query.transactions.findMany({
      where: and(
        eq(schema.transactions.isOfflineTransaction, true),
        isNull(schema.transactions.syncedAt)
      ),
      with: {
        store: true,
        items: {
          with: {
            product: true
          }
        }
      }
    });
  },

  async syncOfflineTransaction(transactionId: number) {
    const [updatedTransaction] = await db.update(schema.transactions)
      .set({
        syncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.transactions.id, transactionId))
      .returning();
      
    return updatedTransaction;
  },

  async getDailySalesData(storeId?: number, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Always filter by date range
    const baseQuery = gte(schema.transactions.createdAt, startDate);
    
    // Add store filter if specified
    const query = storeId 
      ? and(baseQuery, eq(schema.transactions.storeId, storeId))
      : baseQuery;
    
    const transactions = await db
      .select({
        date: sql`date_trunc('day', ${schema.transactions.createdAt})`,
        storeId: schema.transactions.storeId,
        totalSales: sql`sum(${schema.transactions.total})`,
        transactionCount: count()
      })
      .from(schema.transactions)
      .where(query)
      .groupBy(sql`date_trunc('day', ${schema.transactions.createdAt})`, schema.transactions.storeId)
      .orderBy(sql`date_trunc('day', ${schema.transactions.createdAt})`);
    
    return transactions;
  },

  async getStoreSalesComparison(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const storesSales = await db
      .select({
        storeId: schema.transactions.storeId,
        storeName: schema.stores.name,
        totalSales: sql`sum(${schema.transactions.total})`,
        transactionCount: count()
      })
      .from(schema.transactions)
      .innerJoin(schema.stores, eq(schema.transactions.storeId, schema.stores.id))
      .where(gte(schema.transactions.createdAt, startDate))
      .groupBy(schema.transactions.storeId, schema.stores.name)
      .orderBy(desc(sql`sum(${schema.transactions.total})`));
    
    return storesSales;
  },

  // --------- AI Conversations ---------
  async saveAiConversation(userId: number, messages: any[]) {
    // Check if there's an existing conversation for this user
    const existingConversation = await db.query.aiConversations.findFirst({
      where: eq(schema.aiConversations.userId, userId)
    });
    
    if (existingConversation) {
      // Update existing conversation
      const [updatedConversation] = await db.update(schema.aiConversations)
        .set({
          messages,
          updatedAt: new Date()
        })
        .where(eq(schema.aiConversations.id, existingConversation.id))
        .returning();
        
      return updatedConversation;
    } else {
      // Create new conversation
      const [newConversation] = await db.insert(schema.aiConversations)
        .values({
          userId,
          messages
        })
        .returning();
        
      return newConversation;
    }
  },

  async getAiConversation(userId: number) {
    return await db.query.aiConversations.findFirst({
      where: eq(schema.aiConversations.userId, userId)
    });
  }
};
