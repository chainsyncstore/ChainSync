// src/database/query-optimizer.ts
import { executeQuery, getConnectionPool } from './connection-pool.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger().child({ component: 'query-optimizer' });

// Database indexing strategies
const INDEXING_STRATEGIES = {
  // Common indexes for performance
  INDEXES: [
    // User-related indexes
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
    
    // Product-related indexes
    'CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)',
    'CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity)',
    'CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at)',
    
    // Transaction-related indexes
    'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method)',
    
    // Inventory-related indexes
    'CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON inventory_items(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_inventory_items_location_id ON inventory_items(location_id)',
    'CREATE INDEX IF NOT EXISTS idx_inventory_items_quantity ON inventory_items(quantity)',
    'CREATE INDEX IF NOT EXISTS idx_inventory_items_updated_at ON inventory_items(updated_at)',
    
    // Analytics-related indexes
    'CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)',
    'CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id)',
    
    // Composite indexes for common query patterns
    'CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_date_status ON transactions(created_at, status)',
    'CREATE INDEX IF NOT EXISTS idx_products_category_price ON products(category_id, price)',
    'CREATE INDEX IF NOT EXISTS idx_inventory_product_location ON inventory_items(product_id, location_id)',
  ],
  
  // Partial indexes for specific conditions
  PARTIAL_INDEXES: [
    'CREATE INDEX IF NOT EXISTS idx_active_users ON users(id) WHERE status = \'active\'',
    'CREATE INDEX IF NOT EXISTS idx_pending_transactions ON transactions(id) WHERE status = \'pending\'',
    'CREATE INDEX IF NOT EXISTS idx_low_stock_products ON products(id) WHERE stock_quantity < 10',
  ],
  
  // Full-text search indexes
  FULLTEXT_INDEXES: [
    'CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector(\'english\', name || \' \' || description))',
    'CREATE INDEX IF NOT EXISTS idx_users_search ON users USING gin(to_tsvector(\'english\', first_name || \' \' || last_name || \' \' || email))',
  ],
};

/**
 * Initialize database indexes for optimal performance
 */
export async function initializeIndexes(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  logger.info('Initializing database indexes for performance optimization');
  
  // Create regular indexes
  for (const indexQuery of INDEXING_STRATEGIES.INDEXES) {
    try {
      await executeQuery(indexQuery);
      results.success++;
      logger.debug('Index created successfully', { query: indexQuery.substring(0, 50) + '...' });
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.errors.push(`Index creation failed: ${errorMessage}`);
      logger.error('Index creation failed', error instanceof Error ? error : new Error(String(error)), {
        query: indexQuery.substring(0, 50) + '...',
      });
    }
  }
  
  // Create partial indexes
  for (const indexQuery of INDEXING_STRATEGIES.PARTIAL_INDEXES) {
    try {
      await executeQuery(indexQuery);
      results.success++;
      logger.debug('Partial index created successfully', { query: indexQuery.substring(0, 50) + '...' });
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.errors.push(`Partial index creation failed: ${errorMessage}`);
      logger.error('Partial index creation failed', error instanceof Error ? error : new Error(String(error)), {
        query: indexQuery.substring(0, 50) + '...',
      });
    }
  }
  
  // Create full-text search indexes
  for (const indexQuery of INDEXING_STRATEGIES.FULLTEXT_INDEXES) {
    try {
      await executeQuery(indexQuery);
      results.success++;
      logger.debug('Full-text index created successfully', { query: indexQuery.substring(0, 50) + '...' });
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.errors.push(`Full-text index creation failed: ${errorMessage}`);
      logger.error('Full-text index creation failed', error instanceof Error ? error : new Error(String(error)), {
        query: indexQuery.substring(0, 50) + '...',
      });
    }
  }
  
  logger.info('Database index initialization completed', results);
  return results;
}

/**
 * Query performance analyzer
 */
export class QueryAnalyzer {
  /**
   * Analyze query performance using EXPLAIN
   */
  static async analyzeQuery(query: string, params?: any[]): Promise<{
    plan: any;
    executionTime: number;
    recommendations: string[];
  }> {
    const startTime = Date.now();
    
    try {
      // Get query execution plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const planResult = await executeQuery(explainQuery, params);
      
      const executionTime = Date.now() - startTime;
      const plan = planResult[0]?.QUERY PLAN || planResult[0];
      
      // Analyze plan and generate recommendations
      const recommendations = this.generateRecommendations(plan, executionTime);
      
      logger.debug('Query analysis completed', {
        executionTime,
        recommendationsCount: recommendations.length,
      });
      
      return {
        plan,
        executionTime,
        recommendations,
      };
    } catch (error) {
      logger.error('Query analysis failed', error instanceof Error ? error : new Error(String(error)), {
        query: query.substring(0, 100) + '...',
      });
      throw error;
    }
  }
  
  /**
   * Generate performance recommendations based on query plan
   */
  private static generateRecommendations(plan: any, executionTime: number): string[] {
    const recommendations: string[] = [];
    
    if (executionTime > 1000) {
      recommendations.push('Query execution time is high (>1s). Consider adding indexes or optimizing the query.');
    }
    
    if (executionTime > 5000) {
      recommendations.push('Query execution time is very high (>5s). This query needs immediate optimization.');
    }
    
    // Analyze the plan structure for specific issues
    if (plan && typeof plan === 'object') {
      const planStr = JSON.stringify(plan).toLowerCase();
      
      if (planStr.includes('seq scan')) {
        recommendations.push('Sequential scan detected. Consider adding indexes for better performance.');
      }
      
      if (planStr.includes('temporary')) {
        recommendations.push('Temporary table usage detected. Consider optimizing joins or adding indexes.');
      }
      
      if (planStr.includes('sort')) {
        recommendations.push('Sort operation detected. Consider adding indexes for ORDER BY clauses.');
      }
      
      if (planStr.includes('hash')) {
        recommendations.push('Hash operation detected. Consider adding indexes to avoid hash joins.');
      }
    }
    
    return recommendations;
  }
  
