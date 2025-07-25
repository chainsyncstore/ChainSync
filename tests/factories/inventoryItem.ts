// test/factories/inventoryItem.ts
// Factory for creating mock InventoryItem objects for tests
import * as schema from '@shared/schema';

export function makeMockInventoryItem(
  overrides: Partial<schema.InventoryInsert> = {}
): schema.InventoryInsert {
  return {
    storeId: 1,
    productId: 1,
    totalQuantity: 100,
    minimumLevel: 10,
    lastStockUpdate: new Date(),
    ...overrides,
  };
}
