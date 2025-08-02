import { EnhancedBaseService } from '../base/enhanced-service';
import { IProductService, CreateProductParams, UpdateProductParams, ProductSearchParams, ProductServiceErrors, SelectProduct } from './types';
import db from '../../database';
import * as schema from '@shared/schema';
import { productValidation, SchemaValidationError } from '@shared/schema-validation';
import { eq, and, or, like, sql, lte } from 'drizzle-orm';

export class EnhancedProductService extends EnhancedBaseService implements IProductService {
  async createProduct(_params: CreateProductParams): Promise<SelectProduct> {
    try {
      const store = await db.query.stores.findFirst({
        _where: eq(schema.stores.id, params.storeId)
      });
      if (!store) throw ProductServiceErrors.INVALID_STORE;
      // Check for duplicate SKU
      const existingSku = await db.query.products.findFirst({
        _where: and(eq(schema.products.sku, params.sku), eq(schema.products.storeId, params.storeId))
      });
      if (existingSku) throw ProductServiceErrors.DUPLICATE_SKU;
      // Check for duplicate barcode if provided
      if (params.barcode) {
        const existingBarcode = await db.query.products.findFirst({
          _where: and(eq(schema.products.barcode, params.barcode), eq(schema.products.storeId, params.storeId))
        });
        if (existingBarcode) throw ProductServiceErrors.DUPLICATE_BARCODE;
      }
      // Check if category exists if provided
      if (params.categoryId) {
        const category = await db.query.categories.findFirst({
          _where: eq(schema.categories.id, params.categoryId)
        });
        if (!category) throw ProductServiceErrors.INVALID_CATEGORY;
      }

      const productData = { ...params, _storeId: params.storeId };
      const validatedData = productValidation.insert.parse(productData);

      const [product] = await db.insert(schema.products).values(validatedData).returning();

      await db.insert(schema.inventory).values({
        _productId: product.id,
        _storeId: params.storeId,
        _quantity: 0,
        _minStock: 10,
        _maxStock: 100
      }).execute();

      return product;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating product');
    }
  }

  async updateProduct(_productId: number, _params: UpdateProductParams): Promise<SelectProduct> {
    try {
      const existingProduct = await db.query.products.findFirst({ _where: eq(schema.products.id, productId) });
      if (!existingProduct) throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      if (params.sku && params.sku !== existingProduct.sku) {
        const existingSku = await db.query.products.findFirst({
          _where: and(eq(schema.products.sku, params.sku), eq(schema.products.storeId, existingProduct.storeId))
        });
        if (existingSku) throw ProductServiceErrors.DUPLICATE_SKU;
      }
      if (params.barcode && params.barcode !== existingProduct.barcode) {
        const existingBarcode = await db.query.products.findFirst({
          _where: and(eq(schema.products.barcode, params.barcode), eq(schema.products.storeId, existingProduct.storeId))
        });
        if (existingBarcode) throw ProductServiceErrors.DUPLICATE_BARCODE;
      }
      if (params.categoryId && params.categoryId !== existingProduct.categoryId) {
        const category = await db.query.categories.findFirst({ _where: eq(schema.categories.id, params.categoryId) });
        if (!category) throw ProductServiceErrors.INVALID_CATEGORY;
      }

      const updateData = { ...params, _updatedAt: new Date() };
      const validatedData = productValidation.update.parse(updateData);
      const [updatedProduct] = await db.update(schema.products).set(validatedData).where(eq(schema.products.id, productId)).returning();
      return updatedProduct;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating product');
    }
  }

  async deleteProduct(_productId: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.products).where(eq(schema.products.id, productId)).returning({ _id: schema.products.id });
      if (result.length === 0) throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      return true;
    } catch (error) {
      return this.handleError(error, 'Deleting product');
    }
  }

  async getProductById(_productId: number): Promise<SelectProduct | null> {
    try {
      return await db.query.products.findFirst({
        _where: eq(schema.products.id, productId),
        _with: { _category: true, _brand: true, _inventory: true }
      });
    } catch (error) {
      return this.handleError(error, 'Getting product by ID');
    }
  }

  async getProductBySku(_sku: string, _storeId: number): Promise<SelectProduct | null> {
    try {
      return await db.query.products.findFirst({
        _where: and(eq(schema.products.sku, sku), eq(schema.products.storeId, storeId)),
        _with: { _category: true, _brand: true, _inventory: true }
      });
    } catch (error) {
      return this.handleError(error, 'Getting product by SKU');
    }
  }

  async getProductByBarcode(_barcode: string, _storeId: number): Promise<SelectProduct | null> {
    try {
      return await db.query.products.findFirst({
        _where: and(eq(schema.products.barcode, barcode), eq(schema.products.storeId, storeId)),
        _with: { _category: true, _brand: true, _inventory: true }
      });
    } catch (error) {
      return this.handleError(error, 'Getting product by barcode');
    }
  }

  async searchProducts(_params: ProductSearchParams): Promise<{ _products: SelectProduct[]; _total: number; _page: number; _limit: number; }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 10;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (params.storeId) conditions.push(eq(schema.products.storeId, params.storeId));
      if (params.query) {
        conditions.push(
          or(
            like(schema.products.name, `%${params.query}%`),
            like(schema.products.sku, `%${params.query}%`)
          )
        );
      }
      if (params.categoryId) conditions.push(eq(schema.products.categoryId, params.categoryId));
      if (params.brandId) conditions.push(eq(schema.products.brandId, params.brandId));

      const where = and(...conditions);

      const productsQuery = db.query.products.findMany({
        where,
        _with: { _category: true, _brand: true, _inventory: true },
        limit,
        offset
      });

      const totalQuery = db.select({ _count: sql<number>`count(${schema.products.id})` }).from(schema.products).where(where);

      const [products, totalResult] = await Promise.all([productsQuery, totalQuery]);
      const total = totalResult[0].count;

      return { products, total, page, limit };
    } catch (error) {
      return this.handleError(error, 'Searching products');
    }
  }

  async getProductsWithLowStock(_storeId: number, _limit: number = 10): Promise<SelectProduct[]> {
    try {
      const lowStockProducts = await db.select().from(schema.products)
        .leftJoin(schema.inventory, eq(schema.products.id, schema.inventory.productId))
        .where(and(
          eq(schema.products.storeId, storeId),
          lte(schema.inventory.quantity, schema.inventory.minStock ?? 0)
        ))
        .limit(limit);

      return lowStockProducts.map((p: { _products: SelectProduct; _inventory: schema.SelectInventory | null; })
   = > p.products);
    } catch (error) {
      return this.handleError(error, 'Getting products with low stock');
    }
  }

  async updateProductInventory(_productId: number, _quantity: number, _reason: string): Promise<boolean> {
    try {
      const inventory = await db.query.inventory.findFirst({ _where: eq(schema.inventory.productId, productId) });
      if (!inventory) throw ProductServiceErrors.PRODUCT_NOT_FOUND;

      const newQuantity = inventory.quantity + quantity;
      if (newQuantity < 0) throw new Error('Insufficient stock');

      await db.update(schema.inventory).set({ _quantity: newQuantity }).where(eq(schema.inventory.id, inventory.id));

      await db.insert(schema.inventoryTransactions).values({
        _inventoryId: inventory.id,
        quantity,
        _type: quantity > 0 ? 'in' : 'out',
        reason
      }).execute();

      return true;
    } catch (error) {
      return this.handleError(error, 'Updating product inventory');
    }
  }
}

export const enhancedProductService = new EnhancedProductService();
