// test/integration/customer.integration.test.ts
// Integration test for Customer model using in-memory SQLite DB and test tagging
import { PrismaClient } from '@prisma/client';
import { makeMockCustomer } from '../factories/customer';
import { test, describe } from '../testTags';

const prisma = new PrismaClient();

describe.integration('Customer Integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.customer.deleteMany(); // Clean slate for each test
  });

  test.integration('should create and fetch a customer', async () => {
    const mockData = makeMockCustomer({ name: 'Alice', email: 'alice@example.com' });
    const created = await prisma.customer.create({ data: mockData });
    expect(created).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
    });

    const fetched = await prisma.customer.findUnique({ where: { id: created.id } });
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Alice');
    expect(fetched?.email).toBe('alice@example.com');
  });
});
