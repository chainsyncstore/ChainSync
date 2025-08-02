/**
 * Product Service Types
 *
 * This file defines the interfaces and types for the product service.
 */

import { products } from '@shared/schema';
import { InferSelectModel } from 'drizzle-orm';

export type SelectProduct = InferSelectModel<typeof products>;
export interface CreateProductParams {
  _name: string;
  description?: string;
  _sku: string;
  _price: string;
  cost?: string;
  categoryId?: number;
  brandId?: number;
  isActive?: boolean;
  _storeId: number;
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
  _storeId: number;
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
  _PRODUCT_NOT_FOUND: Error;
  _DUPLICATE_SKU: Error;
  _DUPLICATE_BARCODE: Error;
  _INVALID_STORE: Error;
  _INVALID_CATEGORY: Error;
  _INVALID_BRAND: Error;
}

export const _ProductServiceErrors: ProductServiceErrors = {
  _PRODUCT_NOT_FOUND: new Error('Product not found'),
  _DUPLICATE_SKU: new Error('SKU already exists'),
  _DUPLICATE_BARCODE: new Error('Barcode already exists'),
  _INVALID_STORE: new Error('Invalid store ID'),
  _INVALID_CATEGORY: new Error('Invalid category ID'),
  _INVALID_BRAND: new Error('Invalid brand ID')
};

export interface IProductService {
  createProduct(_params: CreateProductParams): Promise<SelectProduct>;
  updateProduct(_productId: number, _params: UpdateProductParams): Promise<SelectProduct>;
  deleteProduct(_productId: number): Promise<boolean>;
  getProductById(_productId: number): Promise<SelectProduct | null>;
  getProductBySku(_sku: string, _storeId: number): Promise<SelectProduct | null>;
  getProductByBarcode(_barcode: string, _storeId: number): Promise<SelectProduct | null>;
  searchProducts(_params: ProductSearchParams): Promise<{
    _products: SelectProduct[];
    _total: number;
    _page: number;
    _limit: number;
  }>;
  getProductsWithLowStock(_storeId: number, limit?: number): Promise<SelectProduct[]>;
  updateProductInventory(_productId: number, _quantity: number, _reason: string): Promise<boolean>;
}
