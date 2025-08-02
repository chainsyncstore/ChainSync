// test/factories/product.ts
// Factory for creating mock Product objects for tests
import * as schema from '@shared/schema';

export function makeMockProduct(
  _overrides: Partial<schema.ProductInsert> = {}
): schema.ProductInsert {
  return {
    _name: 'Test Product',
    _storeId: 1,
    _sku: `SKU-${Date.now()}`,
    _price: '10.00',
    _cost: '5.00',
    _categoryId: 1, // Default category, can be overridden in tests
    ...overrides
  };
}
