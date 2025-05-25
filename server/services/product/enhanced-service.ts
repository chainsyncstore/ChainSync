import { EnhancedBaseService } from '../base/enhanced-service';
import { IProductService, CreateProductParams, UpdateProductParams, ProductSearchParams, ProductServiceErrors } from './types';
import db from '../../database';
import * as schema from '@shared/schema';
import { productValidation, SchemaValidationError } from '@shared/schema-validation';
import { eq, and } from 'drizzle-orm'; // ensure eq and and are imported

export class EnhancedProductService extends EnhancedBaseService implements IProductService {
  // Stubs for missing interface methods
  async deleteProduct(productId: number): Promise<boolean> { throw new Error('Not implemented'); }
  async getProductById(productId: number): Promise<schema.products | null> { throw new Error('Not implemented'); }
  async getProductBySku(sku: string, storeId: number): Promise<schema.products | null> { throw new Error('Not implemented'); }
  async getProductByBarcode(barcode: string, storeId: number): Promise<schema.products | null> { throw new Error('Not implemented'); }
  async getProductsWithLowStock(storeId: number, limit: number): Promise<schema.products[]> { throw new Error('Not implemented'); }
  async updateProductInventory(productId: number, quantity: number, reason: string): Promise<boolean> { throw new Error('Not implemented'); }
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
        createdAt: new Date(),
        updatedAt: new Date()
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
    // ...
    return null;
  }

  async getProductByBarcode(barcode: string, storeId: number): Promise<schema.Product | null> {
    // ...
    return null;
  }

  async searchProducts(params: ProductSearchParams): Promise<{ products: schema.Product[]; total: number; page: number; limit: number; }> {
    // ...
    return { products: [], total: 0, page: 1, limit: 10 };
  }

  async getProductsWithLowStock(storeId: number, limit?: number): Promise<schema.Product[]> {
    // ...
    return [];
  }

  async updateProductInventory(productId: number, quantity: number, reason: string): Promise<boolean> {
    // ...
    return true;
  }
}

export const enhancedProductService = new EnhancedProductService();
