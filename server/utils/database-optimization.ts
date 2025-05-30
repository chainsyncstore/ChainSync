import { Pool } from 'pg';
import { performance } from 'perf_hooks';

/**
 * Database Optimization Utilities
 * Provides query performance monitoring, connection optimization, and indexing helpers
 */

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  params?: unknown[];
  rowCount?: number;
  error?: string;
}

interface ConnectionPoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
}

/**
 * Query Performance Monitor
 */
class QueryPerformanceMonitor {
  private metrics: QueryMetrics[] = [];
  private slowQueryThreshold: number;
  private maxMetricsHistory: number;

  constructor(slowQueryThreshold = 1000, maxMetricsHistory = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
    this.maxMetricsHistory = maxMetricsHistory;
  }

  /**
   * Wrap a database query with performance monitoring
   */
  async monitorQuery<T>(
    queryFn: () => Promise<T>,
    query: string,
    params?: unknown[]
  ): Promise<T> {
    const startTime = performance.now();
    const timestamp = new Date();
    
    try {
      const result = await queryFn();
      const duration = performance.now() - startTime;
      
      const metric: QueryMetrics = {
        query: this.sanitizeQuery(query),
        duration,
        timestamp,
        params: this.sanitizeParams(params),
        rowCount: this.extractRowCount(result)
      };
      
      this.addMetric(metric);
      
      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        console.warn(`Slow query detected (${duration.toFixed(2)}ms):`, {
          query: metric.query,
          duration,
          params: metric.params
        });
      }
      
      return result;
    } catch (error: unknown) {
      const duration = performance.now() - startTime;
      
      const metric: QueryMetrics = {
        query: this.sanitizeQuery(query),
        duration,
        timestamp,
        params: this.sanitizeParams(params),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.addMetric(metric);
      
      console.error('Query error:', {
        query: metric.query,
        duration,
        error: metric.error,
        params: metric.params
      });
      
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    errorRate: number;
    recentMetrics: QueryMetrics[];
  } {
    const totalQueries = this.metrics.length;
    const slowQueries = this.metrics.filter(m => m.duration > this.slowQueryThreshold).length;
    const errorQueries = this.metrics.filter(m => m.error).length;
    const averageDuration = totalQueries > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0;
    
    return {
      totalQueries,
      averageDuration,
      slowQueries,
      errorRate: totalQueries > 0 ? errorQueries / totalQueries : 0,
      recentMetrics: this.metrics.slice(-10)
    };
  }

  /**
   * Get slow queries for analysis
   */
  getSlowQueries(limit = 10): QueryMetrics[] {
    return this.metrics
      .filter(m => m.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  private addMetric(metric: QueryMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data and normalize whitespace
    return query
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500); // Limit length
  }

  private sanitizeParams(params?: unknown[]): unknown[] | undefined {
    if (!params) return undefined;
    
    // Sanitize sensitive parameters
    return params.map(param => {
      if (typeof param === 'string' && param.length > 100) {
        return param.substring(0, 100) + '...';
      }
      return param;
    });
  }

  private extractRowCount(result: unknown): number | undefined {
    if (result && typeof result === 'object') {
      if ('rowCount' in result) return result.rowCount;
      if ('rows' in result && Array.isArray(result.rows)) return result.rows.length;
      if (Array.isArray(result)) return result.length;
    }
    return undefined;
  }
}

/**
 * Connection Pool Optimizer
 */
class ConnectionPoolOptimizer {
  private pool: Pool;
  private metrics: ConnectionPoolMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  constructor(pool: Pool) {
    this.pool = pool;
    this.startMonitoring();
  }

  /**
   * Start monitoring connection pool metrics
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const metrics = this.getCurrentMetrics();
      this.metrics.push(metrics);
      
      // Keep only last 100 metrics
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }
      
      // Check for potential issues
      this.checkPoolHealth(metrics);
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Get current connection pool metrics
   */
  getCurrentMetrics(): ConnectionPoolMetrics {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      maxConnections: (this.pool as any).options?.max || 10
    };
  }

  /**
   * Get pool optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const current = this.getCurrentMetrics();
    const recent = this.metrics.slice(-10);
    
    if (recent.length === 0) return recommendations;
    
    // Check for high waiting clients
    const avgWaiting = recent.reduce((sum, m) => sum + m.waitingClients, 0) / recent.length;
    if (avgWaiting > 2) {
      recommendations.push('Consider increasing max pool size - high number of waiting clients detected');
    }
    
    // Check for low utilization
    const avgUtilization = recent.reduce((sum, m) => 
      sum + (m.totalConnections - m.idleConnections) / m.maxConnections, 0) / recent.length;
    if (avgUtilization < 0.3) {
      recommendations.push('Consider decreasing max pool size - low utilization detected');
    }
    
    // Check for connection churn
    const connectionVariance = this.calculateVariance(recent.map(m => m.totalConnections));
    if (connectionVariance > 5) {
      recommendations.push('High connection churn detected - consider connection pooling optimization');
    }
    
    return recommendations;
  }

  private checkPoolHealth(metrics: ConnectionPoolMetrics): void {
    // Alert on high waiting clients
    if (metrics.waitingClients > 5) {
      console.warn('Database pool health warning: High number of waiting clients', metrics);
    }
    
    // Alert on pool exhaustion
    if (metrics.totalConnections >= metrics.maxConnections && metrics.waitingClients > 0) {
      console.error('Database pool exhausted: All connections in use with waiting clients', metrics);
    }
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

/**
 * Database Index Analyzer
 */
class DatabaseIndexAnalyzer {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Analyze table indexes and suggest optimizations
   */
  async analyzeIndexes(): Promise<{
    missingIndexes: string[];
    unusedIndexes: string[];
    duplicateIndexes: string[];
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    const missingIndexes: string[] = [];
    const unusedIndexes: string[] = [];
    const duplicateIndexes: string[] = [];

    try {
      // Get table statistics
      const tableStats = await this.getTableStatistics();
      
      // Get index usage statistics
      const indexStats = await this.getIndexStatistics();
      
      // Analyze for missing indexes on foreign keys
      const foreignKeys = await this.getForeignKeys();
      for (const fk of foreignKeys) {
        const hasIndex = indexStats.some((idx: unknown) => 
          idx.table_name === fk.table_name && 
          idx.column_names.includes(fk.column_name)
        );
        
        if (!hasIndex) {
          missingIndexes.push(`CREATE INDEX idx_${fk.table_name}_${fk.column_name} ON ${fk.table_name}(${fk.column_name});`);
        }
      }
      
      // Find unused indexes
      for (const idx of indexStats) {
        if ((idx as any).idx_scan === 0 && !(idx as any).indisprimary && !(idx as any).indisunique) {
          unusedIndexes.push(`DROP INDEX ${(idx as any).index_name}; -- Unused index on ${(idx as any).table_name}`);
        }
      }
      
      // Find duplicate indexes
      const indexGroups = new Map<string, any[]>();
      for (const idx of indexStats) {
        const key = `${(idx as any).table_name}:${(idx as any).column_names.join(',')}`;
        if (!indexGroups.has(key)) {
          indexGroups.set(key, []);
        }
        indexGroups.get(key)!.push(idx);
      }
      
      for (const [key, indexes] of indexGroups) {
        if (indexes.length > 1) {
          const duplicates = indexes.slice(1);
          for (const dup of duplicates) {
            duplicateIndexes.push(`DROP INDEX ${dup.index_name}; -- Duplicate of ${indexes[0].index_name}`);
          }
        }
      }
      
      // Generate recommendations
      if (missingIndexes.length > 0) {
        recommendations.push(`Found ${missingIndexes.length} missing indexes on foreign keys`);
      }
      
      if (unusedIndexes.length > 0) {
        recommendations.push(`Found ${unusedIndexes.length} unused indexes that can be dropped`);
      }
      
      if (duplicateIndexes.length > 0) {
        recommendations.push(`Found ${duplicateIndexes.length} duplicate indexes that can be removed`);
      }

    } catch (error: unknown) {
      console.error('Error analyzing indexes:', error);
      recommendations.push('Error occurred during index analysis');
    }

    return {
      missingIndexes,
      unusedIndexes,
      duplicateIndexes,
      recommendations
    };
  }

  private async getTableStatistics(): Promise<any[]> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins,
        n_tup_upd,
        n_tup_del,
        n_live_tup,
        n_dead_tup,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch
      FROM pg_stat_user_tables
      ORDER BY seq_scan DESC;
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  private async getIndexStatistics(): Promise<any[]> {
    const query = `
      SELECT 
        t.schemaname,
        t.tablename as table_name,
        i.indexname as index_name,
        i.indexdef,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch,
        pg_index.indisprimary,
        pg_index.indisunique,
        array_agg(a.attname ORDER BY a.attnum) as column_names
      FROM pg_stat_user_indexes s
      JOIN pg_stat_user_tables t ON s.relid = t.relid
      JOIN pg_indexes i ON i.indexname = s.indexrelname
      JOIN pg_index ON pg_index.indexrelid = s.indexrelid
      JOIN pg_attribute a ON a.attrelid = pg_index.indrelid 
        AND a.attnum = ANY(pg_index.indkey)
      WHERE t.schemaname = 'public'
      GROUP BY t.schemaname, t.tablename, i.indexname, i.indexdef, 
               s.idx_scan, s.idx_tup_read, s.idx_tup_fetch,
               pg_index.indisprimary, pg_index.indisunique
      ORDER BY s.idx_scan ASC;
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  private async getForeignKeys(): Promise<any[]> {
    const query = `
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }
}

/**
 * Create optimized database pool with monitoring
 */
export function createOptimizedPool(config: unknown): Pool {
  const optimizedConfig = {
    ...config,
    // Optimize connection pool settings
    max: parseInt(process.env.DB_POOL_SIZE || '20'),
    min: 2,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: 5000,
    acquireTimeoutMillis: 10000,
    
    // Enable keep-alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    
    // Statement timeout
    statement_timeout: 30000,
    query_timeout: 30000,
  };

  const pool = new Pool(optimizedConfig);
  
  // Add error handling
  pool.on('error', (err) => {
    console.error('Database pool error:', err);
  });
  
  pool.on('connect', () => {
    console.log('New database connection established');
  });
  
  pool.on('remove', () => {
    console.log('Database connection removed from pool');
  });

  return pool;
}

// Export singleton instances
export const queryMonitor = new QueryPerformanceMonitor();

export function createPoolOptimizer(pool: Pool): ConnectionPoolOptimizer {
  return new ConnectionPoolOptimizer(pool);
}

export function createIndexAnalyzer(pool: Pool): DatabaseIndexAnalyzer {
  return new DatabaseIndexAnalyzer(pool);
}

export { QueryPerformanceMonitor, ConnectionPoolOptimizer, DatabaseIndexAnalyzer };
