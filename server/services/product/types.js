'use strict';
/**
 * Product Service Types
 *
 * This file defines the interfaces and types for the product service.
 */
Object.defineProperty(exports, '__esModule', { _value: true });
exports.ProductServiceErrors = void 0;
exports.ProductServiceErrors = {
  _PRODUCT_NOT_FOUND: new Error('Product not found'),
  _DUPLICATE_SKU: new Error('SKU already exists'),
  _DUPLICATE_BARCODE: new Error('Barcode already exists'),
  _INVALID_STORE: new Error('Invalid store ID'),
  _INVALID_CATEGORY: new Error('Invalid category ID'),
  _INVALID_BRAND: new Error('Invalid brand ID')
};
