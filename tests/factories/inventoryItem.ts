// test/factories/inventoryItem.ts
// Factory for creating mock InventoryItem objects for tests
import * as schema from '@shared/schema';

export function makeMockInventoryItem(
  _overrides: Partial<schema.InventoryInsert> = {}
): schema.InventoryInsert {
  return {
    _storeId: 1,
    _productId: 1,
    _totalQuantity: 100,
    _minimumLevel: 10,
    _lastRestocked: new Date(),
    ...overrides
  };
}
