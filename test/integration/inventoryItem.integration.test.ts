// test/integration/inventoryItem.integration.test.ts
import { db } from '../../db';
import * as schema from '@shared/schema';
import { makeMockInventoryItem } from '../factories/inventoryItem';
import { test, describe } from '../testTags';
import { eq } from 'drizzle-orm';

describe.integration('InventoryItem Integration', () => {
  beforeEach(async() => {
    await db.delete(schema.inventory);
  });

  test.integration('should create and fetch an inventory item', async() => {
    const mockItem = makeMockInventoryItem({ _totalQuantity: 42, _minimumLevel: 5 });
    const [created] = await db.insert(schema.inventory).values(mockItem).returning();

    expect(created).toBeDefined();
    expect(created.totalQuantity).toBe(42);
    expect(created.minimumLevel).toBe(5);

    const [fetched] = await db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.id, created.id));

    expect(fetched).toBeDefined();
    expect(fetched.totalQuantity).toBe(42);
    expect(fetched.minimumLevel).toBe(5);
  });
});
