// test/factories/inventoryItem.ts
// Factory for creating mock InventoryItem objects for tests
import type { Inventory } from '@prisma/client';

export function makeMockInventoryItem(overrides: Partial<Inventory> = {}): Inventory {
  return {
    id: 1,
    storeId: 1,
    productId: 1,
    totalQuantity: 100,
    minimumLevel: 10,
    lastStockUpdate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
