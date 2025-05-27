// test/integration/customer.integration.test.ts
// Integration test for Customer model using in-memory SQLite DB and test tagging

import { db, customers } from '../factories/db';
import { eq } from 'drizzle-orm';
import { makeMockCustomer } from '../factories/customer';
import { test, describe } from '../testTags';

describe.integration('Customer Integration', () => {
  beforeAll(async () => {
    // No explicit connect needed for SQLite in-memory, but if you use Postgres, connect here
  });

  afterAll(async () => {
    // No explicit disconnect needed for SQLite in-memory, but if you use Postgres, disconnect here
  });

  beforeEach(async () => {
    await db.delete(customers); // Clean slate for each test
  });

  test.integration('should create and fetch a customer', async () => {
    const mockData = makeMockCustomer({ name: 'Alice', email: 'alice@example.com' });
    // Insert customer
    const inserted = await db.insert(customers).values(mockData).returning();
    const created = inserted[0];
    expect(created).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
    });

    // Fetch customer by id
    const fetchedArr = await db.select().from(customers).where(eq(customers.id, created.id));
    const fetched = fetchedArr[0];
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Alice');
    expect(fetched?.email).toBe('alice@example.com');
  });
});

test('Jest debug test', () => {
  expect(1).toBe(1);
});
