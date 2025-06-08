// test/integration/services/transactionService.integration.test.ts

import { makeMockCustomer } from '../../factories/customer';
import { makeMockStore } from '../../factories/store';
import { makeMockProduct } from '../../factories/product';
import { makeMockInventoryItem } from '../../factories/inventoryItem';
import { test, describe } from '../../testTags';

// Placeholder: Replace with your actual TransactionService import
// import { TransactionService } from '../../../server/services/transaction/service';

// Placeholder/mock for TransactionService.createTransaction
// Replace with your real implementation as needed
async function createTransaction({
  storeId,
  customerId,
  userId,
  productId,
  quantity,
}: {
  storeId: number;
  customerId: number;
  userId: number;
  productId: number;
  quantity: number;
}) {
  // Decrement inventory
  const inventory =
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ inventory.findFirst(
      { where: { storeId, productId } }
    );
  if (!inventory || inventory.totalQuantity < quantity) throw new Error('Insufficient stock');
  await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ inventory.update({
    where: { id: inventory.id },
    data: { totalQuantity: inventory.totalQuantity - quantity },
  });
  // Record transaction
  const transaction =
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ transaction.create(
      {
        data: {
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
        },
      }
    );
  // Update customer (for demo, just fetch)
  const customer =
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ customer.findUnique(
      { where: { id: customerId } }
    );
  return {
    transaction,
    inventory:
      await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ inventory.findUnique(
        { where: { id: inventory.id } }
      ),
    customer,
  };
}

describe.integration('TransactionService Integration', () => {
  beforeAll(async () => {
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ $connect();
  });
  afterAll(async () => {
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ $disconnect();
  });
  beforeEach(async () => {
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ transaction.deleteMany();
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ inventory.deleteMany();
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ product.deleteMany();
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ customer.deleteMany();
    await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ store.deleteMany();
  });

  test.integration('should process a sale and update inventory and customer', async () => {
    // Seed related entities
    const store =
      await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ store.create({
        data: makeMockStore(),
      });
    const customer =
      await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ customer.create(
        { data: makeMockCustomer() }
      );
    const product =
      await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ product.create(
        { data: makeMockProduct() }
      );
    const inventory =
      await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */ inventory.create(
        {
          data: makeMockInventoryItem({
            storeId: store.id,
            productId: product.id,
            totalQuantity: 10,
          }),
        }
      );
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
