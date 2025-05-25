// test/factories/product.ts
// Factory for creating mock Product objects for tests
import type { Product } from '@prisma/client';

export function makeMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Test Product',
    price: '10.00',
    createdAt: new Date(),
    updatedAt: new Date(),
    inventory: 10,
    ...overrides,
  };
}
