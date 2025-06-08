import * as schema from '@shared/schema.js';
import { eq, like, and, or, desc, asc, sql, inArray } from 'drizzle-orm';

import { db, executeQuery } from '../../../db';
import {
  getCachedOrFetch,
  generateEntityCacheKey,
  generateListCacheKey,
  invalidateEntityCache,
  invalidateListCache,
  CACHE_PREFIX,
  CACHE_TTL,
} from '../../../src/cache/cache-strategy';
import { getLogger } from '../../../src/logging';

const logger = getLogger().child({ component: 'product-service' });
const { products, productCategories, inventory } = schema;

export interface ProductFilter {
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  storeId?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Optimized Product Service with caching and performance optimizations
 */
export class OptimizedProductService {
  /**
   * Get a product by ID with caching
   */
  async getProductById(productId: number): Promise<any> {
    const cacheKey = generateEntityCacheKey('PRODUCT' as keyof typeof CACHE_PREFIX, productId);

    return getCachedOrFetch(
      cacheKey,
      async () => {
        // Use executeQuery for performance tracking
        return executeQuery(async db => {
          const result = await db
            .select()
            .from(products)
            .where(eq(products.id, productId))
            .limit(1);

          return result[0] || null;
        }, `getProductById:${productId}`);
      },
      CACHE_TTL.MEDIUM
    );
  }

  /**
   * Get multiple products by IDs with batched query and caching
   */
  async getProductsByIds(productIds: number[]): Promise<any[]> {
    if (!productIds.length) return [];

    // Create a unique cache key for this batch of IDs
    const sortedIds = [...productIds].sort((a, b) => a - b);
    const cacheKey = generateListCacheKey('PRODUCT' as keyof typeof CACHE_PREFIX, {
      ids: sortedIds.join(','),
    });

    return getCachedOrFetch(
      cacheKey,
      async () => {
        return executeQuery(async db => {
          return db.select().from(products).where(inArray(products.id, productIds));
        }, `getProductsByIds:${productIds.length}`);
      },
      CACHE_TTL.MEDIUM
    );
  }

  /**
   * Get products with optimized filtering, pagination, and caching
   */
  async getProducts(filter: ProductFilter = {}): Promise<{ products: unknown[]; total: number }> {
    const {
      categoryId,
      search,
      minPrice,
      maxPrice,
      inStock,
      storeId,
      limit = 20,
      offset = 0,
      sortBy = 'name',
      sortDirection = 'asc',
    } = filter;

    // Create a cache key based on the filter parameters
    const cacheKey = generateListCacheKey('PRODUCT' as keyof typeof CACHE_PREFIX, {
      categoryId,
      search: search || undefined,
      minPrice,
      maxPrice,
      inStock: inStock !== undefined ? String(inStock) : undefined,
      storeId,
      limit,
      offset,
      sortBy,
      sortDirection,
    });

    return getCachedOrFetch(
      cacheKey,
      async () => {
        return executeQuery(
          async db => {
            // Build where conditions based on filters
            const conditions = [];

            if (categoryId !== undefined) {
              conditions.push(eq(products.categoryId, categoryId));
            }

            if (minPrice !== undefined) {
              conditions.push(sql`${products.price} >= ${minPrice}`);
            }

            if (maxPrice !== undefined) {
              conditions.push(sql`${products.price} <= ${maxPrice}`);
            }

            if (search) {
              // Optimize text search using indexes
              conditions.push(
                or(
                  like(products.name, `%${search}%`),
                  like(products.description, `%${search}%`),
                  eq(products.barcode, search)
                )
              );
            }

            // Create a base query for reuse
            const baseQuery = db
              .select()
              .from(products)
              .where(and(...conditions));

            // If storeId and inStock filters are present, we need to join with inventory
            if (storeId !== undefined && inStock !== undefined) {
              // Use a LEFT JOIN to include products without inventory if needed
              baseQuery.leftJoin(
                inventory,
                and(eq(inventory.productId, products.id), eq(inventory.storeId, storeId))
              );

              if (inStock === true) {
                baseQuery.where(sql`${inventory.totalQuantity} > 0`);
              } else if (inStock === false) {
                baseQuery.where(
                  or(sql`${inventory.totalQuantity} = 0`, sql`${inventory.totalQuantity} IS NULL`)
                );
              }
            }

            // Get total count with the same filters but without pagination
            const countQuery = db
              .select({ count: sql`COUNT(*)` })
              .from(baseQuery.as('filtered_products'));

            const countResult = await countQuery;
            const total = Number(countResult[0]?.count || 0);

            // Apply sorting and pagination to get the products
            const sortColumn =
              sortBy === 'price'
                ? products.price
                : sortBy === 'createdAt'
                  ? products.createdAt
                  : products.name;

            const sortFn = sortDirection === 'desc' ? desc : asc;

            const productsQuery = baseQuery.orderBy(sortFn(sortColumn)).limit(limit).offset(offset);

            const productsResult = await productsQuery;

            return {
              products: productsResult,
              total,
            };
          },
          `getProducts:${JSON.stringify(filter)}`
        );
      },
      CACHE_TTL.SHORT
    );
  }

