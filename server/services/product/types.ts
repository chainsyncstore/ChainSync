/**
 * Product Service Types
 *
 * This file defines the interfaces and types for the product service.
 */

import * as schema from '@shared/schema';

export interface CreateProductParams {
  name: string;
  description?: string;
  sku: string;
  price: string;
  cost?: string;
  categoryId?: number;
  brandId?: number;
  isActive?: boolean;
  storeId: number;
  imageUrl?: string;
  barcode?: string;
  attributes?: Record<string, unknown>;
}

export interface UpdateProductParams {
  name?: string;
  description?: string;
  sku?: string;
  price?: string;
  cost?: string;
  categoryId?: number;
  brandId?: number;
  isActive?: boolean;
  imageUrl?: string;
  barcode?: string;
  attributes?: Record<string, unknown>;
}

export interface ProductSearchParams {
  storeId: number;
  query?: string;
  categoryId?: number;
  brandId?: number;
  inStock?: boolean;
  minPrice?: string;
  maxPrice?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ProductServiceErrors {
  PRODUCT_NOT_FOUND: Error;
  DUPLICATE_SKU: Error;
  DUPLICATE_BARCODE: Error;
  INVALID_STORE: Error;
  INVALID_CATEGORY: Error;
  INVALID_BRAND: Error;
}

export const ProductServiceErrors: ProductServiceErrors = {
  PRODUCT_NOT_FOUND: new Error('Product not found'),
  DUPLICATE_SKU: new Error('SKU already exists'),
  DUPLICATE_BARCODE: new Error('Barcode already exists'),
  INVALID_STORE: new Error('Invalid store ID'),
  INVALID_CATEGORY: new Error('Invalid category ID'),
  INVALID_BRAND: new Error('Invalid brand ID'),
};

export interface IProductService {
  createProduct(params: CreateProductParams): Promise<schema.Product>;
  updateProduct(productId: number, params: UpdateProductParams): Promise<schema.Product>;
  deleteProduct(productId: number): Promise<boolean>;
  getProductById(productId: number): Promise<schema.Product | null>;
  getProductBySku(sku: string, storeId: number): Promise<schema.Product | null>;
  getProductByBarcode(barcode: string, storeId: number): Promise<schema.Product | null>;
  searchProducts(params: ProductSearchParams): Promise<{
    products: schema.Product[];
    total: number;
    page: number;
    limit: number;
  }>;
  getProductsWithLowStock(storeId: number, limit?: number): Promise<schema.Product[]>;
  updateProductInventory(productId: number, quantity: number, reason: string): Promise<boolean>;
}
