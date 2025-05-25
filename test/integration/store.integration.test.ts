// test/integration/store.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { makeMockStore } from '../factories/store';
import { test, describe } from '../testTags';

const prisma = new PrismaClient();

describe.integration('Store Integration', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await prisma.store.deleteMany(); });

  test.integration('should create and fetch a store', async () => {
    const mockStore = makeMockStore({ name: 'Main Store', email: 'main@store.com' });
    const created = await prisma.store.create({ data: mockStore });
    expect(created).toMatchObject({ name: 'Main Store', email: 'main@store.com' });

    const fetched = await prisma.store.findUnique({ where: { id: created.id } });
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Main Store');
    expect(fetched?.email).toBe('main@store.com');
  });
});
