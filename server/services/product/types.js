'use strict';
/**
 * Product Service Types
 *
 * This file defines the interfaces and types for the product service.
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.ProductServiceErrors = void 0;
exports.ProductServiceErrors = {
  PRODUCT_NOT_FOUND: new Error('Product not found'),
  DUPLICATE_SKU: new Error('SKU already exists'),
  DUPLICATE_BARCODE: new Error('Barcode already exists'),
  INVALID_STORE: new Error('Invalid store ID'),
  INVALID_CATEGORY: new Error('Invalid category ID'),
  INVALID_BRAND: new Error('Invalid brand ID')
};