  /**
   * Get slow query statistics
   */
  static async getSlowQueries(limit: number = 10): Promise<Array<{
    query: string;
    meanTime: number;
    calls: number;
    totalTime: number;
  }>> {
    try {
      const query = `
        SELECT 
          query,
          round(mean_exec_time::numeric, 2) as mean_time,
          calls,
          round(total_exec_time::numeric, 2) as total_time
        FROM pg_stat_statements 
        WHERE mean_exec_time > 1000
        ORDER BY mean_exec_time DESC 
        LIMIT $1
      `;
      
      const result = await executeQuery(query, [limit]);
      return result;
    } catch (error) {
      logger.error('Failed to get slow queries', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
}

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
  /**
   * Optimize SELECT queries with pagination
   */
  static optimizePaginationQuery(
    baseQuery: string,
    page: number = 1,
    limit: number = 20,
    orderBy: string = 'id'
  ): {
    query: string;
    params: any[];
    countQuery: string;
  } {
    const offset = (page - 1) * limit;
    
    // Optimized query with LIMIT and OFFSET
    const optimizedQuery = `
      ${baseQuery}
      ORDER BY ${orderBy}
      LIMIT $${baseQuery.includes('$') ? baseQuery.match(/\$/g)!.length + 1 : 1} 
      OFFSET $${baseQuery.includes('$') ? baseQuery.match(/\$/g)!.length + 2 : 2}
    `;
    
    // Count query for pagination metadata
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (${baseQuery}) as subquery
    `;
    
    const params = [...(baseQuery.match(/\$/g) ? [] : []), limit, offset];
    
    return {
      query: optimizedQuery,
      params,
      countQuery,
    };
  }
  
  /**
   * Optimize bulk insert operations
   */
  static optimizeBulkInsert(
    table: string,
    columns: string[],
    values: any[][],
    batchSize: number = 1000
  ): string[] {
    const queries: string[] = [];
    
    // Split values into batches
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const placeholders = batch.map((_, rowIndex) => {
        const startParam = rowIndex * columns.length + 1;
        return `(${columns.map((_, colIndex) => `$${startParam + colIndex}`).join(', ')})`;
      }).join(', ');
      
      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT DO NOTHING
      `;
      
      queries.push(query);
    }
    
    return queries;
  }
  
  /**
   * Optimize search queries with full-text search
   */
  static optimizeSearchQuery(
    table: string,
    searchColumns: string[],
    searchTerm: string,
    additionalConditions: string = '',
    orderBy: string = 'rank'
  ): {
    query: string;
    params: any[];
  } {
    const searchVector = searchColumns.map(col => `to_tsvector('english', ${col})`).join(' || ');
    const searchQuery = `to_tsquery('english', $1)`;
    
    const query = `
      SELECT *,
        ts_rank(${searchVector}, ${searchQuery}) as rank
      FROM ${table}
      WHERE ${searchVector} @@ ${searchQuery}
      ${additionalConditions ? `AND ${additionalConditions}` : ''}
      ORDER BY ${orderBy} DESC
    `;
    
    return {
      query,
      params: [searchTerm],
    };
  }
}

/**
 * Database statistics and monitoring
 */
export class DatabaseStats {
  /**
   * Get database table statistics
   */
  static async getTableStats(): Promise<Array<{
    tableName: string;
    rowCount: number;
    size: string;
    indexSize: string;
  }>> {
    try {
      const query = `
        SELECT 
          schemaname,
          tablename as table_name,
          n_tup_ins + n_tup_upd + n_tup_del as row_count,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `;
      
      const result = await executeQuery(query);
      return result;
    } catch (error) {
      logger.error('Failed to get table stats', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
  
  /**
   * Get index usage statistics
   */
  static async getIndexStats(): Promise<Array<{
    indexName: string;
    tableName: string;
    scans: number;
    tuplesRead: number;
    tuplesFetched: number;
  }>> {
    try {
      const query = `
        SELECT 
          indexrelname as index_name,
          relname as table_name,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
      `;
      
      const result = await executeQuery(query);
      return result;
    } catch (error) {
      logger.error('Failed to get index stats', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
  
  /**
   * Get database connection statistics
   */
  static async getConnectionStats(): Promise<{
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
    connectionUtilization: number;
  }> {
    try {
      const query = `
        SELECT 
          count(*) as active_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
      
      const result = await executeQuery(query);
      const activeConnections = result[0]?.active_connections || 0;
      const maxConnections = result[0]?.max_connections || 100;
      
      return {
        activeConnections,
        idleConnections: 0, // Would need additional query
        maxConnections,
        connectionUtilization: (activeConnections / maxConnections) * 100,
      };
    } catch (error) {
      logger.error('Failed to get connection stats', error instanceof Error ? error : new Error(String(error)));
      return {
        activeConnections: 0,
        idleConnections: 0,
        maxConnections: 0,
        connectionUtilization: 0,
      };
    }
  }
}

export { INDEXING_STRATEGIES }; 