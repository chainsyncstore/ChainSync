/**
 * Product Service Implementation
 *
 * This file implements a standardized product service with proper schema validation
 * and error handling according to our schema style guide.
 */

import { db } from '@db';
import { productValidation, SchemaValidationError } from '@shared/schema-validation';
import * as schema from '@shared/schema.js';
import { eq, and, or, like, gte, lte, desc, sql } from 'drizzle-orm';

import {
  IProductService,
  ProductServiceErrors,
  CreateProductParams,
  UpdateProductParams,
  ProductSearchParams,
} from './types';
import { BaseService } from '../base/service';

export class ProductService extends BaseService implements IProductService {
  /**
   * Create a new product with validated data
   */
  async createProduct(params: CreateProductParams): Promise<schema.Product> {
    try {
      // Check if store exists
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, params.storeId),
      });

      if (!store) {
        throw ProductServiceErrors.INVALID_STORE;
      }

      // Check for duplicate SKU
      const existingSku = await db.query.products.findFirst({
        where: and(
          eq(schema.products.sku, params.sku),
          eq(schema.products.storeId, params.storeId)
        ),
      });

      if (existingSku) {
        throw ProductServiceErrors.DUPLICATE_SKU;
      }

      // Check for duplicate barcode if provided
      if (params.barcode) {
        const existingBarcode = await db.query.products.findFirst({
          where: and(
            eq(schema.products.barcode, params.barcode),
            eq(schema.products.storeId, params.storeId)
          ),
        });

        if (existingBarcode) {
          throw ProductServiceErrors.DUPLICATE_BARCODE;
        }
      }

      // Check if category exists if provided
      if (params.categoryId) {
        const category = await db.query.productCategories.findFirst({
          where: eq(schema.productCategories.id, params.categoryId),
        });

        if (!category) {
          throw ProductServiceErrors.INVALID_CATEGORY;
        }
      }

      // Check if brand exists if provided
      if (params.brandId) {
        const brand = await db.query.brands.findFirst({
          where: eq(schema.brands.id, params.brandId),
        });

        if (!brand) {
          throw ProductServiceErrors.INVALID_BRAND;
        }
      }

      // Prepare product data with camelCase field names (will be converted to snake_case in DB)
      const productData = {
        name: params.name,
        description: params.description || '',
        sku: params.sku,
        price: params.price,
        cost: params.cost || '0.00',
        categoryId: params.categoryId,
        brandId: params.brandId,
        isActive: params.isActive ?? true,
        storeId: params.storeId,
        imageUrl: params.imageUrl,
        barcode: params.barcode,
        attributes: params.attributes || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate with our schema validation
      const validatedData = productValidation.insert(productData);

      // Insert validated data
      const [product] = await db.insert(schema.products).values(validatedData).returning();

      // Create initial inventory record with zero quantity
      await db.insert(schema.inventory).values({
        productId: product.id,
        storeId: params.storeId,
        totalQuantity: 0,
        availableQuantity: 0,
        minimumLevel: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return product;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating product');
    }
  }

  /**
   * Update a product with validated data
   */
  async updateProduct(productId: number, params: UpdateProductParams): Promise<schema.Product> {
    try {
      // Verify product exists
      const existingProduct = await db.query.products.findFirst({
        where: eq(schema.products.id, productId),
      });

      if (!existingProduct) {
        throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      }

      // Check for duplicate SKU if being updated
      if (params.sku && params.sku !== existingProduct.sku) {
        const existingSku = await db.query.products.findFirst({
          where: and(
            eq(schema.products.sku, params.sku),
            eq(schema.products.storeId, existingProduct.storeId)
          ),
        });

        if (existingSku) {
          throw ProductServiceErrors.DUPLICATE_SKU;
        }
      }

      // Check for duplicate barcode if being updated
      if (params.barcode && params.barcode !== existingProduct.barcode) {
        const existingBarcode = await db.query.products.findFirst({
          where: and(
            eq(schema.products.barcode, params.barcode),
            eq(schema.products.storeId, existingProduct.storeId)
          ),
        });

        if (existingBarcode) {
          throw ProductServiceErrors.DUPLICATE_BARCODE;
        }
      }

      // Check if category exists if being updated
      if (params.categoryId && params.categoryId !== existingProduct.categoryId) {
        const category = await db.query.productCategories.findFirst({
          where: eq(schema.productCategories.id, params.categoryId),
        });

        if (!category) {
          throw ProductServiceErrors.INVALID_CATEGORY;
        }
      }

      // Check if brand exists if being updated
      if (params.brandId && params.brandId !== existingProduct.brandId) {
        const brand = await db.query.brands.findFirst({
          where: eq(schema.brands.id, params.brandId),
        });

        if (!brand) {
          throw ProductServiceErrors.INVALID_BRAND;
        }
      }

      // Prepare update data with proper camelCase field names
      const updateData = {
        ...params,
        updatedAt: new Date(),
      };

      // Validate the update data
      const validatedData = productValidation.update(updateData);

      // Update with validated data
      const [updatedProduct] = await db
        .update(schema.products)
        .set(validatedData)
        .where(eq(schema.products.id, productId))
        .returning();

      return updatedProduct;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating product');
    }
  }

  /**
   * Delete a product by ID
   */
  async deleteProduct(productId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.products)
        .where(eq(schema.products.id, productId))
        .returning({ id: schema.products.id });

      if (result.length === 0) {
        throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      }

      return true;
    } catch (error: unknown) {
      return this.handleError(error, 'Deleting product');
    }
  }

  /**
   * Get a product by ID with relations
   */
  async getProductById(productId: number): Promise<schema.Product | null> {
    try {
      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, productId),
        with: {
          category: true,
          brand: true,
          inventory: true,
        },
      });

      return product;
    } catch (error: unknown) {
      return this.handleError(error, 'Getting product by ID');
    }
  }

  /**
   * Get a product by SKU within a store
   */
  async getProductBySku(sku: string, storeId: number): Promise<schema.Product | null> {
    try {
      const product = await db.query.products.findFirst({
        where: and(eq(schema.products.sku, sku), eq(schema.products.storeId, storeId)),
        with: {
          category: true,
          brand: true,
          inventory: true,
        },
      });

      return product;
    } catch (error: unknown) {
      return this.handleError(error, 'Getting product by SKU');
    }
  }

  /**
   * Get a product by barcode within a store
   */
  async getProductByBarcode(barcode: string, storeId: number): Promise<schema.Product | null> {
    try {
      const product = await db.query.products.findFirst({
        where: and(eq(schema.products.barcode, barcode), eq(schema.products.storeId, storeId)),
        with: {
          category: true,
          brand: true,
          inventory: true,
        },
      });

      return product;
    } catch (error: unknown) {
      return this.handleError(error, 'Getting product by barcode');
    }
  }

  /**
   * Search products with advanced filters
   */
  async searchProducts(params: ProductSearchParams): Promise<{
    products: schema.Product[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      // Build where clause
      let whereClause = eq(schema.products.storeId, params.storeId);

      if (params.query) {
        const searchQuery = `%${params.query}%`;
        whereClause = and(
          whereClause,
          or(
            like(schema.products.name, searchQuery),
            like(schema.products.sku, searchQuery),
            like(schema.products.barcode, searchQuery)
          )
        );
      }

      if (params.categoryId) {
        whereClause = and(whereClause, eq(schema.products.categoryId, params.categoryId));
      }

      if (params.brandId) {
        whereClause = and(whereClause, eq(schema.products.brandId, params.brandId));
      }

      if (params.isActive !== undefined) {
        whereClause = and(whereClause, eq(schema.products.isActive, params.isActive));
      }

      if (params.minPrice) {
        whereClause = and(whereClause, gte(schema.products.price, params.minPrice));
      }

      if (params.maxPrice) {
        whereClause = and(whereClause, lte(schema.products.price, params.maxPrice));
      }

      // Count total results
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(whereClause);

      const total = Number(countResult?.count || 0);

      // Handle in-stock filter
      const query = db.query.products.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: [desc(schema.products.updatedAt)],
        with: {
          category: true,
          brand: true,
          inventory: true,
        },
      });

      let products = await query;

      // Filter by stock status if needed
      if (params.inStock !== undefined) {
        products = products.filter(product => {
          const inventory = product.inventory?.[0];
          return params.inStock
            ? inventory && inventory.availableQuantity > 0
            : inventory && inventory.availableQuantity <= 0;
        });
      }

      return {
        products,
        total,
        page,
        limit,
      };
    } catch (error: unknown) {
      return this.handleError(error, 'Searching products');
    }
  }

  /**
   * Get products with low stock
   */
  async getProductsWithLowStock(storeId: number, limit: number = 20): Promise<schema.Product[]> {
    try {
      const products = await db.query.products.findMany({
        where: eq(schema.products.storeId, storeId),
        with: {
          inventory: true,
          category: true,
        },
        limit,
      });

      // Filter products where available quantity is less than minimum level
      return products.filter(product => {
        const inventory = product.inventory?.[0];
        return (
          inventory && inventory.availableQuantity < inventory.minimumLevel && product.isActive
        );
      });
    } catch (error: unknown) {
      return this.handleError(error, 'Getting low stock products');
    }
  }

  /**
   * Update product inventory
   */
  async updateProductInventory(
    productId: number,
    quantity: number,
    reason: string
  ): Promise<boolean> {
    try {
      // Validate quantity data
      const validatedData = productValidation.inventory.adjustment({
        productId,
        quantity,
        reason,
      });

      // Check if product exists
      const product = await this.getProductById(productId);

      if (!product) {
        throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      }

      // Get current inventory
      const inventory = await db.query.inventory.findFirst({
        where: eq(schema.inventory.productId, productId),
      });

      if (!inventory) {
        // Create inventory record if it doesn't exist
        await db.insert(schema.inventory).values({
          productId,
          storeId: product.storeId,
          totalQuantity: quantity > 0 ? quantity : 0,
          availableQuantity: quantity > 0 ? quantity : 0,
          minimumLevel: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        // Update existing inventory
        const newTotal = inventory.totalQuantity + quantity;
        const newAvailable = inventory.availableQuantity + quantity;

        await db
          .update(schema.inventory)
          .set({
            totalQuantity: newTotal,
            availableQuantity: newAvailable,
            updatedAt: new Date(),
          })
          .where(eq(schema.inventory.productId, productId));
      }

      // Create inventory log entry
      await db.insert(schema.inventoryLogs).values({
        productId,
        quantity,
        previousQuantity: inventory?.availableQuantity || 0,
        newQuantity: (inventory?.availableQuantity || 0) + quantity,
        reason,
        createdAt: new Date(),
      });

      return true;
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating product inventory');
    }
  }
}
