import { db } from "../db";
import { schema } from "../shared/db/index"; // Direct import from shared/db/index
import { AppError, ErrorCategory, ErrorCode } from "../shared/types/errors";
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

/**
 * Type definitions for database entities and return values
 */
interface PaginationResult {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface CashierSessionResult {
  sessions: (typeof schema.cashierSessions.$inferSelect)[];
  pagination: PaginationResult;
}

interface TransactionResult {
  transaction: typeof schema.transactions.$inferSelect;
  items: (typeof schema.transactionItems.$inferSelect)[];
}

interface TransactionListResult {
  transactions: (typeof schema.transactions.$inferSelect)[];
  pagination: PaginationResult;
}

interface ReturnReason {
  reasonId: number;
  reason: string;
  count: number;
}

interface RestockedBreakdown {
  restocked: number;
  lost: number;
}

interface ReturnAnalytics {
  totalRefundAmount: number;
  totalReturns: number;
  reasonsBreakdown: ReturnReason[];
  restockedBreakdown: RestockedBreakdown;
}

export const storage = {
  // --------- Cashier Sessions ---------
  async createCashierSession(data: typeof schema.cashierSessions.$inferInsert) {
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
    data: Partial<typeof schema.cashierSessions.$inferInsert>,
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

  /**
   * Get paginated cashier session history for a user
   * @param userId - The user ID to get sessions for
   * @param page - The page number (default: 1)
   * @param limit - The number of items per page (default: 10)
   * @returns Paginated list of cashier sessions
   */
  async getCashierSessionHistory(userId: number, page = 1, limit = 10): Promise<CashierSessionResult> {
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

  // --------- Notifications ---------
  async createNotification(data: typeof schema.notifications.$inferInsert) {
    try {
      const [notification] = await db.insert(schema.notifications)
        .values(data)
        .returning();
      return notification;
    } catch (error: unknown) {
      console.error("Error creating notification:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', ErrorCategory.SYSTEM, ErrorCode.UNKNOWN_ERROR, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async getUserNotifications(userId: number, limit: number, offset: number, includeRead: boolean) {
    try {
      const queryBuilder = db.query.notifications.findMany({
        where: eq(schema.notifications.userId, userId),
        orderBy: [desc(schema.notifications.createdAt)],
        limit: limit,
        offset: offset,
        with: {
          store: true
        }
      });

      let notifications = await queryBuilder;

      if (!includeRead) {
        notifications = notifications.filter((notification: typeof schema.notifications.$inferSelect) => !notification.isRead);
      }
      // Ensure total count is also fetched for pagination if needed, or adjust return type
      return notifications; 
    } catch (error: unknown) {
      console.error("Error fetching user notifications:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', ErrorCategory.SYSTEM, ErrorCode.UNKNOWN_ERROR, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async getUnreadNotificationCount(userId: number) {
    try {
      const result = await db.select({ count: count() })
        .from(schema.notifications)
        .where(and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false)
        ));
      return result[0].count;
    } catch (error: unknown) {
      console.error("Error getting unread notification count:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', ErrorCategory.SYSTEM, ErrorCode.UNKNOWN_ERROR, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async markNotificationAsRead(notificationId: number) {
    try {
      const [updated] = await db.update(schema.notifications)
        .set({
          isRead: true,
          readAt: new Date()
        })
        .where(eq(schema.notifications.id, notificationId))
        .returning();
      return updated;
    } catch (error: unknown) {
      console.error("Error marking notification as read:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', ErrorCategory.SYSTEM, ErrorCode.UNKNOWN_ERROR, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async markAllNotificationsAsRead(userId: number) {
    try {
      const updated = await db.update(schema.notifications)
        .set({
          isRead: true,
          readAt: new Date()
        })
        .where(eq(schema.notifications.userId, userId))
        .returning();
      return updated;
    } catch (error: unknown) {
      console.error("Error marking all notifications as read:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', ErrorCategory.SYSTEM, ErrorCode.UNKNOWN_ERROR, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async createSystemNotifications(title: string, message: string, type: (typeof schema.notifications.$inferInsert)['type'], storeId?: number) {
    try {
      let conditions: SQL | undefined;
      if (storeId) {
        conditions = 
          or(
            eq(schema.users.storeId, storeId),
            isNull(schema.users.storeId) // To include users not assigned to any specific store (e.g., global admins)
          );
      }
      // If no storeId is provided, conditions will be undefined, fetching all users.
      // If you want to ensure only 'active' users are notified, you'd need an 'isActive' field or similar logic.
      // For now, removing the schema.users.isActive filter as it doesn't exist.

      const usersToNotifyQuery = db.select({ id: schema.users.id }).from(schema.users);
      if (conditions) {
        usersToNotifyQuery.where(conditions);
      }
      const usersToNotify = await usersToNotifyQuery;

      if (usersToNotify.length === 0) return true;

      const newNotifications = usersToNotify.map(user => ({
        userId: user.id,
        storeId,
        title,
        message,
        type,
        isRead: false
      }));

      await db.insert(schema.notifications).values(newNotifications);
      return true;
    } catch (error: unknown) {
      console.error("Error creating system notifications:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', ErrorCategory.SYSTEM, ErrorCode.UNKNOWN_ERROR, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  // --------- Analytics for AI ---------
  async getStoreSalesComparison(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const storesWithTransactions = await db.query.stores.findMany({
      with: {
        transactions: {
          where: gte(schema.transactions.createdAt, startDate),
          columns: {
            total: true,
          }
        }
      }
    });
    
    return storesWithTransactions.map((store: (typeof schema.stores.$inferSelect & { transactions: (typeof schema.transactions.$inferSelect)[] })) => ({
      storeId: store.id,
      storeName: store.name,
      totalSales: store.transactions.reduce((sum: number, t: typeof schema.transactions.$inferSelect) => sum + parseFloat(t.total), 0),
      transactionCount: store.transactions.length,
    }));
  },
  
  async getDailySalesData(storeIdInput?: number, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const conditions: (SQL | undefined)[] = [gte(schema.transactions.createdAt, startDate)];
    if (storeIdInput !== undefined) {
      conditions.push(eq(schema.transactions.storeId, storeIdInput));
    }

    const transactions = await db.query.transactions.findMany({
      where: and(...conditions.filter(c => c !== undefined) as SQL[]),
      orderBy: [asc(schema.transactions.createdAt)],
      columns: {
        createdAt: true,
        total: true,
        storeId: true, // Include storeId for potential grouping if storeIdInput is undefined
      }
    });
    
    const dailyData: Record<string, {date: string, transactionCount: number, totalSales: number}> = {};
    transactions.forEach((t: typeof schema.transactions.$inferSelect) => {
      const dateStr = t.createdAt.toISOString().split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {date: dateStr, transactionCount: 0, totalSales: 0};
      }
      dailyData[dateStr].transactionCount++;
      dailyData[dateStr].totalSales += parseFloat(t.total);
    });
    
    return Object.values(dailyData);
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

  async createLoyaltyMember(data: typeof schema.loyaltyMembers.$inferInsert) {
    const [member] = await db
      .insert(schema.loyaltyMembers)
      .values(data)
      .returning();
    return member;
  },

  async updateLoyaltyMember(
    memberId: number,
    data: Partial<typeof schema.loyaltyMembers.$inferInsert>,
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

  async createLoyaltyProgram(data: typeof schema.loyaltyPrograms.$inferInsert) {
    const [program] = await db
      .insert(schema.loyaltyPrograms)
      .values(data)
      .returning();
    return program;
  },

  async updateLoyaltyProgram(
    programId: number,
    data: Partial<typeof schema.loyaltyPrograms.$inferInsert>,
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

  async createLoyaltyTier(data: typeof schema.loyaltyTiers.$inferInsert) {
    const [tier] = await db
      .insert(schema.loyaltyTiers)
      .values(data)
      .returning();
    return tier;
  },

  async updateLoyaltyTier(
    tierId: number,
    data: Partial<typeof schema.loyaltyTiers.$inferInsert>,
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

  async createLoyaltyReward(data: typeof schema.loyaltyRewards.$inferInsert) {
    const [reward] = await db
      .insert(schema.loyaltyRewards)
      .values(data)
      .returning();
    return reward;
  },

  async updateLoyaltyReward(
    rewardId: number,
    data: Partial<typeof schema.loyaltyRewards.$inferInsert>,
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

  async createLoyaltyTransaction(data: typeof schema.loyaltyTransactions.$inferInsert) {
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
    } catch (error: unknown) {
      console.error("Error getting affiliate by user ID:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error: unknown) {
      console.error("Error getting affiliate by code:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async createAffiliate(data: typeof schema.affiliates.$inferInsert) {
    try {
      const [affiliate] = await db
        .insert(schema.affiliates)
        .values(data)
        .returning();

      return affiliate;
    } catch (error: unknown) {
      console.error("Error creating affiliate:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async updateAffiliate(
    affiliateId: number,
    data: Partial<typeof schema.affiliates.$inferInsert>,
  ) {
    try {
      const [updatedAffiliate] = await db
        .update(schema.affiliates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.affiliates.id, affiliateId))
        .returning();

      return updatedAffiliate;
    } catch (error: unknown) {
      console.error("Error updating affiliate:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error: unknown) {
      console.error("Error getting referrals by affiliate ID:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async createReferral(data: typeof schema.referrals.$inferInsert) {
    try {
      const [referral] = await db
        .insert(schema.referrals)
        .values(data)
        .returning();

      return referral;
    } catch (error: unknown) {
      console.error("Error creating referral:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async updateReferral(
    referralId: number,
    data: Partial<typeof schema.referrals.$inferInsert>,
  ) {
    try {
      // Assuming 'updatedAt' is managed by the database or not part of this specific update type
      const [updatedReferral] = await db
        .update(schema.referrals)
        .set(data) 
        .where(eq(schema.referrals.id, referralId))
        .returning();

      return updatedReferral;
    } catch (error: unknown) {
      console.error("Error updating referral:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error: unknown) {
      console.error("Error getting subscription by user ID:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async createSubscription(data: typeof schema.subscriptions.$inferInsert) {
    try {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values(data)
        .returning();

      return subscription;
    } catch (error: unknown) {
      console.error("Error creating subscription:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async updateSubscription(
    subscriptionId: number,
    data: Partial<typeof schema.subscriptions.$inferInsert>,
  ) {
    try {
      const [updatedSubscription] = await db
        .update(schema.subscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.subscriptions.id, subscriptionId))
        .returning();

      return updatedSubscription;
    } catch (error: unknown) {
      console.error("Error updating subscription:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error: unknown) {
      console.error("Error getting referral payments by affiliate ID:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async createReferralPayment(data: typeof schema.referralPayments.$inferInsert) {
    try {
      const [payment] = await db
        .insert(schema.referralPayments)
        .values(data)
        .returning();

      return payment;
    } catch (error: unknown) {
      console.error("Error creating referral payment:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  async updateReferralPayment(
    paymentId: number,
    data: Partial<typeof schema.referralPayments.$inferInsert>,
  ) {
    try {
      // Assuming 'updatedAt' is managed by the database or not part of this specific update type
      const [updatedPayment] = await db
        .update(schema.referralPayments)
        .set(data)
        .where(eq(schema.referralPayments.id, paymentId))
        .returning();

      return updatedPayment;
    } catch (error: unknown) {
      console.error("Error updating referral payment:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
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

  async createUser(userData: typeof schema.users.$inferInsert) {
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

  async updateUser(userId: number, userData: Partial<typeof schema.users.$inferInsert>) {
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
  ): Promise<typeof schema.passwordResetTokens.$inferSelect> {
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
  ): Promise<typeof schema.passwordResetTokens.$inferSelect | null> {
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

  async createStore(storeData: typeof schema.stores.$inferInsert) {
    const [store] = await db
      .insert(schema.stores)
      .values(storeData)
      .returning();

    return store;
  },

  async updateStore(storeId: number, storeData: Partial<typeof schema.stores.$inferInsert>) {
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

  async createProduct(productData: typeof schema.products.$inferInsert) {
    const [product] = await db
      .insert(schema.products)
      .values(productData)
      .returning();

    return product;
  },

  async updateProduct(
    productId: number,
    productData: Partial<typeof schema.products.$inferInsert>,
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

  async createInventory(data: typeof schema.inventory.$inferInsert) {
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
    data: Partial<typeof schema.inventory.$inferInsert>,
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

  async createInventoryBatch(data: typeof schema.inventoryBatches.$inferInsert) {
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
    data: Partial<typeof schema.inventoryBatches.$inferInsert>,
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
      (sum: number, batch: typeof schema.inventoryBatches.$inferSelect) => sum + batch.quantity,
      0,
    );

    // Update the main inventory record
    await this.updateInventory(inventoryId, { totalQuantity });
  },

  async createBatchAuditLog(data: {
    batchId: number;
    userId: number;
    action: string;
    details: unknown;
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
    } catch (error: unknown) {
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
  /**
   * Create a new transaction with multiple items
   * Uses batch inventory management to update stock levels
   * @param transactionData - The transaction data to insert
   * @param items - The transaction items to insert
   * @returns The created transaction and items
   */
  async createTransaction(
    transactionData: typeof schema.transactions.$inferInsert,
    items: (typeof schema.transactionItems.$inferInsert)[],
  ): Promise<TransactionResult> {
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
      const createdItems: schema.TransactionItem[] = [];

      for (const item of items) {
        try {
          // Ensure storeId and cashierId are present and valid before calling sellProductFromBatches
          if (transaction.storeId === null || transaction.storeId === undefined) {
            console.error(`Transaction ${transaction.id} is missing storeId. Skipping item ${item.productId}.`);
            continue; 
          }
          // Assuming cashierId is non-nullable based on typical transaction requirements.
          // If schema allows null, this check needs to be robust or schema adjusted.
          if (transaction.cashierId === null || transaction.cashierId === undefined) { 
             console.error(`Transaction ${transaction.id} is missing cashierId. Skipping item ${item.productId}.`);
             continue;
          }
          // Ensure productId is present for the item
          if (item.productId === null || item.productId === undefined) {
            console.error(`Transaction item is missing productId. Skipping item.`);
            continue;
          }

          // First attempt to update inventory by selling from batches
          const saleResult = await sellProductFromBatches(
            transaction.storeId, 
            item.productId, // Now known to be non-null
            item.quantity,
            transaction.cashierId 
          );

          // Insert the transaction item
          const [transItem] = await db
            .insert(schema.transactionItems)
            .values({
              ...item,
              unitPrice: String(item.unitPrice), // Ensure unitPrice is a string
              transactionId: transaction.id,
            })
            .returning({
              id: schema.transactionItems.id,
              transactionId: schema.transactionItems.transactionId, // Assuming this is a column
              productId: schema.transactionItems.productId,
              quantity: schema.transactionItems.quantity,
              unitPrice: schema.transactionItems.unitPrice,
              notes: schema.transactionItems.notes, 
              discount: schema.transactionItems.discount,
              tax: schema.transactionItems.tax,
              createdAt: schema.transactionItems.createdAt, 
              updatedAt: schema.transactionItems.updatedAt, 
              deletedAt: schema.transactionItems.deletedAt, // Added deletedAt
              // Assuming transactionItemId is the 'id' itself, which is already included.
              // Assuming inventoryBatchId is not directly on transactionItems or handled differently.
            });

          createdItems.push(transItem);
        } catch (error: unknown) {
          console.error(`Error processing item ${item.productId}:`, error);
          // Continue with other items even if one fails
        }
      }

      return { transaction, items: createdItems };
    } catch (error: unknown) {
      console.error("Error creating transaction:", error);
      throw error instanceof AppError ? error : new AppError('Unexpected error', ErrorCategory.SYSTEM, ErrorCode.UNKNOWN_ERROR, { error: error instanceof Error ? error.message : 'Unknown error' });
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

  /**
   * Get analytics data for returns/refunds with filtering options
   * @param storeId - Optional store ID to filter by
   * @param startDate - Optional start date to filter by
   * @param endDate - Optional end date to filter by
   * @returns Comprehensive analytics for returns and refunds
   */
  async getReturnAnalytics(storeId?: number, startDate?: Date, endDate?: Date): Promise<ReturnAnalytics> {
    try {
      const whereConditions: SQL[] = [];
      if (storeId) {
        // Assuming schema.returns.storeId is the correct column for store filtering on the returns table
        whereConditions.push(eq(schema.returns.storeId, storeId));
      }
      if (startDate) {
        whereConditions.push(gte(schema.returns.createdAt, startDate));
      }
      if (endDate) {
        whereConditions.push(lte(schema.returns.createdAt, endDate));
      }
      const finalWhereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Get total refund amount
      const totalRefundResult = await db
        .select({ total: sql<number>`sum(${schema.returns.total})`.mapWith(Number) })
        .from(schema.returns)
        .where(finalWhereClause);
      const totalRefundAmount = totalRefundResult[0]?.total || 0;

      // Get count of returns
      const totalReturnsResult = await db
        .select({ count: count() })
        .from(schema.returns)
        .where(finalWhereClause);
      const totalReturns = totalReturnsResult[0]?.count || 0;

      // Get reasons breakdown
      // This assumes schema.returnItems, schema.returns, and schema.returnReasons are defined
      // and that finalWhereClause applies to the 'returns' table in the join.
      const reasonsDataRaw = await db
        .select({
          reasonId: schema.returnItems.returnReasonId,
          count: count(schema.returnItems.id).as("count"),
        })
        .from(schema.returnItems)
        .leftJoin(schema.returns, eq(schema.returnItems.refundId, schema.returns.id))
        .where(finalWhereClause) // Applies conditions to the joined 'returns' table
        .groupBy(schema.returnItems.returnReasonId);

      const allReturnReasons = await db
        .select({ id: schema.returnReasons.id, name: schema.returnReasons.name })
        .from(schema.returnReasons);

      const reasonsMap = allReturnReasons.reduce(
        (acc: Record<number, string>, reason) => {
          acc[reason.id] = reason.name;
          return acc;
        },
        {},
      );

      const reasonsBreakdown: ReturnReason[] = reasonsDataRaw
        .filter(item => item.reasonId !== null)
        .map((item) => ({
          reasonId: item.reasonId!,
          reason: reasonsMap[item.reasonId!] || "Unknown",
          count: Number(item.count),
        }));

      // Get restocked vs lost breakdown
      const restockedDataRaw = await db
        .select({
          isRestocked: schema.returnItems.isRestocked,
          count: count(schema.returnItems.id).as("count"),
        })
        .from(schema.returnItems)
        .leftJoin(schema.returns, eq(schema.returnItems.refundId, schema.returns.id))
        .where(finalWhereClause) // Applies conditions to the joined 'returns' table
        .groupBy(schema.returnItems.isRestocked);

      const restockedBreakdown: RestockedBreakdown = { restocked: 0, lost: 0 };
      restockedDataRaw.forEach((item) => {
        if (item.isRestocked) {
          restockedBreakdown.restocked = Number(item.count);
        } else {
          restockedBreakdown.lost = Number(item.count);
        }
      });

      return {
        totalRefundAmount,
        totalReturns,
        reasonsBreakdown,
        restockedBreakdown,
      };
    } catch (error: unknown) {
      console.error("Error generating return analytics:", error);
      throw error instanceof AppError ? error : new AppError('Error generating analytics', ErrorCategory.SYSTEM, ErrorCode.DATABASE_ERROR, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};
