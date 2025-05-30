import { storage } from "../storage";
import * as schema from "@shared/schema";
import { db } from "@db";
import { desc, sql, eq, and, gte, lte, count } from "drizzle-orm";

/**
 * Get sales trend analysis data
 * @param storeId Optional store ID to filter by
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @param groupBy How to group the data ('day', 'week', or 'month')
 * @returns Sales trend analysis data
 */
export async function getSalesTrendsAnalysis(
  storeId?: number, 
  startDate?: Date, 
  endDate?: Date, 
  groupBy: 'day' | 'week' | 'month' = 'day'
) {
  return await storage.getSalesTrends(storeId, startDate, endDate, groupBy);
}

/**
 * Get store performance comparison data
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @returns Store performance metrics
 */
export async function getStorePerformanceComparison(
  startDate?: Date,
  endDate?: Date
) {
  // Get all stores for metadata
  const stores = await storage.getAllStores();
  
  // Base query conditions for date filtering
  let transactionWhereClause = sql`1=1`;
  
  if (startDate) {
    transactionWhereClause = sql`${transactionWhereClause} AND ${schema.transactions.createdAt} >= ${startDate}`;
  }
  
  if (endDate) {
    transactionWhereClause = sql`${transactionWhereClause} AND ${schema.transactions.createdAt} <= ${endDate}`;
  }
  
  // Get transaction metrics by store
  const storeMetrics = await db.select({
    storeId: schema.transactions.storeId,
    totalRevenue: sql`SUM(${schema.transactions.total})`,
    averageTransaction: sql`AVG(${schema.transactions.total})`,
    transactionCount: count(),
  })
  .from(schema.transactions)
  .where(transactionWhereClause)
  .groupBy(schema.transactions.storeId)
  .orderBy(desc(sql`SUM(${schema.transactions.total})`));
  
  // Get top products by store with robust error handling
  const topProductsByStore = await Promise.all(
    stores.map(async (store) => {
      try {
        // For transaction items, we need to join with transactions to apply the date filtering
        const topProducts = await db.select({
          productId: schema.transactionItems.productId,
          productName: schema.products.name,
          quantity: sql`SUM(${schema.transactionItems.quantity})`,
          total: sql`SUM(${schema.transactionItems.subtotal})`,
        })
        .from(schema.transactionItems)
        .leftJoin(schema.products, eq(schema.transactionItems.productId, schema.products.id))
        .leftJoin(schema.transactions, eq(schema.transactionItems.transactionId, schema.transactions.id))
        .where(
          sql`${schema.transactions.storeId} = ${store.id} AND ${transactionWhereClause}`
        )
        .groupBy(schema.transactionItems.productId, schema.products.name)
        .orderBy(desc(sql`SUM(${schema.transactionItems.quantity})`))
        .limit(5);
      
        return {
          storeId: store.id,
          topProducts
        };
      } catch (error: unknown) {
        console.error(`Error fetching top products for store ${store.id}:`, error);
        return {
          storeId: store.id,
          topProducts: []
        };
      }
    })
  );
  
  // Combine store metadata with performance metrics
  const storePerformance = stores.map(store => {
    const metrics = storeMetrics.find(m => m.storeId === store.id) || {
      totalRevenue: 0,
      averageTransaction: 0,
      transactionCount: 0
    };
    
    const topProducts = topProductsByStore.find(p => p.storeId === store.id)?.topProducts || [];
    
    return {
      ...store,
      metrics: {
        totalRevenue: parseFloat(metrics.totalRevenue as string) || 0,
        averageTransaction: parseFloat(metrics.averageTransaction as string) || 0,
        transactionCount: Number(metrics.transactionCount) || 0
      },
      topProducts
    };
  });
  
  // Calculate global totals for comparison
  const globalTotal = storeMetrics.reduce(
    (acc, curr) => {
      acc.totalRevenue += parseFloat(curr.totalRevenue as string) || 0;
      acc.transactionCount += Number(curr.transactionCount) || 0;
      return acc;
    },
    { totalRevenue: 0, transactionCount: 0 }
  );
  
  // Calculate global average transaction value
  const globalAvgTransaction = globalTotal.transactionCount > 0 
    ? globalTotal.totalRevenue / globalTotal.transactionCount 
    : 0;
  
  return {
    storePerformance,
    globalMetrics: {
      totalRevenue: globalTotal.totalRevenue,
      averageTransaction: globalAvgTransaction,
      transactionCount: globalTotal.transactionCount
    }
  };
}

/**
 * Get a formatted date range description
 * @param startDate Start date
 * @param endDate End date
 * @returns Formatted date range description
 */
export function getDateRangeDescription(startDate?: Date, endDate?: Date): string {
  if (!startDate && !endDate) {
    return 'All time';
  }
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC' // Ensuring consistent timezone
    });
  };
  
  if (startDate && endDate) {
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }
  
  if (startDate) {
    return `From ${formatDate(startDate)}`;
  }
  
  return `Until ${formatDate(endDate!)}`;
}