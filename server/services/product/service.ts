/**
 * Product Service Implementation
 *
 * This file implements a standardized product service with proper schema validation
 * and error handling according to our schema style guide.
 */

import { BaseService } from '../base/service';
import {
  IProductService,
  ProductServiceErrors,
  CreateProductParams,
  UpdateProductParams,
  ProductSearchParams
} from './types';
import { db } from '../../../db/index.js';
import * as schema from '../../../shared/schema.js';
import { eq, and, or, like, gte, lte, desc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { productValidation, SchemaValidationError } from '../../../shared/schema-validation.js';

export class ProductService extends BaseService implements IProductService {
  /**
   * Create a new product with validated data
   */
  async createProduct(_params: CreateProductParams): Promise<schema.SelectProduct> {
    try {
      // Check if store exists
      const store = await db.query.stores.findFirst({
        _where: eq(schema.stores.id, params.storeId)
      });

      if (!store) {
        throw ProductServiceErrors.INVALID_STORE;
      }

      // Check for duplicate SKU
      const existingSku = await db.query.products.findFirst({
        _where: and(
          eq(schema.products.sku, params.sku),
          eq(schema.products.storeId, params.storeId)
        )
      });

      if (existingSku) {
        throw ProductServiceErrors.DUPLICATE_SKU;
      }

      // Check for duplicate barcode if provided
      if (params.barcode) {
        const existingBarcode = await db.query.products.findFirst({
          _where: and(
            eq(schema.products.barcode, params.barcode),
            eq(schema.products.storeId, params.storeId)
          )
        });

        if (existingBarcode) {
          throw ProductServiceErrors.DUPLICATE_BARCODE;
        }
      }

      // Check if category exists if provided
      if (params.categoryId) {
        const category = await db.query.categories.findFirst({
          _where: eq(schema.categories.id, params.categoryId)
        });

        if (!category) {
          throw ProductServiceErrors.INVALID_CATEGORY;
        }
      }

      // Prepare product data with camelCase field names (will be converted to snake_case in DB)
      const productData = {
        _name: params.name,
        _description: params.description || '',
        _sku: params.sku,
        _price: params.price,
        _cost: params.cost || '0.00',
        _categoryId: params.categoryId,
        _brandId: params.brandId,
        _isActive: params.isActive ?? true,
        _storeId: params.storeId,
        _imageUrl: params.imageUrl,
        _barcode: params.barcode,
        _attributes: params.attributes || {}
      };

      // Insert validated data
      const [product] = await db.insert(schema.products).values(productData).returning();

      if (!product) {
        throw new Error('Failed to create product - no record returned');
      }

      // Create initial inventory record with zero quantity
      await db.insert(schema.inventory).values({
        _productId: product.id,
        _storeId: params.storeId
      });

      return product as schema.SelectProduct;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error as Error, 'Creating product');
    }
  }

  /**
   * Update a product with validated data
   */
  async updateProduct(_productId: number, _params: UpdateProductParams): Promise<schema.SelectProduct> {
    try {
      // Verify product exists
      const existingProduct = await db.query.products.findFirst({
        _where: eq(schema.products.id, productId)
      });

      if (!existingProduct) {
        throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      }

      // Check for duplicate SKU if being updated
      if (params.sku && params.sku !== existingProduct.sku) {
        const existingSku = await db.query.products.findFirst({
          _where: and(
            eq(schema.products.sku, params.sku),
            eq(schema.products.storeId, existingProduct.storeId)
          )
        });

        if (existingSku) {
          throw ProductServiceErrors.DUPLICATE_SKU;
        }
      }

      // Check for duplicate barcode if being updated
      if (params.barcode && params.barcode !== existingProduct.barcode) {
        const existingBarcode = await db.query.products.findFirst({
          _where: and(
            eq(schema.products.barcode, params.barcode),
            eq(schema.products.storeId, existingProduct.storeId)
          )
        });

        if (existingBarcode) {
          throw ProductServiceErrors.DUPLICATE_BARCODE;
        }
      }

      // Check if category exists if being updated
      if (params.categoryId && params.categoryId !== existingProduct.categoryId) {
        const category = await db.query.categories.findFirst({
          _where: eq(schema.categories.id, params.categoryId)
        });

        if (!category) {
          throw ProductServiceErrors.INVALID_CATEGORY;
        }
      }

      // Prepare update data with proper camelCase field names
      const updateData = {
        ...params,
        _updatedAt: new Date()
      };

      // Update with validated data
      const [updatedProduct] = await db
        .update(schema.products)
        .set(updateData)
        .where(eq(schema.products.id, productId))
        .returning();

      return updatedProduct as schema.SelectProduct;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error as Error, 'Updating product');
    }
  }

  /**
   * Delete a product by ID
   */
  async deleteProduct(_productId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.products)
        .where(eq(schema.products.id, productId))
        .returning({ _id: schema.products.id });

      if (result.length === 0) {
        throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      }

      return true;
    } catch (error) {
      return this.handleError(error as Error, 'Deleting product');
    }
  }

  /**
   * Get a product by ID with relations
   */
  async getProductById(_productId: number): Promise<schema.SelectProduct | null> {
    try {
      const product = await db.query.products.findFirst({
        _where: eq(schema.products.id, productId)
      });

      return product as schema.SelectProduct | null;
    } catch (error) {
      return this.handleError(error as Error, 'Getting product by ID');
    }
  }

  /**
   * Get a product by SKU within a store
   */
  async getProductBySku(_sku: string, _storeId: number): Promise<schema.SelectProduct | null> {
    try {
      const product = await db.query.products.findFirst({
        _where: and(eq(schema.products.sku, sku), eq(schema.products.storeId, storeId))
      });

      return product as schema.SelectProduct | null;
    } catch (error) {
      return this.handleError(error as Error, 'Getting product by SKU');
    }
  }

  /**
   * Get a product by barcode within a store
   */
  async getProductByBarcode(_barcode: string, _storeId: number): Promise<schema.SelectProduct | null> {
    try {
      const product = await db.query.products.findFirst({
        _where: and(eq(schema.products.barcode, barcode), eq(schema.products.storeId, storeId))
      });

      return product as schema.SelectProduct | null;
    } catch (error) {
      return this.handleError(error as Error, 'Getting product by barcode');
    }
  }

  /**
   * Search products with advanced filters
   */
  async searchProducts(_params: ProductSearchParams): Promise<{
    _products: schema.SelectProduct[];
    _total: number;
    _page: number;
    _limit: number;
  }> {
    try {
      const page = params.page ?? 1;
      const limit = params.limit ?? 20;
      const offset = (page - 1) * limit;

      // Build dynamic conditions list
      const _conditions: SQL[] = [eq(schema.products.storeId, params.storeId)];

      if (params.query) {
        const searchQuery = `%${params.query}%`;
        conditions.push(
          or(
            like(schema.products.name, searchQuery) as SQL,
            like(schema.products.sku, searchQuery) as SQL,
            like(schema.products.barcode, searchQuery) as SQL
          ) as SQL
        );
      }

      if (params.categoryId) {
        conditions.push(eq(schema.products.categoryId, params.categoryId));
      }

      if (params.brandId) {
        conditions.push(eq(schema.products.brandId, params.brandId));
      }

      if (params.isActive !== undefined) {
        conditions.push(eq(schema.products.isActive, params.isActive));
      }

      if (params.minPrice !== undefined) {
        conditions.push(gte(schema.products.price, params.minPrice));
      }

      if (params.maxPrice !== undefined) {
        conditions.push(lte(schema.products.price, params.maxPrice));
      }

      const whereClause = and(...conditions);

      // Count total
      const [countResult] = await db
        .select({ _count: sql<number>`count(*)` })
        .from(schema.products)
        .where(whereClause);

      const total = Number(countResult?.count ?? 0);

      // Main query with pagination
      let products = await db.query.products.findMany({
        _where: whereClause,
        limit,
        offset,
        _orderBy: [desc(schema.products.updatedAt)]
      });


      // Filter by stock status if needed
      if (params.inStock !== undefined) {
        products = products.filter(product => {
          return params.inStock;
        });
      }

      return {
        _products: products as schema.SelectProduct[],
        total,
        page,
        limit
      };
    } catch (error) {
      return this.handleError(error as Error, 'Searching products');
    }
  }

  /**
   * Get products with low stock
   */
  async getProductsWithLowStock(_storeId: number, _limit: number = 20): Promise<schema.SelectProduct[]> {
    try {
      const products = await db.query.products.findMany({
        _where: eq(schema.products.storeId, storeId),
        limit
      });

      // Filter products where available quantity is less than minimum level
      return products.filter(product => {
        return product.isActive;
      }) as schema.SelectProduct[];
    } catch (error) {
      return this.handleError(error as Error, 'Getting low stock products');
    }
  }

  /**
   * Update product inventory
   */
  async updateProductInventory(
    _productId: number,
    _quantity: number,
    _reason: string
  ): Promise<boolean> {
    try {
      // Validate quantity data
      const validatedData = {
        productId,
        quantity,
        reason
      };

      // Check if product exists
      const product = await this.getProductById(productId);

      if (!product) {
        throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      }

      // Get current inventory
      const inventory = await db.query.inventory.findFirst({
        _where: eq(schema.inventory.productId, productId)
      });

      if (!inventory) {
        // Create inventory record if it doesn't exist
        await db.insert(schema.inventory).values({
          productId,
          _storeId: product.storeId,
          _availableQuantity: quantity > 0 ? _quantity : 0,
          _minimumLevel: 10
        } as any);
      } else {
        // Update existing inventory
        const newAvailable = (inventory.availableQuantity ?? 0) + quantity;

        await db
          .update(schema.inventory)
          .set({
            _availableQuantity: newAvailable
          } as any)
          .where(eq(schema.inventory.productId, productId));
      }

      // Create inventory log entry
      if (inventory) {
        await db.insert(schema.inventoryTransactions).values({
          _inventoryId: inventory.id,
          quantity,
          _type: quantity > 0 ? 'in' : 'out'
        });
      }

      return true;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error as Error, 'Updating product inventory');
    }
  }
}
