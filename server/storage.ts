import { db, pool } from "@db";
import * as schema from "@shared/schema";
import { eq, and, or, desc, lte, gte, sql, like, count, isNull, not, SQL, inArray, asc } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import crypto from "crypto";

export const storage = {
  // --------- Cashier Sessions ---------
  async createCashierSession(data: schema.CashierSessionInsert) {
    const [session] = await db.insert(schema.cashierSessions).values(data).returning();
    return session;
  },
  
  async getCashierSessionById(sessionId: number) {
    return await db.query.cashierSessions.findFirst({
      where: eq(schema.cashierSessions.id, sessionId),
      with: {
        user: true,
        store: true
      }
    });
  },
  
  async getActiveCashierSession(userId: number) {
    return await db.query.cashierSessions.findFirst({
      where: and(
        eq(schema.cashierSessions.userId, userId),
        eq(schema.cashierSessions.status, "active")
      ),
      with: {
        user: true,
        store: true
      }
    });
  },
  
  async updateCashierSession(sessionId: number, data: Partial<schema.CashierSessionInsert>) {
    const [updated] = await db.update(schema.cashierSessions)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.cashierSessions.id, sessionId))
      .returning();
    return updated;
  },
  
  async getCashierSessionHistory(userId: number, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    const sessions = await db.query.cashierSessions.findMany({
      where: eq(schema.cashierSessions.userId, userId),
      orderBy: [desc(schema.cashierSessions.startTime)],
      limit,
      offset,
      with: {
        store: true
      }
    });
    
    const totalCount = await db.select({ count: count() })
      .from(schema.cashierSessions)
      .where(eq(schema.cashierSessions.userId, userId));
    
    return {
      sessions,
      pagination: {
        total: totalCount[0].count,
        page,
        limit,
        pages: Math.ceil(totalCount[0].count / limit)
      }
    };
  },
  
  async updateSessionStats(sessionId: number, amount: number) {
    const session = await this.getCashierSessionById(sessionId);
    if (!session) return null;
    
    const newTotalSales = parseFloat(session.totalSales.toString()) + amount;
    
    return await this.updateCashierSession(sessionId, {
      transactionCount: session.transactionCount + 1,
      totalSales: newTotalSales.toFixed(2)
    });
  },
  // --------- Loyalty Program ---------
  async getLoyaltyMemberById(memberId: number) {
    return await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId),
      with: {
        customer: true,
        tier: true
      }
    });
  },
  
  async getLoyaltyMemberByLoyaltyId(loyaltyId: string) {
    return await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId),
      with: {
        customer: true,
        tier: true
      }
    });
  },
  
  async getLoyaltyMemberByCustomerId(customerId: number) {
    return await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.customerId, customerId),
      with: {
        customer: true,
        tier: true
      }
    });
  },
  
  async createLoyaltyMember(data: schema.LoyaltyMemberInsert) {
    const [member] = await db.insert(schema.loyaltyMembers)
      .values(data)
      .returning();
    return member;
  },
  
  async updateLoyaltyMember(memberId: number, data: Partial<schema.LoyaltyMemberInsert>) {
    const [updated] = await db.update(schema.loyaltyMembers)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.loyaltyMembers.id, memberId))
      .returning();
    return updated;
  },
  
  async getLoyaltyProgram(storeId: number) {
    return await db.query.loyaltyPrograms.findFirst({
      where: and(
        eq(schema.loyaltyPrograms.storeId, storeId),
        eq(schema.loyaltyPrograms.active, true)
      ),
      with: {
        tiers: true,
        rewards: true
      }
    });
  },
  
  async createLoyaltyProgram(data: schema.LoyaltyProgramInsert) {
    const [program] = await db.insert(schema.loyaltyPrograms)
      .values(data)
      .returning();
    return program;
  },
  
  async updateLoyaltyProgram(programId: number, data: Partial<schema.LoyaltyProgramInsert>) {
    const [updated] = await db.update(schema.loyaltyPrograms)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.loyaltyPrograms.id, programId))
      .returning();
    return updated;
  },
  
  async getLoyaltyTiers(programId: number) {
    return await db.query.loyaltyTiers.findMany({
      where: eq(schema.loyaltyTiers.programId, programId),
      orderBy: [asc(schema.loyaltyTiers.requiredPoints)]
    });
  },
  
  async createLoyaltyTier(data: schema.LoyaltyTierInsert) {
    const [tier] = await db.insert(schema.loyaltyTiers)
      .values(data)
      .returning();
    return tier;
  },
  
  async updateLoyaltyTier(tierId: number, data: Partial<schema.LoyaltyTierInsert>) {
    const [updated] = await db.update(schema.loyaltyTiers)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.loyaltyTiers.id, tierId))
      .returning();
    return updated;
  },
  
  async getLoyaltyRewards(programId: number) {
    return await db.query.loyaltyRewards.findMany({
      where: and(
        eq(schema.loyaltyRewards.programId, programId),
        eq(schema.loyaltyRewards.active, true)
      ),
      with: {
        product: true
      }
    });
  },
  
  async createLoyaltyReward(data: schema.LoyaltyRewardInsert) {
    const [reward] = await db.insert(schema.loyaltyRewards)
      .values(data)
      .returning();
    return reward;
  },
  
  async updateLoyaltyReward(rewardId: number, data: Partial<schema.LoyaltyRewardInsert>) {
    const [updated] = await db.update(schema.loyaltyRewards)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.loyaltyRewards.id, rewardId))
      .returning();
    return updated;
  },
  
  async getLoyaltyTransactions(memberId: number, limit = 20, offset = 0) {
    return await db.query.loyaltyTransactions.findMany({
      where: eq(schema.loyaltyTransactions.memberId, memberId),
      orderBy: [desc(schema.loyaltyTransactions.createdAt)],
      limit,
      offset,
      with: {
        transaction: true,
        reward: true
      }
    });
  },
  
  async createLoyaltyTransaction(data: schema.LoyaltyTransactionInsert) {
    const [transaction] = await db.insert(schema.loyaltyTransactions)
      .values(data)
      .returning();
    return transaction;
  },
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
  
  async getUserByEmail(email: string) {
    return await db.query.users.findFirst({
      where: eq(schema.users.email, email)
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

  // Password reset functionality
  async createPasswordResetToken(userId: number, expiresInHours = 1): Promise<schema.PasswordResetToken> {
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiration date (default 1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    
    // Insert token into database
    const [passwordResetToken] = await db.insert(schema.passwordResetTokens)
      .values({
        userId,
        token,
        expiresAt,
        used: false
      })
      .returning();
    
    return passwordResetToken;
  },
  
  async getPasswordResetToken(token: string): Promise<schema.PasswordResetToken | null> {
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: eq(schema.passwordResetTokens.token, token)
    });
    
    return resetToken || null;
  },
  
  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db.update(schema.passwordResetTokens)
      .set({ used: true })
      .where(eq(schema.passwordResetTokens.token, token));
  },
  
  async isPasswordResetTokenValid(token: string): Promise<boolean> {
    const resetToken = await this.getPasswordResetToken(token);
    
    if (!resetToken) {
      return false;
    }
    
    // Check if token is expired
    const now = new Date();
    if (resetToken.expiresAt < now) {
      return false;
    }
    
    // Check if token has been used
    if (resetToken.used) {
      return false;
    }
    
    return true;
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
    try {
      return await db.query.products.findMany({
        with: {
          category: true
        },
        orderBy: [schema.products.name]
      });
    } catch (error) {
      console.error("Get products error:", error);
      // Return empty array instead of throwing error
      return [];
    }
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
    try {
      // Query inventory items where quantity is below the minimum level
      let query = db
        .select({
          inventory: schema.inventory,
          product: schema.products,
          store: schema.stores,
          category: schema.categories
        })
        .from(schema.inventory)
        .innerJoin(
          schema.products, 
          eq(schema.inventory.productId, schema.products.id)
        )
        .innerJoin(
          schema.stores,
          eq(schema.inventory.storeId, schema.stores.id)
        )
        .innerJoin(
          schema.categories,
          eq(schema.products.categoryId, schema.categories.id)
        )
        .where(
          lte(schema.inventory.quantity, schema.inventory.minimumLevel)
        )
        .orderBy(asc(schema.inventory.quantity));
      
      // Apply store filter if specified
      if (storeId) {
        query = query.where(eq(schema.inventory.storeId, storeId));
      }
      
      const results = await query;
      
      // Transform results to match the expected format
      return results.map(row => ({
        id: row.inventory.id,
        storeId: row.inventory.storeId,
        productId: row.inventory.productId,
        quantity: row.inventory.quantity,
        minimumLevel: row.inventory.minimumLevel,
        product: {
          id: row.product.id,
          name: row.product.name,
          barcode: row.product.barcode || '',
          category: {
            id: row.category.id,
            name: row.category.name
          }
        },
        store: {
          id: row.store.id,
          name: row.store.name
        }
      }));
    } catch (error) {
      console.error("Error in getLowStockItems:", error);
      return [];
    }
  },

  async getLowStockCount(storeId?: number) {
    try {
      // Build query to count low stock items
      let queryBuilder = db
        .select({ count: count() })
        .from(schema.inventory)
        .where(lte(schema.inventory.quantity, schema.inventory.minimumLevel));
      
      // Apply store filter if provided
      if (storeId) {
        queryBuilder = queryBuilder.where(eq(schema.inventory.storeId, storeId));
      }
      
      const result = await queryBuilder;
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error in getLowStockCount:", error);
      return 0;
    }
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
    
    // Process loyalty points if this is a loyalty member transaction
    if (transaction.loyaltyMemberId) {
      try {
        // Get the loyalty member
        const loyaltyMember = await this.getLoyaltyMemberById(transaction.loyaltyMemberId);
        
        if (loyaltyMember) {
          // Get the loyalty program for this store
          const loyaltyProgram = await this.getLoyaltyProgram(transaction.storeId);
          
          if (loyaltyProgram) {
            // Calculate points based on transaction amount
            const pointsRate = parseFloat(loyaltyProgram.pointsPerAmount || "0.01"); // Default to 1 point per $100 if not set
            const pointsEarned = parseFloat(transaction.total) * pointsRate;
            const pointsEarnedStr = pointsEarned.toString();
            
            // Update transaction with points earned
            await db.update(schema.transactions)
              .set({ pointsEarned: pointsEarnedStr })
              .where(eq(schema.transactions.id, transaction.id));
            
            // Create loyalty transaction record
            await this.createLoyaltyTransaction({
              memberId: transaction.loyaltyMemberId,
              transactionId: transaction.id,
              points: pointsEarnedStr,
              type: 'earn',
              note: `Points earned from transaction ${transaction.transactionId}`,
              // Set expiration based on program settings
              createdBy: transaction.cashierId
            });
            
            // Update member's point balance
            const currentPoints = parseFloat(loyaltyMember.currentPoints || "0");
            const newPointBalance = currentPoints + pointsEarned;
            await this.updateLoyaltyMember(transaction.loyaltyMemberId, {
              currentPoints: newPointBalance.toString(),
              lastActivity: new Date()
            });
            
            // Update transaction object with points data
            transaction.pointsEarned = pointsEarnedStr;
          }
        }
      } catch (error) {
        console.error('Error processing loyalty points:', error);
        // We don't throw here to avoid failing the transaction
      }
    }
    
    return { transaction, items: transactionItems };
  },

  async getTransactionById(id: number) {
    try {
      // First get the transaction details
      const transaction = await db.select({
        id: schema.transactions.id,
        transactionId: schema.transactions.transactionId,
        storeId: schema.transactions.storeId,
        cashierId: schema.transactions.cashierId,
        subtotal: schema.transactions.subtotal,
        tax: schema.transactions.tax,
        total: schema.transactions.total,
        paymentMethod: schema.transactions.paymentMethod,
        status: schema.transactions.status,
        isOfflineTransaction: schema.transactions.isOfflineTransaction,
        createdAt: schema.transactions.createdAt,
        updatedAt: schema.transactions.updatedAt,
        syncedAt: schema.transactions.syncedAt,
        store: {
          id: schema.stores.id,
          name: schema.stores.name
        },
        cashier: {
          id: schema.users.id,
          username: schema.users.username,
          fullName: schema.users.fullName
        }
      })
      .from(schema.transactions)
      .leftJoin(schema.stores, eq(schema.transactions.storeId, schema.stores.id))
      .leftJoin(schema.users, eq(schema.transactions.cashierId, schema.users.id))
      .where(eq(schema.transactions.id, id))
      .limit(1);

      if (!transaction || transaction.length === 0) {
        return null;
      }

      // Then get the transaction items
      const items = await db.select({
        id: schema.transactionItems.id,
        productId: schema.transactionItems.productId,
        quantity: schema.transactionItems.quantity,
        unitPrice: schema.transactionItems.unitPrice,
        subtotal: schema.transactionItems.subtotal,
        returnedQuantity: schema.transactionItems.returnedQuantity,
        product: {
          id: schema.products.id,
          name: schema.products.name,
          barcode: schema.products.barcode,
          price: schema.products.price
        }
      })
      .from(schema.transactionItems)
      .leftJoin(schema.products, eq(schema.transactionItems.productId, schema.products.id))
      .where(eq(schema.transactionItems.transactionId, id));

      // Combine the results
      return {
        ...transaction[0],
        items
      };
    } catch (error) {
      console.error("Error fetching transaction by ID:", error);
      return null; // Return null instead of failing
    }
  },

  async getRecentTransactions(limit = 5, storeId?: number) {
    try {
      const query = storeId 
        ? eq(schema.transactions.storeId, storeId)
        : undefined;
      
      // Explicit column selection to avoid requesting columns that may not exist in the database yet
      return await db.select({
        id: schema.transactions.id,
        transactionId: schema.transactions.transactionId,
        storeId: schema.transactions.storeId,
        cashierId: schema.transactions.cashierId,
        subtotal: schema.transactions.subtotal,
        tax: schema.transactions.tax,
        total: schema.transactions.total,
        paymentMethod: schema.transactions.paymentMethod,
        status: schema.transactions.status,
        isOfflineTransaction: schema.transactions.isOfflineTransaction,
        createdAt: schema.transactions.createdAt,
        updatedAt: schema.transactions.updatedAt,
        synced_at: schema.transactions.syncedAt,
        store: {
          id: schema.stores.id,
          name: schema.stores.name
        },
        cashier: {
          id: schema.users.id,
          username: schema.users.username,
          fullName: schema.users.fullName
        }
      })
      .from(schema.transactions)
      .leftJoin(schema.stores, eq(schema.transactions.storeId, schema.stores.id))
      .leftJoin(schema.users, eq(schema.transactions.cashierId, schema.users.id))
      .where(query)
      .orderBy(desc(schema.transactions.createdAt))
      .limit(limit);
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
      return []; // Return empty array instead of failing
    }
  },

  async getStoreTransactions(storeId: number, startDate?: Date, endDate?: Date, page = 1, limit = 20) {
    try {
      // Start with store filter as the base query
      let whereClause = eq(schema.transactions.storeId, storeId);
      
      // Apply date filters if provided
      if (startDate) {
        whereClause = and(whereClause, gte(schema.transactions.createdAt, startDate));
      }
      
      if (endDate) {
        whereClause = and(whereClause, lte(schema.transactions.createdAt, endDate));
      }
      
      // Get transactions with basic details
      const transactions = await db.select({
        id: schema.transactions.id,
        transactionId: schema.transactions.transactionId,
        storeId: schema.transactions.storeId,
        cashierId: schema.transactions.cashierId,
        subtotal: schema.transactions.subtotal,
        tax: schema.transactions.tax,
        total: schema.transactions.total,
        paymentMethod: schema.transactions.paymentMethod,
        status: schema.transactions.status,
        isOfflineTransaction: schema.transactions.isOfflineTransaction,
        createdAt: schema.transactions.createdAt,
        updatedAt: schema.transactions.updatedAt,
        syncedAt: schema.transactions.syncedAt,
        cashier: {
          id: schema.users.id,
          username: schema.users.username,
          fullName: schema.users.fullName
        }
      })
      .from(schema.transactions)
      .leftJoin(schema.users, eq(schema.transactions.cashierId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.transactions.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

      // For each transaction, get its items
      const transactionsWithItems = await Promise.all(
        transactions.map(async (transaction) => {
          const items = await db.select({
            id: schema.transactionItems.id,
            productId: schema.transactionItems.productId,
            quantity: schema.transactionItems.quantity,
            unitPrice: schema.transactionItems.unitPrice,
            subtotal: schema.transactionItems.subtotal,
            returnedQuantity: schema.transactionItems.returnedQuantity,
            product: {
              id: schema.products.id,
              name: schema.products.name,
              barcode: schema.products.barcode,
              price: schema.products.price
            }
          })
          .from(schema.transactionItems)
          .leftJoin(schema.products, eq(schema.transactionItems.productId, schema.products.id))
          .where(eq(schema.transactionItems.transactionId, transaction.id));

          return {
            ...transaction,
            items
          };
        })
      );
      
      return transactionsWithItems;
    } catch (error) {
      console.error("Error fetching store transactions:", error);
      return []; // Return empty array instead of failing
    }
  },

  async getTransactionCount(storeId?: number, startDate?: Date, endDate?: Date) {
    try {
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
      
      return Number(result[0]?.count) || 0;
    } catch (error) {
      console.error("Error counting transactions:", error);
      return 0; // Return 0 instead of failing
    }
  },

  async getOfflineTransactions() {
    try {
      // Explicit column selection to avoid requesting columns that may not exist in the database yet
      const transactions = await db.select({
        id: schema.transactions.id,
        transactionId: schema.transactions.transactionId,
        storeId: schema.transactions.storeId,
        cashierId: schema.transactions.cashierId,
        subtotal: schema.transactions.subtotal,
        tax: schema.transactions.tax,
        total: schema.transactions.total,
        paymentMethod: schema.transactions.paymentMethod,
        status: schema.transactions.status,
        isOfflineTransaction: schema.transactions.isOfflineTransaction,
        createdAt: schema.transactions.createdAt,
        updatedAt: schema.transactions.updatedAt,
        syncedAt: schema.transactions.syncedAt,
        store: {
          id: schema.stores.id,
          name: schema.stores.name
        }
      })
      .from(schema.transactions)
      .leftJoin(schema.stores, eq(schema.transactions.storeId, schema.stores.id))
      .where(and(
        eq(schema.transactions.isOfflineTransaction, true),
        isNull(schema.transactions.syncedAt)
      ));

      // For each transaction, get its items
      const transactionsWithItems = await Promise.all(
        transactions.map(async (transaction) => {
          const items = await db.select({
            id: schema.transactionItems.id,
            productId: schema.transactionItems.productId,
            quantity: schema.transactionItems.quantity,
            unitPrice: schema.transactionItems.unitPrice,
            subtotal: schema.transactionItems.subtotal,
            product: {
              id: schema.products.id,
              name: schema.products.name,
              barcode: schema.products.barcode,
              price: schema.products.price
            }
          })
          .from(schema.transactionItems)
          .leftJoin(schema.products, eq(schema.transactionItems.productId, schema.products.id))
          .where(eq(schema.transactionItems.transactionId, transaction.id));

          return {
            ...transaction,
            items
          };
        })
      );
      
      return transactionsWithItems;
    } catch (error) {
      console.error("Error fetching offline transactions:", error);
      return []; // Return empty array instead of failing
    }
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
  },

  // ----------- Returns and Refunds Methods -----------

  // Customer methods
  async createCustomer(customerData: schema.CustomerInsert) {
    const [customer] = await db.insert(schema.customers)
      .values(customerData)
      .returning();
    return customer;
  },

  async getCustomerById(customerId: number) {
    return await db.query.customers.findFirst({
      where: eq(schema.customers.id, customerId)
    });
  },

  async getCustomerByEmail(email: string) {
    return await db.query.customers.findFirst({
      where: eq(schema.customers.email, email)
    });
  },

  async getCustomerByPhone(phone: string) {
    return await db.query.customers.findFirst({
      where: eq(schema.customers.phone, phone)
    });
  },

  // Return reasons
  async createReturnReason(reasonData: schema.ReturnReasonInsert) {
    const [reason] = await db.insert(schema.returnReasons)
      .values(reasonData)
      .returning();
    return reason;
  },

  async getAllReturnReasons(activeOnly: boolean = true) {
    if (activeOnly) {
      return await db.query.returnReasons.findMany({
        where: eq(schema.returnReasons.active, true)
      });
    } else {
      return await db.query.returnReasons.findMany();
    }
  },

  async getReturnReasonById(reasonId: number) {
    return await db.query.returnReasons.findFirst({
      where: eq(schema.returnReasons.id, reasonId)
    });
  },

  // Return methods
  async createReturn(returnData: schema.ReturnInsert, returnItems: schema.ReturnItemInsert[]) {
    // Start a transaction to ensure data integrity
    return await db.transaction(async (tx) => {
      // 1. Insert the return
      const [newReturn] = await tx.insert(schema.returns)
        .values(returnData)
        .returning();
      
      // 2. Insert return items with the returned ID
      const returnItemsWithReturnId = returnItems.map(item => ({
        ...item,
        returnId: newReturn.id
      }));
      
      const insertedItems = await tx.insert(schema.returnItems)
        .values(returnItemsWithReturnId)
        .returning();
      
      // 3. Process inventory updates for non-perishable items
      for (const item of insertedItems) {
        if (!item.isPerishable && item.restocked) {
          // Get store ID from the return
          const storeId = newReturn.storeId;
          
          // Update inventory by incrementing the quantity for non-perishable returns
          await tx.update(schema.inventory)
            .set({
              quantity: sql`${schema.inventory.quantity} + ${item.quantity}`,
              lastStockUpdate: new Date()
            })
            .where(
              and(
                eq(schema.inventory.storeId, storeId),
                eq(schema.inventory.productId, item.productId)
              )
            );
        }
      }
      
      return { 
        ...newReturn, 
        items: insertedItems 
      };
    });
  },

  async getReturnById(returnId: number) {
    const result = await db.query.returns.findFirst({
      where: eq(schema.returns.id, returnId),
      with: {
        items: {
          with: {
            product: true,
            returnReason: true
          }
        },
        store: true,
        processor: true,
        customer: true,
        originalTransaction: true
      }
    });
    
    return result;
  },

  async getReturnByReturnId(returnId: string) {
    const result = await db.query.returns.findFirst({
      where: eq(schema.returns.returnId, returnId),
      with: {
        items: {
          with: {
            product: true,
            returnReason: true
          }
        },
        store: true,
        processor: true,
        customer: true,
        originalTransaction: true
      }
    });
    
    return result;
  },

  async getReturnsByStoreId(storeId: number, startDate?: Date, endDate?: Date, page: number = 1, limit: number = 20) {
    const conditions = [eq(schema.returns.storeId, storeId)];
    
    if (startDate) {
      conditions.push(gte(schema.returns.returnDate, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(schema.returns.returnDate, endDate));
    }
    
    const offset = (page - 1) * limit;
    
    const returns = await db.query.returns.findMany({
      where: and(...conditions),
      with: {
        items: {
          with: {
            product: true,
            returnReason: true
          }
        },
        customer: true,
        processor: true
      },
      offset,
      limit
    });
    
    const totalReturnsCountResult = await db.select({ 
      count: count()
    })
    .from(schema.returns)
    .where(and(...conditions));
    
    const totalReturns = totalReturnsCountResult[0].count;
    
    return {
      returns,
      pagination: {
        total: totalReturns,
        page,
        limit,
        totalPages: Math.ceil(totalReturns / limit)
      }
    };
  },

  async getRecentReturns(limit: number = 5, storeId?: number) {
    let query = db.query.returns.findMany({
      with: {
        items: {
          with: {
            product: true
          }
        },
        store: true,
        processor: true
      },
      orderBy: desc(schema.returns.returnDate),
      limit
    });
    
    if (storeId) {
      query = db.query.returns.findMany({
        where: eq(schema.returns.storeId, storeId),
        with: {
          items: {
            with: {
              product: true
            }
          },
          store: true,
          processor: true
        },
        orderBy: desc(schema.returns.returnDate),
        limit
      });
    }
    
    return await query;
  },

  async updateReturnStatus(returnId: number, status: string) {
    const [updatedReturn] = await db.update(schema.returns)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(schema.returns.id, returnId))
      .returning();
      
    return updatedReturn;
  },

  async getReturnAnalytics(storeId?: number, startDate?: Date, endDate?: Date) {
    // Build where clause
    const conditions = [];
    
    if (storeId) {
      conditions.push(eq(schema.returns.storeId, storeId));
    }
    
    if (startDate) {
      conditions.push(gte(schema.returns.returnDate, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(schema.returns.returnDate, endDate));
    }
    
    // Get all returns with their items
    let returns = [];
    
    if (conditions.length > 0) {
      returns = await db.query.returns.findMany({
        where: and(...conditions),
        with: {
          items: true,
          store: true
        }
      });
    } else {
      returns = await db.query.returns.findMany({
        with: {
          items: true,
          store: true
        }
      });
    }
    
    // Calculate analytics
    let totalReturns = returns.length;
    let totalRefundAmount = 0;
    let perishableReturns = 0;
    let nonPerishableReturns = 0;
    let restockedItems = 0;
    let storeData: Record<number, { 
      storeName: string, 
      returnCount: number, 
      refundAmount: number 
    }> = {};
    
    // Get all return items for detailed analysis
    let allReturnItems: schema.ReturnItem[] = [];
    
    if (returns.length > 0) {
      const returnIds = returns.map(r => r.id);
      allReturnItems = await db.select().from(schema.returnItems)
        .where(inArray(schema.returnItems.returnId, returnIds));
    }
    
    // Process return items data
    allReturnItems.forEach(item => {
      if (item.isPerishable) {
        perishableReturns++;
      } else {
        nonPerishableReturns++;
      }
      
      if (item.restocked) {
        restockedItems++;
      }
    });
    
    // Process returns data
    returns.forEach(ret => {
      totalRefundAmount += parseFloat(ret.totalRefundAmount.toString());
      
      // Group by store
      const storeId = ret.storeId;
      if (!storeData[storeId]) {
        storeData[storeId] = {
          storeName: ret.store?.name || `Store ${storeId}`,
          returnCount: 0,
          refundAmount: 0
        };
      }
      
      storeData[storeId].returnCount++;
      storeData[storeId].refundAmount += parseFloat(ret.totalRefundAmount.toString());
    });
    
    // Get return reasons summary
    const reasonsData: Record<number, {
      reasonName: string,
      count: number
    }> = {};
    
    // For each item with a return reason, count it
    allReturnItems.forEach(item => {
      if (item.returnReasonId) {
        if (!reasonsData[item.returnReasonId]) {
          // Get the reason name from the database
          reasonsData[item.returnReasonId] = {
            reasonName: `Reason ${item.returnReasonId}`,
            count: 0
          };
        }
        
        reasonsData[item.returnReasonId].count++;
      }
    });
    
    return {
      totalReturns,
      totalRefundAmount,
      perishableReturns,
      nonPerishableReturns,
      restockedItems,
      storeBreakdown: Object.values(storeData),
      reasonBreakdown: Object.values(reasonsData)
    };
  }
};
