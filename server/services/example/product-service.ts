/**
 * Example Product Service
 *
 * This service demonstrates the standardized database access patterns
 * using the SQL helper utilities and validation layer.
 */

import { eq, like, sql, and, or, desc, asc, SQL } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../../db';
import { products, stores } from '../../../shared/schema';
import { getLogger } from '../../../src/logging';
import {
  findById,
  findMany,
  insertOne,
  updateById,
  deleteById,
  withTransaction,
  safeIdentifier,
  safeToString, // Use this safeToString from sqlHelpers
  executeRawQuery,
  paginationClause,
  orderByClause,
  joinTables,
  withDbTryCatch,
} from '../../db/sqlHelpers';
import { sqlTemplate, sqlIdentifier } from '../../db/sqlTemplateHelper';
import { validateProduct, validateArray, productSchema, type Product } from '../../db/validation';
// Import schema tables directly

// Logger for this service
const logger = getLogger().child({ component: 'product-service' });

// Input validation schemas
const createProductSchema = z.object({
  storeId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  sku: z.string().min(1).max(100),
  price: z.number().positive(),
  stockQuantity: z.number().int().min(0),
  isActive: z.boolean().default(true),
});

const updateProductSchema = createProductSchema.partial().omit({ storeId: true });

const productQuerySchema = z.object({
  storeId: z.number().int().positive().optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'price', 'stockQuantity', 'createdAt']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
});

// Response types
export interface ProductWithStore extends Product {
  store: {
    id: number;
    name: string;
  };
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Example Product Service implementing standardized database access patterns
 */
export class ProductService {
  private logger = logger;
  private db = db;

  private handleError(error: unknown, context: string): void {
    this.logger.error({ error, context }, `Error in product service: ${context}`);
  }

  /**
   * Get a product by ID
   */
  async getProductById(id: number): Promise<Product | null> {
    try {
      // Use the findById helper for clean, type-safe lookup
      const product = await findById<unknown>(db, products, 'id', id);

      // Return null if product not found
      if (!product) return null;

      // Validate the product against the schema before returning
      return validateProduct(product);
    } catch (error) {
      this.handleError(error, 'fetching product by ID');
      throw error;
    }
  }

  /**
   * Get a product with its store information
   */
  async getProductWithStore(id: number): Promise<ProductWithStore | null> {
    try {
      // Use joinTables helper for clean, type-safe joins
      const results = await joinTables(db, products, stores, 'storeId', 'id', eq(products.id, id));

      if (results.length === 0) return null;

      // Transform the joined result to the expected format
      const result = results[0] as {
        products: Record<string, any>;
        stores: { id: number; name: string };
      };

      // Add type safety checks
      if (!result || !result.products || !result.stores) {
        throw new Error(`Product with ID ${id} not found or missing related store`);
      }

      return {
        ...validateProduct(result.products),
        store: {
          id: result.stores.id,
          name: result.stores.name,
        },
      };
    } catch (error) {
      this.handleError(error, 'fetching product with store');
      throw error;
    }
  }

  /**
   * List products with filters, pagination and sorting
   */
  async listProducts(query: z.infer<typeof productQuerySchema>): Promise<ProductListResponse> {
    try {
      // Validate query parameters
      const validatedQuery = productQuerySchema.parse(query);

      // Build where clause based on filters
      const whereConditions: SQL<unknown>[] = [];

      if (validatedQuery.storeId) {
        whereConditions.push(sql`store_id = ${safeToString(validatedQuery.storeId)}`);
      }

      if (validatedQuery.isActive !== undefined) {
        whereConditions.push(sql`is_active = ${validatedQuery.isActive}`);
      }

      if (validatedQuery.minPrice !== undefined) {
        whereConditions.push(sql`price >= ${safeToString(validatedQuery.minPrice)}`);
      }

      if (validatedQuery.maxPrice !== undefined) {
        whereConditions.push(sql`price <= ${safeToString(validatedQuery.maxPrice)}`);
      }

      if (validatedQuery.search) {
        // Use SQL template for safety
        whereConditions.push(sql`name LIKE ${`%${safeToString(validatedQuery.search)}%`}`);
      }

      // Combine all conditions with AND
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Execute count query to get total items
      const countResult = await withDbTryCatch(
        db,
        async client => {
          const result = await client
            .select({ count: sql`COUNT(*)` })
            .from(products)
            .where(whereClause || sql`1=1`);

          return Number(result[0].count);
        },
        'product.count'
      );

      // Execute main query with pagination and sorting
      const results = await findMany<unknown>(
        db,
        products,
        whereClause || sql`1=1`,
        {
          page: validatedQuery.page,
          limit: validatedQuery.limit,
        },
        validatedQuery.sortBy,
        validatedQuery.sortDirection as any
      );

      // Calculate pagination metadata
      const total = countResult;
      const totalPages = Math.ceil(total / validatedQuery.limit);

      // Validate the products array
      const validatedProducts = validateArray(results, productSchema);

      return {
        products: validatedProducts,
        total,
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        totalPages,
      };
    } catch (error) {
      this.handleError(error, 'listing products');
      throw error;
    }
  }

