// test/integration/transaction.integration.test.ts
// Example integration test using Drizzle ORM
import { db } from '../../db';
import * as schema from '@shared/schema';
import { makeMockProduct } from '../factories/product';
import { makeMockTransaction } from '../factories/transaction';
import { makeMockStore } from '../factories/store';
import { makeMockCustomer } from '../factories/customer';
import { makeMockUser } from '../factories/user';
import { test, describe } from '../testTags';
import { eq } from 'drizzle-orm';

describe.integration('Transaction Integration', () => {
  let store: schema.Store;
  let user: schema.User;
  let customer: schema.Customer;

  beforeEach(async () => {
    // Clean DB in reverse order of creation to avoid foreign key constraints
    await db.delete(schema.transactions);
    await db.delete(schema.products);
    await db.delete(schema.customers);
    await db.delete(schema.users);
    await db.delete(schema.stores);

    // Seed necessary data for a transaction
    [store] = await db.insert(schema.stores).values(makeMockStore()).returning();
    [user] = await db.insert(schema.users).values(makeMockUser()).returning();
    [customer] = await db
      .insert(schema.customers)
      .values(makeMockCustomer({ storeId: store.id }))
      .returning();
    await db.insert(schema.products).values(makeMockProduct()).returning();
  });

  test.integration('should create and fetch a transaction', async () => {
    const mockTx = makeMockTransaction({
      storeId: store.id,
      customerId: customer.id,
      userId: user.id,
      referenceNumber: 'TXN-123',
    });

    const [created] = await db.insert(schema.transactions).values(mockTx).returning();
    expect(created).toHaveProperty('id');

    const [fetched] = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, created.id));
    expect(fetched).not.toBeNull();
    expect(fetched?.referenceNumber).toBe('TXN-123');
  });
});
