// test/integration/transaction.integration.test.ts
// Example integration test using in-memory SQLite DB with Prisma
import { PrismaClient } from '@prisma/client';
import { makeMockProduct } from '../factories/product';
import { makeMockTransaction } from '../factories/transaction';

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
  // Ensure schema is up-to-date (run this in your test runner setup or CI for best results)
  // await prisma.$executeRaw`PRAGMA foreign_keys=ON;` // Optional: enable foreign keys
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Transaction Integration', () => {
  beforeEach(async () => {
    // Clean DB and seed minimal data
    await prisma.transaction.deleteMany();
    await prisma.product.deleteMany();
    await prisma.product.create({ data: makeMockProduct() });
  });

  it('should create and fetch a transaction', async () => {
    const created = await prisma.transaction.create({ data: makeMockTransaction() });
    expect(created).toHaveProperty('id');

    const fetched = await prisma.transaction.findUnique({ where: { id: created.id } });
    expect(fetched).not.toBeNull();
    expect(fetched?.reference).toBe('TXN-123');
  });
});
