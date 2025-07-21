import { EnhancedBaseService } from '../base/enhanced-service';
import { IProductService, CreateProductParams, UpdateProductParams, ProductSearchParams, ProductServiceErrors } from './types';
import db from '../../database';
import * as schema from '@shared/schema';
import { productValidation, SchemaValidationError } from '@shared/schema-validation';
import { eq, and, or, like } from 'drizzle-orm'; // ensure eq and and are imported

export class EnhancedProductService extends EnhancedBaseService implements IProductService {
  async createProduct(params: CreateProductParams): Promise<schema.Product> {
    try {
      // Check if store exists
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, params.storeId)
      });
      if (!store) throw ProductServiceErrors.INVALID_STORE;
      // Check for duplicate SKU
      const existingSku = await db.query.products.findFirst({
        where: and(eq(schema.products.sku, params.sku), eq(schema.products.storeId, params.storeId))
      });
      if (existingSku) throw ProductServiceErrors.DUPLICATE_SKU;
      // Check for duplicate barcode if provided
      if (params.barcode) {
        const existingBarcode = await db.query.products.findFirst({
          where: and(eq(schema.products.barcode, params.barcode), eq(schema.products.storeId, params.storeId))
        });
        if (existingBarcode) throw ProductServiceErrors.DUPLICATE_BARCODE;
      }
      // Check if category exists if provided
      if (params.categoryId) {
        const category = await db.query.productCategories.findFirst({
          where: eq(schema.categories.id, params.categoryId)
        });
        if (!category) throw ProductServiceErrors.INVALID_CATEGORY;
      }
      // Check if brand exists if provided
      
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
        updatedAt: new Date()
      };
      const validatedData = productValidation.insert(productData);
      const [product] = await db.insert(schema.products).values(validatedData).returning();
      await db.insert(schema.inventory).values({
        productId: product.id,
        storeId: params.storeId,
        totalQuantity: 0,
        availableQuantity: 0,
        minimumLevel: 10,
      });
      return product;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating product');
    }
  }

  async updateProduct(productId: number, params: UpdateProductParams): Promise<schema.Product> {
    try {
      const existingProduct = await db.query.products.findFirst({ where: eq(schema.products.id, productId) });
      if (!existingProduct) throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      if (params.sku && params.sku !== existingProduct.sku) {
        const existingSku = await db.query.products.findFirst({
          where: and(eq(schema.products.sku, params.sku), eq(schema.products.storeId, existingProduct.storeId))
        });
        if (existingSku) throw ProductServiceErrors.DUPLICATE_SKU;
      }
      if (params.barcode && params.barcode !== existingProduct.barcode) {
        const existingBarcode = await db.query.products.findFirst({
          where: and(eq(schema.products.barcode, params.barcode), eq(schema.products.storeId, existingProduct.storeId))
        });
        if (existingBarcode) throw ProductServiceErrors.DUPLICATE_BARCODE;
      }
      if (params.categoryId && params.categoryId !== existingProduct.categoryId) {
        const category = await db.query.productCategories.findFirst({ where: eq(schema.categories.id, params.categoryId) });
        if (!category) throw ProductServiceErrors.INVALID_CATEGORY;
      }
      
      const updateData = { ...params, updatedAt: new Date() };
      const validatedData = productValidation.update(updateData);
      const [updatedProduct] = await db.update(schema.products).set(validatedData).where(eq(schema.products.id, productId)).returning();
      return updatedProduct;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating product');
    }
  }

  async deleteProduct(productId: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.products).where(eq(schema.products.id, productId)).returning({ id: schema.products.id });
      if (result.length === 0) throw ProductServiceErrors.PRODUCT_NOT_FOUND;
      return true;
    } catch (error) {
      return this.handleError(error, 'Deleting product');
    }
  }

  async getProductById(productId: number): Promise<schema.Product | null> {
    try {
      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, productId),
        with: { category: true, brand: true, inventory: true }
      });
      return product;
    } catch (error) {
      return this.handleError(error, 'Getting product by ID');
    }
  }

  async getProductBySku(sku: string, storeId: number): Promise<schema.Product | null> {
    try {
      return await db.query.products.findFirst({
        where: and(eq(schema.products.sku, sku), eq(schema.products.storeId, storeId)),
        with: { category: true, brand: true, inventory: true }
      });
    } catch (error) {
      return this.handleError(error, 'Getting product by SKU');
    }
  }

  async getProductByBarcode(barcode: string, storeId: number): Promise<schema.Product | null> {
    try {
      return await db.query.products.findFirst({
        where: and(eq(schema.products.barcode, barcode), eq(schema.products.storeId, storeId)),
        with: { category: true, brand: true, inventory: true }
      });
    } catch (error) {
      return this.handleError(error, 'Getting product by barcode');
    }
  }

  async searchProducts(params: ProductSearchParams): Promise<{ products: schema.Product[]; total: number; page: number; limit: number; }> {
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

      const products = await db.query.products.findMany({
        where,
        with: { category: true, brand: true, inventory: true },
        limit,
        offset,
      });

      const total = await db.select({ count: schema.products.id }).from(schema.products).where(where);

      return { products, total: total.length, page, limit };
    } catch (error) {
      return this.handleError(error, 'Searching products');
    }
  }

  async getProductsWithLowStock(storeId: number, limit: number = 10): Promise<schema.Product[]> {
    try {
      return await db.query.products.findMany({
        where: and(
          eq(schema.products.storeId, storeId),
          eq(schema.inventory.availableQuantity, 0)
        ),
        with: { inventory: true },
        limit,
      });
    } catch (error) {
      return this.handleError(error, 'Getting products with low stock');
    }
  }

  async updateProductInventory(productId: number, quantity: number, reason: string): Promise<boolean> {
    try {
      const inventory = await db.query.inventory.findFirst({ where: eq(schema.inventory.productId, productId) });
      if (!inventory) throw ProductServiceErrors.PRODUCT_NOT_FOUND;

      const newQuantity = inventory.availableQuantity + quantity;
      if (newQuantity < 0) throw new Error('Insufficient stock');

      await db.update(schema.inventory).set({ availableQuantity: newQuantity }).where(eq(schema.inventory.id, inventory.id));
      
      // Log the inventory change
      await db.insert(schema.inventoryLogs).values({
        productId,
        previousQuantity: inventory.availableQuantity,
        newQuantity,
        quantity,
        reason,
      });

      return true;
    } catch (error) {
      return this.handleError(error, 'Updating product inventory');
    }
  }
}

export const enhancedProductService = new EnhancedProductService();
