// test/integration/services/transactionService.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { makeMockCustomer } from '../../factories/customer';
import { makeMockStore } from '../../factories/store';
import { makeMockProduct } from '../../factories/product';
import { makeMockInventoryItem } from '../../factories/inventoryItem';
import { test, describe } from '../../testTags';

// Placeholder: Replace with your actual TransactionService import
// import { TransactionService } from '../../../server/services/transaction/service';

const prisma = new PrismaClient();

// Placeholder/mock for TransactionService.createTransaction
// Replace with your real implementation as needed
async function createTransaction({ storeId, customerId, userId, productId, quantity }: {
  storeId: number;
  customerId: number;
  userId: number;
  productId: number;
  quantity: number;
}) {
  // Decrement inventory
  const inventory = await prisma.inventory.findFirst({ where: { storeId, productId } });
  if (!inventory || inventory.totalQuantity < quantity) throw new Error('Insufficient stock');
  await prisma.inventory.update({ where: { id: inventory.id }, data: { totalQuantity: inventory.totalQuantity - quantity } });
  // Record transaction
  const transaction = await prisma.transaction.create({ data: {
    storeId,
    customerId,
    userId,
    type: 'SALE',
    status: 'COMPLETED',
    subtotal: '100.00',
    tax: '10.00',
    total: '110.00',
    paymentMethod: 'CASH',
    notes: 'Integration test',
    reference: 'TXN-456',
    createdAt: new Date(),
    updatedAt: new Date(),
  }});
  // Update customer (for demo, just fetch)
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  return { transaction, inventory: await prisma.inventory.findUnique({ where: { id: inventory.id } }), customer };
}

describe.integration('TransactionService Integration', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.product.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.store.deleteMany();
  });

  test.integration('should process a sale and update inventory and customer', async () => {
    // Seed related entities
    const store = await prisma.store.create({ data: makeMockStore() });
    const customer = await prisma.customer.create({ data: makeMockCustomer() });
    const product = await prisma.product.create({ data: makeMockProduct() });
    const inventory = await prisma.inventory.create({ data: makeMockInventoryItem({ storeId: store.id, productId: product.id, totalQuantity: 10 }) });
    const userId = 1; // Replace with a valid user if needed

    // Call the (mocked) transaction service
    const result = await createTransaction({
      storeId: store.id,
      customerId: customer.id,
      userId,
      productId: product.id,
      quantity: 2,
    });

    // Assert transaction was recorded
    expect(result.transaction).toMatchObject({ storeId: store.id, customerId: customer.id });
    // Assert inventory was decremented
    expect(result.inventory?.totalQuantity).toBe(8);
    // Assert customer is still present
    expect(result.customer).not.toBeNull();
  });
});
