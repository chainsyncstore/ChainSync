import { db } from "../db"; // pool removed
import * as schema from "../shared/schema";
import { eq, and, or, desc, gte, sql, count as drizzleCount, isNull, asc } from "drizzle-orm"; // lte, like, not, SQL, inArray, gt, lt removed
// import * as bcrypt from "bcrypt"; // Unused
// import crypto from "crypto"; // Unused

export const storage = {
  // --------- Cashier Sessions ---------
  async createCashierSession(data: { storeId: number; userId: number; notes?: string }) {
    const [session] = await db.insert(schema.cashierSessions).values(data).returning();
    return session;
  },
  
  getCashierSessionById: async (sessionId: number) => {
    return await db.query.cashierSessions.findFirst({
      where: eq(schema.cashierSessions.id, sessionId),
      with: {
        user: true,
        store: true
      }
    });
  },
  
  getActiveCashierSession: async (userId: number) => {
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
  
  updateCashierSession: async (sessionId: number, data: Partial<schema.CashierSessionInsert>) => {
    const [updated] = await db.update(schema.cashierSessions)
      .set({
        ...data,
        // updatedAt is auto-managed by the database
      })
      .where(eq(schema.cashierSessions.id, sessionId))
      .returning();
    return updated;
  },
  
  getCashierSessionHistory: async (userId: number, page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    
    const sessions = await db.query.cashierSessions.findMany({
      where: eq(schema.cashierSessions.userId, userId),
      with: {
        user: true,
        store: true
      },
      offset,
      limit
    });

    const total = await db.select({ count: drizzleCount() })
      .from(schema.cashierSessions)
      .where(eq(schema.cashierSessions.userId, userId))
      .then(results => results[0].count);

    return {
      sessions,
      total,
      page,
      limit
    };
  },

  // --------- Notifications ---------
  async createNotification(data: { userId: number; title: string; message: string; type: string; storeId?: number }) {
    try {
      const [notification] = await db.insert(schema.notifications)
        .values(data)
        .returning();
      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  },

  getUserNotifications: async (userId: number, options: { includeRead?: boolean } = {}) => {
    try {
      const query = await db.query.notifications.findMany({
        where: eq(schema.notifications.userId, userId),
        orderBy: [desc(schema.notifications.createdAt)],
        with: {
          store: true
        }
      });

      if (!options.includeRead) {
        return query.filter(notification => !notification.isRead);
      }

      return query;
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      throw error;
    }
  },

  getUnreadNotificationCount: async (userId: number) => {
    try {
      const result = await db.select({ count: drizzleCount() })
        .from(schema.notifications)
        .where(and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false)
        ));
      return result[0].count;
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      throw error;
    }
  },

  markNotificationAsRead: async (notificationId: number) => {
    try {
      const [updated] = await db.update(schema.notifications)
        .set({
          // isRead and readAt fields update handled separately
        })
        .where(eq(schema.notifications.id, notificationId))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  },

  markAllNotificationsAsRead: async (userId: number) => {
    try {
      const updated = await db.update(schema.notifications)
        .set({
          // isRead and readAt fields update handled separately
        })
        .where(eq(schema.notifications.userId, userId))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  },

  createSystemNotifications: async (title: string, message: string, type: schema.NotificationInsert['type'], storeId?: number) => {
    try {
      // Get users to notify
      let conditions = eq(schema.users.isActive, true);
      
      // If storeId is provided, include store-specific users
      if (storeId) {
        conditions = and(
          conditions,
          or(
            eq(schema.users.storeId, storeId),
            isNull(schema.users.storeId) // Admin users don't have a specific store
          )
        );
      }

      const users = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(conditions);

      // Create notifications for each user
      const notifications = users.map(user => ({
        userId: user.id,
        storeId,
        title,
        message,
        type,
        isRead: false
      }));

      if (notifications.length > 0) {
        await db.insert(schema.notifications).values(notifications);
      }

      return true;
    } catch (error) {
      console.error("Error creating system notifications:", error);
      throw error;
    }
  },

  // --------- Analytics for AI ---------
  getStoreSalesComparison: async (days: number = 7) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const results = await db.query.stores.findMany({});
    
    // Get transactions separately to avoid relationship issues
    const transactions = await db.query.transactions.findMany({
      where: gte(schema.transactions.createdAt, startDate),
      columns: {
        id: true,
        storeId: true,
        totalAmount: true,
        createdAt: true
      }
    });
    
    // Format results for AI processing
    return results.map(store => {
      const storeTransactions = transactions.filter(t => t.storeId === store.id);
      const totalAmount = storeTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.totalAmount), 0);
      
      return {
        storeName: store.name,
        salesCount: storeTransactions.length,
        salesTotal: totalAmount,
        salesAverage: storeTransactions.length > 0 ? totalAmount / storeTransactions.length : 0
      };
    });
  },
  
  getDailySalesData: async (storeId: number, days: number = 7) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const transactions = await db.query.transactions.findMany({
      where: and(
        eq(schema.transactions.storeId, storeId),
        gte(schema.transactions.createdAt, startDate)
      ),
      orderBy: [asc(schema.transactions.createdAt)]
    });
    
    // Group by day
    const dailyData: Record<string, {date: string, count: number, total: number}> = {};
    transactions.forEach(t => {
      const dateStr = t.createdAt.toISOString().split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {date: dateStr, count: 0, total: 0};
      }
      dailyData[dateStr].count++;
      dailyData[dateStr].total += parseFloat(t.totalAmount);
    });
    
    return Object.values(dailyData);
  }
};
