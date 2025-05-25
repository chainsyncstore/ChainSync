import { db, pool } from "@db";
import * as schema from "@shared/schema";
import {
  eq,
  and,
  or,
  desc,
  lte,
  gte,
  sql,
  like,
  count,
  isNull,
  not,
  SQL,
  inArray,
  asc,
  gt,
  lt,
} from "drizzle-orm";
import * as bcrypt from "bcrypt";
import crypto from "crypto";

export const storage = {
  // --------- Cashier Sessions ---------
  async createCashierSession(data: schema.CashierSessionInsert) {
    const [session] = await db
      .insert(schema.cashierSessions)
      .values(data)
      .returning();
    return session;
  },

  async getCashierSessionById(sessionId: number) {
    return await db.query.cashierSessions.findFirst({
      where: eq(schema.cashierSessions.id, sessionId),
      with: {
        user: true,
        store: true,
      },
    });
  },

  async getActiveCashierSession(userId: number) {
    return await db.query.cashierSessions.findFirst({
      where: and(
        eq(schema.cashierSessions.userId, userId),
        eq(schema.cashierSessions.status, "active"),
      ),
      with: {
        user: true,
        store: true,
      },
    });
  },

  async updateCashierSession(
    sessionId: number,
    data: Partial<schema.CashierSessionInsert>,
  ) {
    const [updated] = await db
      .update(schema.cashierSessions)
      .set({
        ...data,
        updatedAt: new Date(),
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
        store: true,
      },
    });

    const totalCount = await db
      .select({ count: count() })
      .from(schema.cashierSessions)
      .where(eq(schema.cashierSessions.userId, userId));

    return {
      sessions,
      pagination: {
        total: totalCount[0].count,
        page,
        limit,
        pages: Math.ceil(totalCount[0].count / limit),
      },
    };
  },

  async updateSessionStats(sessionId: number, amount: number) {
    const session = await this.getCashierSessionById(sessionId);
    if (!session) return null;

    const newTotalSales = parseFloat(session.totalSales.toString()) + amount;

    return await this.updateCashierSession(sessionId, {
      transactionCount: session.transactionCount + 1,
      totalSales: newTotalSales.toFixed(2),
    });
  },

  // --------- Loyalty Program ---------
  async getLoyaltyMemberById(memberId: number) {
    return await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId),
      with: {
        customer: true,
        tier: true,
      },
    });
  },

  async getLoyaltyMemberByLoyaltyId(loyaltyId: string) {
    return await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId),
      with: {
        customer: true,
        tier: true,
      },
    });
  },

  async getLoyaltyMemberByCustomerId(customerId: number) {
    return await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.customerId, customerId),
      with: {
        customer: true,
        tier: true,
      },
    });
  },

  async createLoyaltyMember(data: schema.LoyaltyMemberInsert) {
    const [member] = await db
      .insert(schema.loyaltyMembers)
      .values(data)
      .returning();
    return member;
  },

  async updateLoyaltyMember(
    memberId: number,
    data: Partial<schema.LoyaltyMemberInsert>,
  ) {
    const [updated] = await db
      .update(schema.loyaltyMembers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.loyaltyMembers.id, memberId))
      .returning();
    return updated;
  },

  async getLoyaltyProgram(storeId: number) {
    return await db.query.loyaltyPrograms.findFirst({
      where: and(
        eq(schema.loyaltyPrograms.storeId, storeId),
        eq(schema.loyaltyPrograms.active, true),
      ),
      with: {
        tiers: true,
        rewards: true,
      },
    });
  },

  async createLoyaltyProgram(data: schema.LoyaltyProgramInsert) {
    const [program] = await db
      .insert(schema.loyaltyPrograms)
      .values(data)
      .returning();
    return program;
  },

  async updateLoyaltyProgram(
    programId: number,
    data: Partial<schema.LoyaltyProgramInsert>,
  ) {
    const [updated] = await db
      .update(schema.loyaltyPrograms)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.loyaltyPrograms.id, programId))
      .returning();
    return updated;
  },

  async getLoyaltyTiers(programId: number) {
    return await db.query.loyaltyTiers.findMany({
      where: eq(schema.loyaltyTiers.programId, programId),
      orderBy: [asc(schema.loyaltyTiers.requiredPoints)],
    });
  },

  async createLoyaltyTier(data: schema.LoyaltyTierInsert) {
    const [tier] = await db
      .insert(schema.loyaltyTiers)
      .values(data)
      .returning();
    return tier;
  },

  async updateLoyaltyTier(
    tierId: number,
    data: Partial<schema.LoyaltyTierInsert>,
  ) {
    const [updated] = await db
      .update(schema.loyaltyTiers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.loyaltyTiers.id, tierId))
      .returning();
    return updated;
  },

  async getLoyaltyRewards(programId: number) {
    return await db.query.loyaltyRewards.findMany({
      where: and(
        eq(schema.loyaltyRewards.programId, programId),
        eq(schema.loyaltyRewards.active, true),
      ),
      with: {
        product: true,
      },
    });
  },

  async createLoyaltyReward(data: schema.LoyaltyRewardInsert) {
    const [reward] = await db
      .insert(schema.loyaltyRewards)
      .values(data)
      .returning();
    return reward;
  },

  async updateLoyaltyReward(
    rewardId: number,
    data: Partial<schema.LoyaltyRewardInsert>,
  ) {
    const [updated] = await db
      .update(schema.loyaltyRewards)
      .set({
        ...data,
        updatedAt: new Date(),
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
        reward: true,
      },
    });
  },

  async createLoyaltyTransaction(data: schema.LoyaltyTransactionInsert) {
    const [transaction] = await db
      .insert(schema.loyaltyTransactions)
      .values(data)
      .returning();
    return transaction;
  },

  // ----------- Affiliate Methods -----------
  async getAffiliateByUserId(userId: number) {
    try {
      const [affiliate] = await db
        .select()
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
      const [affiliate] = await db
        .select()
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
      const [affiliate] = await db
        .insert(schema.affiliates)
        .values(data)
        .returning();

      return affiliate;
    } catch (error) {
      console.error("Error creating affiliate:", error);
      throw error;
    }
  },

  async updateAffiliate(
    affiliateId: number,
    data: Partial<schema.AffiliateInsert>,
  ) {
    try {
      const [updatedAffiliate] = await db
        .update(schema.affiliates)
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
      const referrals = await db
        .select({
          id: schema.referrals.id,
          status: schema.referrals.status,
          signupDate: schema.referrals.signupDate,
          activationDate: schema.referrals.activationDate,
          expiryDate: schema.referrals.expiryDate,
          username: schema.users.username,
          fullName: schema.users.fullName,
        })
        .from(schema.referrals)
        .leftJoin(
          schema.users,
          eq(schema.referrals.referredUserId, schema.users.id),
        )
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
      const [referral] = await db
        .insert(schema.referrals)
        .values(data)
        .returning();

      return referral;
    } catch (error) {
      console.error("Error creating referral:", error);
      throw error;
    }
  },

  async updateReferral(
    referralId: number,
    data: Partial<schema.ReferralInsert>,
  ) {
    try {
      const [updatedReferral] = await db
        .update(schema.referrals)
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
      const [subscription] = await db
        .select()
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
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values(data)
        .returning();

      return subscription;
    } catch (error) {
      console.error("Error creating subscription:", error);
      throw error;
    }
  },

  async updateSubscription(
    subscriptionId: number,
    data: Partial<schema.SubscriptionInsert>,
  ) {
    try {
      const [updatedSubscription] = await db
        .update(schema.subscriptions)
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
      const payments = await db
        .select()
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
      const [payment] = await db
        .insert(schema.referralPayments)
        .values(data)
        .returning();

      return payment;
    } catch (error) {
      console.error("Error creating referral payment:", error);
      throw error;
    }
  },

  async updateReferralPayment(
    paymentId: number,
    data: Partial<schema.ReferralPaymentInsert>,
  ) {
    try {
      const [updatedPayment] = await db
        .update(schema.referralPayments)
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
      where: eq(schema.users.id, userId),
    });
  },

  async getUserByUsername(username: string) {
    return await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });
  },

  async getUserByEmail(email: string) {
    return await db.query.users.findFirst({
      where: eq(schema.users.email, email),
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
    await db
      .update(schema.users)
      .set({ lastLogin: new Date() })
      .where(eq(schema.users.id, userId));
  },

  async getAllUsers() {
    return await db.query.users.findMany({
      with: {
        store: true,
      },
    });
  },

  async getUsersByStoreId(storeId: number) {
    return await db.query.users.findMany({
      where: eq(schema.users.storeId, storeId),
      with: {
        store: true,
      },
    });
  },

  async createUser(userData: schema.UserInsert) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const [user] = await db
      .insert(schema.users)
      .values({
        ...userData,
        password: hashedPassword,
      })
      .returning();

    return user;
  },

  async updateUser(userId: number, userData: Partial<schema.UserInsert>) {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const [updatedUser] = await db
      .update(schema.users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    return updatedUser;
  },

  // Password reset functionality
  async createPasswordResetToken(
    userId: number,
    expiresInHours = 1,
  ): Promise<schema.PasswordResetToken> {
    // Generate a random token
    const token = crypto.randomBytes(32).toString("hex");

    // Calculate expiration date (default 1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Insert token into database
    const [passwordResetToken] = await db
      .insert(schema.passwordResetTokens)
      .values({
        userId,
        token,
        expiresAt,
        used: false,
      })
      .returning();

    return passwordResetToken;
  },

  async getPasswordResetToken(
    token: string,
  ): Promise<schema.PasswordResetToken | null> {
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: eq(schema.passwordResetTokens.token, token),
    });

    return resetToken || null;
  },

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db
      .update(schema.passwordResetTokens)
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
      orderBy: [schema.stores.name],
    });
  },

  async getStoreById(storeId: number) {
    return await db.query.stores.findFirst({
      where: eq(schema.stores.id, storeId),
    });
  },

  async createStore(storeData: schema.StoreInsert) {
    const [store] = await db
      .insert(schema.stores)
      .values(storeData)
      .returning();

    return store;
  },

  async updateStore(storeId: number, storeData: Partial<schema.StoreInsert>) {
    const [updatedStore] = await db
      .update(schema.stores)
      .set({
        ...storeData,
        updatedAt: new Date(),
      })
      .where(eq(schema.stores.id, storeId))
      .returning();

    return updatedStore;
  },

  // --------- Products ---------
  async getAllProducts() {
    return await db.query.products.findMany({
      with: {
        category: true,
      },
      orderBy: [schema.products.name],
    });
  },

  async getProductById(productId: number) {
    return await db.query.products.findFirst({
      where: eq(schema.products.id, productId),
      with: {
        category: true,
      },
    });
  },

  async getProductByBarcode(barcode: string) {
    return await db.query.products.findFirst({
      where: eq(schema.products.barcode, barcode),
      with: {
        category: true,
      },
    });
  },

  async searchProducts(searchTerm: string) {
    return await db.query.products.findMany({
      where: or(
        like(schema.products.name, `%${searchTerm}%`),
        like(schema.products.barcode, `%${searchTerm}%`),
        like(schema.products.sku, `%${searchTerm}%`),
        like(schema.products.description, `%${searchTerm}%`),
      ),
      with: {
        category: true,
      },
      limit: 20,
    });
  },

  async createProduct(productData: schema.ProductInsert) {
    const [product] = await db
      .insert(schema.products)
      .values(productData)
      .returning();

    return product;
  },

  async updateProduct(
    productId: number,
    productData: Partial<schema.ProductInsert>,
  ) {
    const [updatedProduct] = await db
      .update(schema.products)
      .set({
        ...productData,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, productId))
      .returning();

    return updatedProduct;
  },

  async getAllCategories() {
    return await db.query.categories.findMany({
      orderBy: [schema.categories.name],
    });
  },

  // --------- Inventory ---------
  async getInventoryByStoreId(storeId: number) {
    return await db.query.inventory.findMany({
      where: eq(schema.inventory.storeId, storeId),
      with: {
        product: {
          with: {
            category: true,
          },
        },
      },
    });
  },

  async getLowStockItems(storeId?: number) {
    let query = db.query.inventory.findMany({
      where: lte(
        schema.inventory.totalQuantity,
        sql`${schema.inventory.minimumLevel}`,
      ),
      with: {
        product: {
          with: {
            category: true,
          },
        },
        store: true,
      },
    });

    if (storeId) {
      query = db.query.inventory.findMany({
        where: and(
          eq(schema.inventory.storeId, storeId),
          lte(
            schema.inventory.totalQuantity,
            sql`${schema.inventory.minimumLevel}`,
          ),
        ),
        with: {
          product: {
            with: {
              category: true,
            },
          },
          store: true,
        },
      });
    }

    return await query;
  },

  async getExpiringItems(days = 30, storeId?: number) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    let query = db.query.inventoryBatches.findMany({
      where: and(
        not(isNull(schema.inventoryBatches.expiryDate)),
        gt(schema.inventoryBatches.quantity, 0),
        lte(schema.inventoryBatches.expiryDate, futureDate),
        gt(schema.inventoryBatches.expiryDate, new Date()),
      ),
      with: {
        inventory: {
          with: {
            product: true,
            store: true,
          },
        },
      },
    });

    if (storeId) {
      query = db.query.inventoryBatches.findMany({
        where: and(
          not(isNull(schema.inventoryBatches.expiryDate)),
          gt(schema.inventoryBatches.quantity, 0),
          lte(schema.inventoryBatches.expiryDate, futureDate),
          gt(schema.inventoryBatches.expiryDate, new Date()),
          eq(schema.inventory.storeId, storeId),
        ),
        with: {
          inventory: {
            with: {
              product: true,
              store: true,
            },
          },
        },
      });
    }

    return await query;
  },

  async getExpiredItems(storeId?: number) {
    let query = db.query.inventoryBatches.findMany({
      where: and(
        not(isNull(schema.inventoryBatches.expiryDate)),
        gt(schema.inventoryBatches.quantity, 0),
        lte(schema.inventoryBatches.expiryDate, new Date()),
      ),
      with: {
        inventory: {
          with: {
            product: true,
            store: true,
          },
        },
      },
    });

    if (storeId) {
      query = db.query.inventoryBatches.findMany({
        where: and(
          not(isNull(schema.inventoryBatches.expiryDate)),
          gt(schema.inventoryBatches.quantity, 0),
          lte(schema.inventoryBatches.expiryDate, new Date()),
          eq(schema.inventory.storeId, storeId),
        ),
        with: {
          inventory: {
            with: {
              product: true,
              store: true,
            },
          },
        },
      });
    }

    return await query;
  },

  async getLowStockCount(storeId?: number) {
    const lowStockItems = await this.getLowStockItems(storeId);
    return lowStockItems.length;
  },

  async getStoreProductInventory(storeId: number, productId: number) {
    return await db.query.inventory.findFirst({
      where: and(
        eq(schema.inventory.storeId, storeId),
        eq(schema.inventory.productId, productId),
      ),
      with: {
        product: true,
        store: true,
      },
    });
  },

  async createInventory(data: schema.InventoryInsert) {
    const [inventory] = await db
      .insert(schema.inventory)
      .values(data)
      .returning();
    return inventory;
  },

  async getInventoryItemById(inventoryId: number) {
    return await db.query.inventory.findFirst({
      where: eq(schema.inventory.id, inventoryId),
      with: {
        product: true,
        store: true,
      },
    });
  },

  async updateInventory(
    inventoryId: number,
    data: Partial<schema.InventoryInsert>,
  ) {
    const [updated] = await db
      .update(schema.inventory)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.inventory.id, inventoryId))
      .returning();
    return updated;
  },

  // --------- Batch Inventory ---------
  async getInventoryBatches(inventoryId: number) {
    return await db.query.inventoryBatches.findMany({
      where: eq(schema.inventoryBatches.inventoryId, inventoryId),
      orderBy: [
        asc(schema.inventoryBatches.expiryDate),
        desc(schema.inventoryBatches.createdAt),
      ],
    });
  },

  async getInventoryBatchById(batchId: number) {
    return await db.query.inventoryBatches.findFirst({
      where: eq(schema.inventoryBatches.id, batchId),
      with: {
        inventory: {
          with: {
            product: true,
          },
        },
      },
    });
  },

  async createInventoryBatch(data: schema.InventoryBatchInsert) {
    const [batch] = await db
      .insert(schema.inventoryBatches)
      .values(data)
      .returning();

    // Update the inventory total quantity
    await this.updateInventoryTotalQuantity(data.inventoryId);

    return batch;
  },

  async updateInventoryBatch(
    batchId: number,
    data: Partial<schema.InventoryBatchInsert>,
  ) {
    // Get the batch to retrieve its inventory ID before updating
    const batch = await this.getInventoryBatchById(batchId);
    if (!batch) {
      throw new Error("Batch not found");
    }

    const [updated] = await db
      .update(schema.inventoryBatches)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.inventoryBatches.id, batchId))
      .returning();

    // Update the inventory total quantity
    await this.updateInventoryTotalQuantity(batch.inventoryId);

    return updated;
  },

  async deleteInventoryBatch(batchId: number) {
    // First get the batch to retrieve its inventory ID before deleting
    const batch = await this.getInventoryBatchById(batchId);
    if (!batch) {
      throw new Error("Batch not found");
    }

    const inventoryId = batch.inventoryId;

    // Delete the batch
    const deleted = await db
      .delete(schema.inventoryBatches)
      .where(eq(schema.inventoryBatches.id, batchId))
      .returning();

    if (deleted.length === 0) {
      throw new Error("Failed to delete batch");
    }

    // Update the total quantity in the inventory record
    await this.updateInventoryTotalQuantity(inventoryId);

    return deleted[0];
  },

  async updateInventoryTotalQuantity(inventoryId: number) {
    // Get all batches for this inventory
    const batches = await this.getInventoryBatches(inventoryId);

    // Calculate the total quantity
    const totalQuantity = batches.reduce(
      (sum, batch) => sum + batch.quantity,
      0,
    );

    // Update the main inventory record
    await this.updateInventory(inventoryId, { totalQuantity });
  },

  async createBatchAuditLog(data: {
    batchId: number;
    userId: number;
    action: string;
    details: any;
    quantityBefore?: number;
    quantityAfter?: number;
  }) {
    try {
      const [logEntry] = await db
        .insert(schema.batchAuditLogs)
        .values({
          batchId: data.batchId,
          userId: data.userId,
          action: data.action,
          details: data.details,
          quantityBefore: data.quantityBefore,
          quantityAfter: data.quantityAfter,
        })
        .returning();

      return logEntry;
    } catch (error) {
      console.error("Error creating batch audit log:", error);
      // Don't throw the error to prevent disrupting main operations
      return null;
    }
  },

  async getBatchAuditLogs(batchId: number) {
    return await db.query.batchAuditLogs.findMany({
      where: eq(schema.batchAuditLogs.batchId, batchId),
      orderBy: [desc(schema.batchAuditLogs.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });
  },

  async getInventoryBatchesByProduct(
    storeId: number,
    productId: number,
    includeExpired = false,
  ) {
    // First get the inventory record
    const inventory = await this.getStoreProductInventory(storeId, productId);

    if (!inventory) {
      return [];
    }

    // Get all batches for this inventory based on expiry filter
    let batches;
    if (includeExpired) {
      batches = await db.query.inventoryBatches.findMany({
        where: eq(schema.inventoryBatches.inventoryId, inventory.id),
        orderBy: [
          asc(schema.inventoryBatches.expiryDate),
          desc(schema.inventoryBatches.createdAt),
        ],
      });
    } else {
      const now = new Date();
      batches = await db.query.inventoryBatches.findMany({
        where: and(
          eq(schema.inventoryBatches.inventoryId, inventory.id),
          or(
            isNull(schema.inventoryBatches.expiryDate),
            gt(schema.inventoryBatches.expiryDate, now),
          ),
        ),
        orderBy: [
          asc(schema.inventoryBatches.expiryDate),
          desc(schema.inventoryBatches.createdAt),
        ],
      });
    }

    return batches;
  },

  // --------- Transactions ---------
  async createTransaction(
    transactionData: schema.TransactionInsert,
    items: schema.TransactionItemInsert[],
  ) {
    try {
      // Import the batch inventory service
      const { sellProductFromBatches } = await import(
        "./services/batch-inventory"
      );

      // Start a transaction
      const [transaction] = await db
        .insert(schema.transactions)
        .values(transactionData)
        .returning();

      // Add all items
      const createdItems = [];

      for (const item of items) {
        try {
          // First attempt to update inventory by selling from batches
          const saleResult = await sellProductFromBatches(
            transaction.storeId,
            item.productId,
            item.quantity,
            transaction.cashierId,
          );

          // Insert the transaction item
          const [transItem] = await db
            .insert(schema.transactionItems)
            .values({
              ...item,
              transactionId: transaction.id,
            })
            .returning();

          createdItems.push(transItem);
        } catch (error) {
          console.error(`Error processing item ${item.productId}:`, error);
          // Continue with other items even if one fails
        }
      }

      return { transaction, items: createdItems };
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  },

  async getStoreTransactions(
    storeId: number,
    startDate?: Date,
    endDate?: Date,
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;

    let whereClause;

    if (startDate && endDate) {
      whereClause = and(
        eq(schema.transactions.storeId, storeId),
        gte(schema.transactions.createdAt, startDate),
        lte(schema.transactions.createdAt, endDate),
      );
    } else if (startDate) {
      whereClause = and(
        eq(schema.transactions.storeId, storeId),
        gte(schema.transactions.createdAt, startDate),
      );
    } else if (endDate) {
      whereClause = and(
        eq(schema.transactions.storeId, storeId),
        lte(schema.transactions.createdAt, endDate),
      );
    } else {
      whereClause = eq(schema.transactions.storeId, storeId);
    }

    const transactions = await db.query.transactions.findMany({
      where: whereClause,
      orderBy: [desc(schema.transactions.createdAt)],
      limit,
      offset,
      with: {
        cashier: true,
        store: true,
        items: {
          with: {
            product: true,
          },
        },
        paymentMethod: true,
      },
    });

    const totalCount = await db
      .select({ count: count() })
      .from(schema.transactions)
      .where(whereClause);

    return {
      transactions,
      pagination: {
        total: totalCount[0].count,
        page,
        limit,
        pages: Math.ceil(totalCount[0].count / limit),
      },
    };
  },

  async getTransactionCount(
    storeId?: number,
    startDate?: Date,
    endDate?: Date,
  ) {
    let whereClause = sql`1=1`;

    if (storeId) {
      whereClause = and(whereClause, eq(schema.transactions.storeId, storeId));
    }

    if (startDate) {
      whereClause = and(
        whereClause,
        gte(schema.transactions.createdAt, startDate),
      );
    }

    if (endDate) {
      whereClause = and(
        whereClause,
        lte(schema.transactions.createdAt, endDate),
      );
    }

    const result = await db
      .select({ count: count() })
      .from(schema.transactions)
      .where(whereClause);

    return result[0].count;
  },

  // --------- Returns & Refunds ---------
  async getReturnsByStoreId(
    storeId: number,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 20,
  ) {
    const offset = (page - 1) * limit;

    let whereClause;

    if (startDate && endDate) {
      whereClause = and(
        eq(schema.returns.storeId, storeId),
        gte(schema.returns.createdAt, startDate),
        lte(schema.returns.createdAt, endDate),
      );
    } else if (startDate) {
      whereClause = and(
        eq(schema.returns.storeId, storeId),
        gte(schema.returns.createdAt, startDate),
      );
    } else if (endDate) {
      whereClause = and(
        eq(schema.returns.storeId, storeId),
        lte(schema.returns.createdAt, endDate),
      );
    } else {
      whereClause = eq(schema.returns.storeId, storeId);
    }

    const refunds = await db.query.refunds.findMany({
      where: whereClause,
      orderBy: [desc(schema.returns.createdAt)],
      limit,
      offset,
      with: {
        approvedBy: true,
        processedBy: true,
        store: true,
        transaction: true,
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    const totalCount = await db
      .select({ count: count() })
      .from(schema.returns)
      .where(whereClause);

    return {
      refunds,
      pagination: {
        total: totalCount[0].count,
        page,
        limit,
        pages: Math.ceil(totalCount[0].count / limit),
      },
    };
  },

  async getReturnAnalytics(storeId?: number, startDate?: Date, endDate?: Date) {
    // Base query conditions
    let whereClause = sql`1=1`;

    if (storeId) {
      whereClause = and(whereClause, eq(schema.returns.storeId, storeId));
    }

    if (startDate) {
      whereClause = and(whereClause, gte(schema.returns.createdAt, startDate));
    }

    if (endDate) {
      whereClause = and(whereClause, lte(schema.returns.createdAt, endDate));
    }

    // Get total refund amount
    const totalRefundResult = await db
      .select({
        total: sql`SUM(${schema.returns.total})`,
      })
      .from(schema.returns)
      .where(whereClause);

    // Get count of returns
    const totalReturnsResult = await db
      .select({
        count: count(),
      })
      .from(schema.returns)
      .where(whereClause);

    // Get reasons breakdown
    const reasonsQuery = await db
      .select({
        reasonId: schema.returnItems.returnReasonId,
        count: count(),
      })
      .from(schema.returnItems)
      .leftJoin(
        schema.returns,
        eq(schema.returnItems.refundId, schema.returns.id),
      )
      .where(whereClause)
      .groupBy(schema.returnItems.returnReasonId);

    // Get return reasons data
    const returnReasons = await db.select().from(schema.returnReasons);

    // Format the reasons data with names
    const reasonsMap = returnReasons.reduce(
      (acc, reason) => {
        acc[reason.id] = reason.name;
        return acc;
      },
      {} as Record<number, string>,
    );

    const reasonsBreakdown = reasonsQuery.map((item) => ({
      reasonId: item.reasonId,
      reason: reasonsMap[item.reasonId] || "Unknown",
      count: item.count,
    }));

    // Get restocked vs lost breakdown
    const restockedQuery = await db
      .select({
        isRestocked: schema.returnItems.isRestocked,
        count: count(),
      })
      .from(schema.returnItems)
      .leftJoin(
        schema.returns,
        eq(schema.returnItems.refundId, schema.returns.id),
      )
      .where(whereClause)
      .groupBy(schema.returnItems.isRestocked);

    const restockedBreakdown = {
      restocked: 0,
      lost: 0,
    };

    restockedQuery.forEach((item) => {
      if (item.isRestocked) {
        restockedBreakdown.restocked = Number(item.count);
      } else {
        restockedBreakdown.lost = Number(item.count);
      }
    });

    // Return compiled analytics
    return {
      totalRefundAmount: totalRefundResult[0]?.total || 0,
      totalReturns: totalReturnsResult[0]?.count || 0,
      reasonsBreakdown,
      restockedBreakdown,
    };
  },
};
