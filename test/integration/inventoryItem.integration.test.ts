// test/integration/inventoryItem.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { makeMockInventoryItem } from '../factories/inventoryItem';
import { test, describe } from '../testTags';

const prisma = new PrismaClient();

describe.integration('InventoryItem Integration', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await prisma.inventory.deleteMany(); });

  test.integration('should create and fetch an inventory item', async () => {
    const mockItem = makeMockInventoryItem({ totalQuantity: 42, minimumLevel: 5 });
    const created = await prisma.inventory.create({ data: mockItem });
    expect(created).toMatchObject({ totalQuantity: 42, minimumLevel: 5 });

    const fetched = await prisma.inventory.findUnique({ where: { id: created.id } });
    expect(fetched).not.toBeNull();
    expect(fetched?.totalQuantity).toBe(42);
    expect(fetched?.minimumLevel).toBe(5);
  });
});
