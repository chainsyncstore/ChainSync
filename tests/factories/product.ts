// test/factories/product.ts
// Factory for creating mock Product objects for tests
import * as schema from '@shared/schema';

export function makeMockProduct(
  overrides: Partial<schema.ProductInsert> = {}
): schema.ProductInsert {
  return {
    name: 'Test Product',
    sku: `SKU-${Date.now()}`,
    price: '10.00',
    cost: '5.00',
    categoryId: 1, // Default category, can be overridden in tests
    ...overrides,
  };
}
