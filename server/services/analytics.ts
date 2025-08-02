import { storage } from '../storage';
import * as schema from '@shared/schema';
import { db } from '@db';
import { desc, sql, eq, count } from 'drizzle-orm'; // and, gte, lte removed

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
    _storeId: schema.transactions.storeId,
    _totalRevenue: sql`SUM(${schema.transactions.total})`,
    _averageTransaction: sql`AVG(${schema.transactions.total})`,
    _transactionCount: count()
  })
  .from(schema.transactions)
  .where(transactionWhereClause)
  .groupBy(schema.transactions.storeId)
  .orderBy(desc(sql`SUM(${schema.transactions.total})`));

  // Get top products by store with robust error handling
  const topProductsByStore = await Promise.all(
    stores.map(async(store) => {
      try {
        // For transaction items, we need to join with transactions to apply the date filtering
        const topProducts = await db.select({
          _productId: schema.transactionItems.productId,
          _productName: schema.products.name,
          _quantity: sql`SUM(${schema.transactionItems.quantity})`,
          _total: sql`SUM(${schema.transactionItems.unitPrice} * ${schema.transactionItems.quantity})`
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
          _storeId: store.id,
          topProducts
        };
      } catch (error) {
        console.error(`Error fetching top products for store ${store.id}:`, error);
        return {
          _storeId: store.id,
          _topProducts: []
        };
      }
    })
  );

  // Combine store metadata with performance metrics
  const storePerformance = stores.map(store => {
    const metrics = storeMetrics.find(m => m.storeId === store.id) || {
      _totalRevenue: 0,
      _averageTransaction: 0,
      _transactionCount: 0
    };

    const topProducts = topProductsByStore.find(p => p.storeId === store.id)?.topProducts || [];

    return {
      ...store,
      _metrics: {
        _totalRevenue: parseFloat(metrics.totalRevenue as string) || 0,
        _averageTransaction: parseFloat(metrics.averageTransaction as string) || 0,
        _transactionCount: Number(metrics.transactionCount) || 0
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
    { _totalRevenue: 0, _transactionCount: 0 }
  );

  // Calculate global average transaction value
  const globalAvgTransaction = globalTotal.transactionCount > 0
    ? globalTotal.totalRevenue / globalTotal._transactionCount
    : 0;

  return {
    storePerformance,
    _globalMetrics: {
      _totalRevenue: globalTotal.totalRevenue,
      _averageTransaction: globalAvgTransaction,
      _transactionCount: globalTotal.transactionCount
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

  const formatDate = (_date: Date) => {
    return date.toLocaleDateString('en-US', {
      _year: 'numeric',
      _month: 'short',
      _day: 'numeric',
      _timeZone: 'UTC' // Ensuring consistent timezone
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