  /**
   * Get product categories with caching
   */
  async getCategories(): Promise<any[]> {
    const cacheKey = generateListCacheKey('PRODUCT' as keyof typeof CACHE_PREFIX, {
      type: 'categories',
    });

    return getCachedOrFetch(
      cacheKey,
      async () => {
        return executeQuery(async db => {
          return db.select().from(productCategories);
        }, 'getCategories');
      },
      CACHE_TTL.LONG
    );
  }

  /**
   * Create a new product with cache invalidation
   */
  async createProduct(productData: unknown): Promise<any> {
    return executeQuery(async db => {
      const result = await db.insert(products).values(productData).returning();

      // Invalidate product list cache
      await invalidateListCache('PRODUCT' as keyof typeof CACHE_PREFIX);

      return result[0];
    }, 'createProduct');
  }

  /**
   * Update a product with cache invalidation
   */
  async updateProduct(productId: number, productData: unknown): Promise<any> {
    return executeQuery(async db => {
      const result = await db
        .update(products)
        .set(productData)
        .where(eq(products.id, productId))
        .returning();

      // Invalidate both entity and list caches
      await invalidateEntityCache(CACHE_PREFIX.PRODUCT, productId);
      await invalidateListCache(CACHE_PREFIX.PRODUCT);

      return result[0];
    }, `updateProduct:${productId}`);
  }

  /**
   * Delete a product with cache invalidation
   */
  async deleteProduct(productId: number): Promise<boolean> {
    return executeQuery(async db => {
      const result = await db
        .delete(products)
        .where(eq(products.id, productId))
        .returning({ id: products.id });

      // Invalidate both entity and list caches
      await invalidateEntityCache(CACHE_PREFIX.PRODUCT, productId);
      await invalidateListCache(CACHE_PREFIX.PRODUCT);

      return result.length > 0;
    }, `deleteProduct:${productId}`);
  }

  /**
   * Get low stock products for a store with optimized query
   * This query is specifically optimized for inventory management
   */
  async getLowStockProducts(storeId: number): Promise<any[]> {
    const cacheKey = generateListCacheKey('INVENTORY' as keyof typeof CACHE_PREFIX, {
      storeId,
      type: 'lowStock',
    });

    return getCachedOrFetch(
      cacheKey,
      async () => {
        return executeQuery(async db => {
          return db
            .select({
              productId: products.id,
              productName: products.name,
              currentStock: inventory.totalQuantity,
              minimumLevel: inventory.minimumLevel,
              reorderLevel: inventory.reorderLevel,
              barcode: products.barcode,
            })
            .from(inventory)
            .innerJoin(products, eq(inventory.productId, products.id))
            .where(
              and(
                eq(inventory.storeId, storeId),
                sql`${inventory.totalQuantity} <= ${inventory.reorderLevel}`
              )
            )
            .orderBy(asc(sql`${inventory.totalQuantity} / NULLIF(${inventory.minimumLevel}, 0)`));
        }, `getLowStockProducts:${storeId}`);
      },
      CACHE_TTL.SHORT
    );
  }
}
