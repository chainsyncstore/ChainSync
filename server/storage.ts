import { db, pool } from "../db";
import * as schema from "../shared/schema";
import { eq, and, or, desc, lte, gte, sql, like, count, isNull, not, SQL, inArray, asc, gt, lt } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import crypto from "crypto";

export const storage = {
  // --------- Cashier Sessions ---------
  createCashierSession: async (data: schema.CashierSessionInsert) => {
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
        updatedAt: new Date()
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

    const total = await db.select({ count: count() })
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
  createNotification: async (data: schema.NotificationInsert) => {
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
      const count = await db.select({ count: count() })
        .from(schema.notifications)
        .where(and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false)
        ));
      return count[0].count;
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      throw error;
    }
  },

  markNotificationAsRead: async (notificationId: number) => {
    try {
      const [updated] = await db.update(schema.notifications)
        .set({
          isRead: true,
          readAt: new Date()
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
          isRead: true,
          readAt: new Date()
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
    
    const results = await db.query.stores.findMany({
      with: {
        transactions: {
          where: gte(schema.transactions.createdAt, startDate),
          columns: {
            id: true,
            total: true,
            createdAt: true
          }
        }
      }
    });
    
    // Format results for AI processing
    return results.map(store => ({
      storeName: store.name,
      salesCount: store.transactions.length,
      salesTotal: store.transactions.reduce((sum, t) => sum + parseFloat(t.total), 0),
      salesAverage: store.transactions.length > 0 
        ? store.transactions.reduce((sum, t) => sum + parseFloat(t.total), 0) / store.transactions.length 
        : 0
    }));
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
      dailyData[dateStr].total += parseFloat(t.total);
    });
    
    return Object.values(dailyData);
  }
};