  /**
   * Create a new product
   */
  async createProduct(data: z.infer<typeof createProductSchema>): Promise<Product> {
    try {
      // Validate input data
      const validatedData = createProductSchema.parse(data);

      // Convert numeric price to string for database (as per our decimal handling)
      const dbData = {
        ...validatedData,
        price: safeToString(validatedData.price),
        createdAt: new Date(),
      };

      // Use insertOne helper for clean, type-safe insertion
      const result = await insertOne<unknown, typeof dbData>(db, products, dbData);

      // Validate the product before returning
      return validateProduct(result);
    } catch (error) {
      this.handleError(error, 'creating product');
      throw error;
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(
    id: number,
    data: z.infer<typeof updateProductSchema>
  ): Promise<Product | null> {
    try {
      // Validate input data
      const validatedData = updateProductSchema.parse(data);

      // Convert numeric price to string for database if provided
      const dbData: Record<string, any> = {
        ...validatedData,
        updatedAt: new Date(),
      };

      if (validatedData.price !== undefined) {
        dbData.price = safeToString(validatedData.price);
      }

      // Use updateById helper for clean, type-safe update
      const result = await updateById<unknown, typeof dbData>(db, products, 'id', id, dbData);

      // Return null if product not found
      if (!result) return null;

      // Validate the product before returning
      return validateProduct(result);
    } catch (error) {
      this.handleError(error, 'updating product');
      throw error;
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: number): Promise<Product | null> {
    try {
      // Use deleteById helper for clean, type-safe deletion
      const result = await deleteById<unknown>(db, products, 'id', id);

      // Return null if product not found
      if (!result) return null;

      // Validate the product before returning
      return validateProduct(result);
    } catch (error) {
      this.handleError(error, 'deleting product');
      throw error;
    }
  }

  /**
   * Update stock quantities for multiple products in a transaction
   */
  async updateStockQuantities(
    updates: Array<{ id: number; quantity: number }>
  ): Promise<Product[]> {
    try {
      // Use withTransaction helper for atomic operations
      return await withTransaction(
        db,
        async tx => {
          const updatedProducts: Product[] = [];

          for (const update of updates) {
            // Get current product to validate it exists
            const product = await findById<unknown>(tx, products, 'id', update.id);

            if (!product) {
              throw new Error(`Product with ID ${update.id} not found`);
            }

            // Update the stock quantity
            const updatedProduct = await updateById<
              Product,
              { stockQuantity: number; updatedAt: Date }
            >(tx, products, 'id', update.id, {
              stockQuantity: update.quantity,
              updatedAt: new Date(),
            });

            if (updatedProduct) {
              // The updateById operation returns the updated record
              updatedProducts.push(updatedProduct);
            }
          }

          return updatedProducts;
        },
        'product.updateStockQuantities'
      );
    } catch (error) {
      this.handleError(error, 'updating stock quantities');
      throw error;
    }
  }

  /**
   * Search products by name using a raw SQL query
   */
  async searchProductsByName(query: string): Promise<Product[]> {
    try {
      // Demonstrate safe raw SQL usage with proper parameter binding
      const results = await executeRawQuery<unknown>(
        db,
        sql`
          SELECT * FROM products 
          WHERE name ILIKE ${`%${query}%`}
          ORDER BY name ASC
          LIMIT 20
        `,
        'product.searchByName'
      );

      // Validate the products array
      return validateArray(results, productSchema);
    } catch (error) {
      this.handleError(error, 'searching products by name');
      throw error;
    }
  }

  /**
   * Get product count by category
   * Example of using dynamic column names safely
   */
  async getProductCountByCategory(categoryColumn: string): Promise<Record<string, number>> {
    try {
      // Use safeIdentifier to safely reference dynamic column name
      const safeCategoryColumn = safeIdentifier(categoryColumn);

      const results = await executeRawQuery<{ category: string; count: number }>(
        db,
        sql`
          SELECT ${safeCategoryColumn} as category, COUNT(*) as count
          FROM products
          GROUP BY ${safeCategoryColumn}
          ORDER BY count DESC
        `,
        'product.countByCategory'
      );

      // Transform to expected format
      return results.reduce(
        (acc, { category, count }) => {
          acc[category] = Number(count);
          return acc;
        },
        {} as Record<string, number>
      );
    } catch (error) {
      this.handleError(error, 'getting product count by category');
      throw error;
    }
  }

  /**
   * Safe conversion of any value to string for SQL operations
   * Uses the standardized helper from sqlTemplateHelper.ts
   */
  // This method is no longer needed as we directly import safeToString
  // from sqlTemplateHelper.ts
}

// Export singleton instance
export const productService = new ProductService();
