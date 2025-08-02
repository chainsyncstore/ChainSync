'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
Object.defineProperty(exports, '__esModule', { _value: true });
exports.getStorePerformanceComparison = getStorePerformanceComparison;
exports.getDateRangeDescription = getDateRangeDescription;
const storage_1 = require('../storage');
const schema = __importStar(require('@shared/schema'));
const _db_1 = require('@db');
const drizzle_orm_1 = require('drizzle-orm'); // and, gte, lte removed
/**
 * Get store performance comparison data
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @returns Store performance metrics
 */
async function getStorePerformanceComparison(startDate, endDate) {
  // Get all stores for metadata
  const stores = await storage_1.storage.getAllStores();
  // Base query conditions for date filtering
  let transactionWhereClause = (0, drizzle_orm_1.sql) `1=1`;
  if (startDate) {
    transactionWhereClause = (0, drizzle_orm_1.sql) `${transactionWhereClause} AND ${schema.transactions.createdAt} >= ${startDate}`;
  }
  if (endDate) {
    transactionWhereClause = (0, drizzle_orm_1.sql) `${transactionWhereClause} AND ${schema.transactions.createdAt} <= ${endDate}`;
  }
  // Get transaction metrics by store
  const storeMetrics = await _db_1.db.select({
    _storeId: schema.transactions.storeId,
    _totalRevenue: (0, drizzle_orm_1.sql) `SUM(${schema.transactions.total})`,
    _averageTransaction: (0, drizzle_orm_1.sql) `AVG(${schema.transactions.total})`,
    _transactionCount: (0, drizzle_orm_1.count)()
  })
    .from(schema.transactions)
    .where(transactionWhereClause)
    .groupBy(schema.transactions.storeId)
    .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `SUM(${schema.transactions.total})`));
    // Get top products by store with robust error handling
  const topProductsByStore = await Promise.all(stores.map(async(store) => {
    try {
      // For transaction items, we need to join with transactions to apply the date filtering
      const topProducts = await _db_1.db.select({
        _productId: schema.transactionItems.productId,
        _productName: schema.products.name,
        _quantity: (0, drizzle_orm_1.sql) `SUM(${schema.transactionItems.quantity})`,
        _total: (0, drizzle_orm_1.sql) `SUM(${schema.transactionItems.unitPrice} * ${schema.transactionItems.quantity})`
      })
        .from(schema.transactionItems)
        .leftJoin(schema.products, (0, drizzle_orm_1.eq)(schema.transactionItems.productId, schema.products.id))
        .leftJoin(schema.transactions, (0, drizzle_orm_1.eq)(schema.transactionItems.transactionId, schema.transactions.id))
        .where((0, drizzle_orm_1.sql) `${schema.transactions.storeId} = ${store.id} AND ${transactionWhereClause}`)
        .groupBy(schema.transactionItems.productId, schema.products.name)
        .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `SUM(${schema.transactionItems.quantity})`))
        .limit(5);
      return {
        _storeId: store.id,
        topProducts
      };
    }
    catch (error) {
      console.error(`Error fetching top products for store ${store.id}:`, error);
      return {
        _storeId: store.id,
        _topProducts: []
      };
    }
  }));
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
        _totalRevenue: parseFloat(metrics.totalRevenue) || 0,
        _averageTransaction: parseFloat(metrics.averageTransaction) || 0,
        _transactionCount: Number(metrics.transactionCount) || 0
      },
      topProducts
    };
  });
    // Calculate global totals for comparison
  const globalTotal = storeMetrics.reduce((acc, curr) => {
    acc.totalRevenue += parseFloat(curr.totalRevenue) || 0;
    acc.transactionCount += Number(curr.transactionCount) || 0;
    return acc;
  }, { _totalRevenue: 0, _transactionCount: 0 });
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
function getDateRangeDescription(startDate, endDate) {
  if (!startDate && !endDate) {
    return 'All time';
  }
  const formatDate = (date) => {
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
  return `Until ${formatDate(endDate)}`;
}
